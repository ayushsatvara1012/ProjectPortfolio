"""COA finder — H5 (forced-walk single flight) and H15 (Drive retry + breaker).

The last two items on the plan's §13.1 ship-blocker list. Both are about a Drive that
is present but unhappy, which is the state the rest of the suite never exercises:
every other COA test has Drive either working or absent.

* **H5** — every search miss re-walks (§6 step 5), so without a gate a visitor typing
  nonsense batch numbers, or any scanner, produces unlimited Drive walks, and
  concurrent misses each start their own. The gate has to be correct **across
  workers**, which is why it is a Redis `SET NX` and not only a process-local
  timestamp.
* **H15** — a 403 meaning "slow down" and a 403 meaning "this folder is not shared
  with you" arrive identically. Retrying the second is pure latency; reporting the
  first to a visitor as "no certificate exists" tells someone holding a real drum
  that their batch was never tested.
* **The failure the retry layer does not fix**, and the reason the breaker is here:
  with Drive unreachable nothing ever reaches the cache, so *every* search walks and
  every walk burns the full timeout budget. The caches only protect the healthy path.
"""
import asyncio

import httpx
import pytest

from byod_breaker import BreakerConfig, BreakerRegistry
from services import coa_drive
from services.coa_drive import (
    CoaDriveError,
    backoff_delay,
    classify_status,
    forced_walk_allowed,
    forced_walk_key,
    load_index,
    resolve,
)
from tests.test_coa_drive import API_KEY, FIXTURES, FOLDER_ID, drive, entry

COMPANY_ID = "11111111-2222-3333-4444-555555555555"


class FakeRedis:
    """Enough async Redis for the cache and the H5 gate. `fail` makes every call raise."""

    def __init__(self, fail=False):
        self.store = {}
        self.ttls = {}
        self.fail = fail
        self.set_calls = 0

    async def get(self, key):
        if self.fail:
            raise RuntimeError("redis down")
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        if self.fail:
            raise RuntimeError("redis down")
        self.store[key] = value
        self.ttls[key] = ttl

    async def set(self, key, value, nx=False, ex=None):
        self.set_calls += 1
        if self.fail:
            raise RuntimeError(f"redis down; url=redis://x?key={API_KEY}")
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = ex
        return True


def response(status, body=None):
    return httpx.Response(status, json=body if body is not None else {"error": {"message": "nope"}})


def rate_limit_body(reason="userRateLimitExceeded"):
    return {"error": {"code": 403, "message": "Rate Limit Exceeded",
                      "errors": [{"reason": reason, "domain": "usageLimits"}]}}


def permission_body():
    return {"error": {"code": 403, "message": "The caller does not have permission",
                      "errors": [{"reason": "forbidden", "domain": "global"}]}}


def scripted(*statuses, requests=None):
    """A Drive that answers each request from ``statuses`` in order, then serves files.

    A tuple entry is ``(status, body)``. Anything after the script is a healthy
    single-file folder, which is how "it recovered on the second attempt" is expressed.
    """
    script = list(statuses)
    calls = []

    def handler(request):
        calls.append(request)
        if requests is not None:
            requests.append(request)
        if script:
            item = script.pop(0)
            status, body = item if isinstance(item, tuple) else (item, None)
            return response(status, body)
        return httpx.Response(200, json={"files": [entry(FIXTURES[0])]})

    return httpx.MockTransport(handler), calls


async def walk(transport):
    async with httpx.AsyncClient(transport=transport) as client:
        return await coa_drive.walk_folder(FOLDER_ID, API_KEY, client=client)


@pytest.fixture(autouse=True)
def _no_real_sleeping(monkeypatch):
    """The backoff arithmetic is asserted directly; nothing here should actually wait."""
    slept = []

    async def fake_backoff(attempt):
        slept.append(attempt)

    monkeypatch.setattr(coa_drive, "_backoff", fake_backoff)
    return slept


# ───────────────────────── H15: classification ─────────────────────────

class TestClassifyStatus:
    """The 403 split is the whole point: same status code, opposite handling."""

    def test_a_rate_limited_403_is_retryable(self):
        error = classify_status(response(403, rate_limit_body()))
        assert (error.reason, error.retryable) == ("rate_limited", True)

    @pytest.mark.parametrize("reason", [
        "userRateLimitExceeded", "rateLimitExceeded", "quotaExceeded", "USERRATELIMITEXCEEDED",
    ])
    def test_every_rate_limit_reason_drive_uses(self, reason):
        assert classify_status(response(403, rate_limit_body(reason))).retryable is True

    def test_a_permission_403_is_not_retryable(self):
        # Retrying a revoked share is pure latency, three times over.
        error = classify_status(response(403, permission_body()))
        assert (error.reason, error.retryable) == ("forbidden", False)

    def test_a_403_with_no_usable_body_is_treated_as_permission(self):
        # The conservative direction: a bare 403 gets the "go check your sharing"
        # message rather than three retries and a generic error.
        for body in ({}, {"error": "a string"}, {"error": {"errors": "not a list"}}):
            error = classify_status(response(403, body))
            assert (error.reason, error.retryable) == ("forbidden", False)

    def test_a_404_is_never_retried(self):
        error = classify_status(response(404))
        assert (error.reason, error.retryable) == ("not_found", False)

    @pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
    def test_too_many_requests_and_drive_being_unwell_are_retryable(self, status):
        error = classify_status(response(status))
        assert (error.reason, error.retryable) == ("unavailable", True)

    def test_an_unexpected_status_is_not_retried(self):
        assert classify_status(response(418)).retryable is False


class TestBackoffDelay:
    def test_grows_exponentially(self):
        assert backoff_delay(1, 1.0) < backoff_delay(2, 1.0) < backoff_delay(3, 1.0)

    def test_is_capped(self):
        assert backoff_delay(50, 1.0) == coa_drive.RETRY_MAX_DELAY_SECONDS

    def test_jitter_spreads_into_the_upper_half_of_the_step(self):
        # The walk lists 8 folders at once, so an un-jittered backoff has all 8 retry
        # in the same millisecond and rebuilds the burst that got them limited.
        full = backoff_delay(2, 1.0)
        assert backoff_delay(2, 0.0) == pytest.approx(full / 2)
        assert backoff_delay(2, 0.5) == pytest.approx(full * 0.75)

    def test_a_junk_jitter_draw_cannot_produce_a_negative_or_huge_delay(self):
        for draw in (-5.0, 0.0, 1.0, 99.0):
            assert 0 < backoff_delay(1, draw) <= coa_drive.RETRY_MAX_DELAY_SECONDS


# ───────────────────────── H15: retry behaviour ─────────────────────────

class TestRetry:
    @pytest.mark.asyncio
    async def test_a_rate_limited_folder_recovers_on_the_second_attempt(self):
        transport, calls = scripted((403, rate_limit_body()))
        result = await walk(transport)
        assert result.indexed == 1
        assert len(calls) == 2

    @pytest.mark.asyncio
    async def test_a_transient_5xx_recovers(self):
        transport, calls = scripted(503)
        assert (await walk(transport)).indexed == 1
        assert len(calls) == 2

    @pytest.mark.asyncio
    async def test_a_network_failure_is_the_most_retryable_thing_there_is(self):
        calls = []

        def handler(request):
            calls.append(request)
            if len(calls) < 3:
                raise httpx.ConnectTimeout("timed out")
            return httpx.Response(200, json={"files": [entry(FIXTURES[0])]})

        assert (await walk(httpx.MockTransport(handler))).indexed == 1
        assert len(calls) == 3

    @pytest.mark.asyncio
    async def test_retries_are_bounded(self, _no_real_sleeping):
        transport, calls = scripted(503, 503, 503, 503, 503)
        with pytest.raises(CoaDriveError) as exc:
            await walk(transport)
        assert exc.value.reason == "unavailable"
        assert len(calls) == coa_drive.MAX_DRIVE_ATTEMPTS
        assert _no_real_sleeping == [1, 2]

    @pytest.mark.asyncio
    async def test_a_permission_failure_is_not_retried_at_all(self):
        transport, calls = scripted((403, permission_body()))
        with pytest.raises(CoaDriveError) as exc:
            await walk(transport)
        assert exc.value.reason == "forbidden"
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_a_wrong_folder_link_is_not_retried_either(self):
        transport, calls = scripted(404)
        with pytest.raises(CoaDriveError) as exc:
            await walk(transport)
        assert exc.value.reason == "not_found"
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_a_retried_failure_still_carries_no_key_folder_id_or_url(self):
        # H3 + H11 survive the new code path: the retry classifier reads the Drive
        # error body, which is exactly where a leak would come from.
        body = {"error": {"code": 403, "message": f"denied {FOLDER_ID} key={API_KEY}",
                          "errors": [{"reason": "userRateLimitExceeded"}]}}
        transport, _ = scripted((403, body), (403, body), (403, body))
        with pytest.raises(CoaDriveError) as exc:
            await walk(transport)
        text = f"{exc.value} {exc.value.args} {exc.value.reason}"
        assert API_KEY not in text and FOLDER_ID not in text and "key=" not in text


# ───────────────────────── H15: the circuit breaker ─────────────────────────

class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


@pytest.fixture
def breaker_clock(monkeypatch):
    clock = FakeClock()
    monkeypatch.setattr(
        coa_drive, "_breakers", BreakerRegistry(coa_drive.COA_BREAKER_CONFIG, clock=clock))
    return clock


def dead_drive():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503, json={"error": {"message": "nope"}})

    return httpx.MockTransport(handler), calls


async def load(transport, **kw):
    async with httpx.AsyncClient(transport=transport) as client:
        return await load_index(COMPANY_ID, FOLDER_ID, api_key=API_KEY, client=client, **kw)


class TestBreaker:
    @pytest.mark.asyncio
    async def test_a_sustained_outage_stops_reaching_drive_at_all(self, breaker_clock):
        # The point: without this, a dead folder costs every visitor the full timeout
        # budget forever, because a failed walk never populates the cache.
        transport, calls = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(CoaDriveError):
                await load(transport)
        walked = len(calls)
        assert walked > 0

        for _ in range(5):
            with pytest.raises(CoaDriveError) as exc:
                await load(transport)
            assert exc.value.reason == "unavailable"
        assert len(calls) == walked          # not one further request to Drive

    @pytest.mark.asyncio
    async def test_recovery_is_automatic_after_the_cooldown(self, breaker_clock):
        transport, _ = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(CoaDriveError):
                await load(transport)
        with pytest.raises(CoaDriveError):
            await load(transport)           # open: fast-failed

        breaker_clock.advance(coa_drive.COA_BREAKER_CONFIG.reset_timeout_seconds + 1)
        healthy, _ = scripted()
        result, from_cache = await load(healthy)
        assert result.indexed == 1 and from_cache is False
        assert coa_drive.breaker_state(COMPANY_ID) == "closed"

    @pytest.mark.asyncio
    async def test_a_config_mistake_does_not_trip_the_breaker(self, breaker_clock):
        # `invalid_folder` never touches Drive. Counting it would open the breaker on a
        # bad paste and then hide the owner's fix behind a 60-second cooldown.
        transport, calls = scripted()
        for _ in range(6):
            with pytest.raises(CoaDriveError) as exc:
                async with httpx.AsyncClient(transport=transport) as client:
                    await load_index(COMPANY_ID, "not a folder id", api_key=API_KEY, client=client)
            assert exc.value.reason == "invalid_folder"
        assert coa_drive.breaker_state(COMPANY_ID) == "closed"
        assert calls == []

    @pytest.mark.asyncio
    async def test_a_warm_cache_still_serves_while_the_breaker_is_open(self, breaker_clock):
        # The degradation has to be "no fresh walks", not "no certificates".
        cache = FakeRedis()
        healthy, _ = scripted()
        await load(healthy, redis_client=cache)

        transport, calls = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(CoaDriveError):
                await load(transport, force=True)

        result, from_cache = await load(transport, redis_client=cache)
        assert from_cache is True and result.indexed == 1

    @pytest.mark.asyncio
    async def test_one_tenants_broken_folder_does_not_slow_another_down(self, breaker_clock):
        transport, _ = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(CoaDriveError):
                await load(transport)

        healthy, calls = scripted()
        async with httpx.AsyncClient(transport=healthy) as client:
            result, _ = await load_index(
                "other-company", FOLDER_ID, api_key=API_KEY, client=client)
        assert result.indexed == 1 and len(calls) == 1

    @pytest.mark.asyncio
    async def test_test_connection_reaches_drive_through_an_open_breaker(self, breaker_clock):
        # The owner has usually just fixed the sharing setting and is clicking to find
        # out whether it worked; "still broken" without looking would be a lie.
        transport, _ = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(CoaDriveError):
                await load(transport)
        assert coa_drive.breaker_state(COMPANY_ID) == "open"

        healthy, calls = scripted()
        result, _ = await load(healthy, force=True, bypass_breaker=True)
        assert result.indexed == 1
        assert len(calls) == 1
        # And an authoritative success beats waiting out the cooldown.
        assert coa_drive.breaker_state(COMPANY_ID) == "closed"


# ───────────────────────── H5: the forced-walk gate ─────────────────────────

class TestForcedWalkGate:
    @pytest.mark.asyncio
    async def test_concurrent_callers_produce_exactly_one_winner(self):
        cache = FakeRedis()
        verdicts = await asyncio.gather(
            *(forced_walk_allowed(COMPANY_ID, cache) for _ in range(25)))
        assert sum(verdicts) == 1

    @pytest.mark.asyncio
    async def test_a_second_forced_walk_inside_the_window_is_refused(self):
        cache = FakeRedis()
        assert await forced_walk_allowed(COMPANY_ID, cache) is True
        assert await forced_walk_allowed(COMPANY_ID, cache) is False

    @pytest.mark.asyncio
    async def test_the_gate_holds_across_workers(self):
        # THE property that makes this H5 rather than the in-process cooldown it
        # replaces: a second worker has an empty local timestamp map and must still be
        # refused, because the allowance lives in Redis.
        cache = FakeRedis()
        assert await forced_walk_allowed(COMPANY_ID, cache) is True
        coa_drive.reset_forced_walk_gate()          # a different worker process
        assert await forced_walk_allowed(COMPANY_ID, cache) is False

    @pytest.mark.asyncio
    async def test_the_allowance_expires_with_the_key(self):
        cache = FakeRedis()
        await forced_walk_allowed(COMPANY_ID, cache)
        assert cache.ttls[forced_walk_key(COMPANY_ID)] == coa_drive.FORCED_WALK_COOLDOWN_SECONDS

    @pytest.mark.asyncio
    async def test_one_tenant_cannot_spend_anothers_allowance(self):
        cache = FakeRedis()
        assert await forced_walk_allowed("company-a", cache) is True
        assert await forced_walk_allowed("company-b", cache) is True

    @pytest.mark.asyncio
    async def test_re_pointing_the_folder_does_not_hand_out_a_fresh_allowance(self):
        # The key is company-scoped, unlike the cache key: the point is bounding Drive
        # traffic per tenant, and a folder change must not be a way around it.
        assert "coa:forced:" in forced_walk_key(COMPANY_ID)
        assert FOLDER_ID not in forced_walk_key(COMPANY_ID)

    @pytest.mark.asyncio
    async def test_with_redis_down_the_gate_still_limits_this_worker(self):
        # H13's spirit applied to a throttle: a Redis outage degrades to "one forced
        # walk per worker per minute", never to "no limit at all".
        cache = FakeRedis(fail=True)
        assert await forced_walk_allowed(COMPANY_ID, cache) is True
        assert await forced_walk_allowed(COMPANY_ID, cache) is False

    @pytest.mark.asyncio
    async def test_a_refused_redis_gate_does_not_consume_the_local_allowance(self):
        # The local half is a check-then-commit, so a caller refused by Redis has not
        # silently spent this worker's slot as well.
        cache = FakeRedis()
        cache.store[forced_walk_key(COMPANY_ID)] = b"1"      # another worker holds it
        assert await forced_walk_allowed(COMPANY_ID, cache) is False
        cache.store.clear()
        assert await forced_walk_allowed(COMPANY_ID, cache) is True

    @pytest.mark.asyncio
    async def test_no_redis_client_at_all_falls_back_to_the_local_gate(self):
        assert await forced_walk_allowed(COMPANY_ID, None) is True
        assert await forced_walk_allowed(COMPANY_ID, None) is False


class TestResolveUsesTheGate:
    """End to end: the miss-refresh path (§6 step 5) is what H5 is protecting."""

    @pytest.mark.asyncio
    async def test_a_miss_against_a_cached_listing_refreshes_once_then_stops(self):
        cache = FakeRedis()
        requests = []
        transport, _ = scripted(requests=requests)

        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            warm = len(requests)
            coa_drive.reset_index_memo()        # force the Redis tier, not the memo

            first = await resolve(COMPANY_ID, FOLDER_ID, "ZZ.99Q999",
                                  redis_client=cache, api_key=API_KEY, client=client)
            after_first = len(requests)
            for _ in range(5):
                await resolve(COMPANY_ID, FOLDER_ID, "ZZ.99Q999",
                              redis_client=cache, api_key=API_KEY, client=client)

        assert first is None
        assert after_first > warm               # the first miss did refresh
        assert len(requests) == after_first     # the next five did not

    @pytest.mark.asyncio
    async def test_a_scanner_hammering_nonsense_cannot_walk_drive_repeatedly(self):
        cache = FakeRedis()
        requests = []
        transport, _ = scripted(requests=requests)

        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            coa_drive.reset_index_memo()
            baseline = len(requests)
            await asyncio.gather(*(
                resolve(COMPANY_ID, FOLDER_ID, f"NONSENSE{i}", redis_client=cache,
                        api_key=API_KEY, client=client)
                for i in range(30)))

        # 30 concurrent misses, one walk. A walk is 1 request for this single-folder
        # fixture; the real folder is 8.
        assert len(requests) - baseline == 1

    @pytest.mark.asyncio
    async def test_a_miss_against_a_listing_we_just_walked_is_not_refreshed(self):
        # The file genuinely is not there, and re-walking what we read a moment ago
        # cannot change that. This is the rule that removes most of the stampede
        # before the gate is even consulted.
        cache = FakeRedis()
        requests = []
        transport, _ = scripted(requests=requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await resolve(COMPANY_ID, FOLDER_ID, "ZZ.99Q999", redis_client=cache,
                          api_key=API_KEY, client=client)
        assert len(requests) == 1
