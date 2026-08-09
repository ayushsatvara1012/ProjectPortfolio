"""Spec finder Phase 1 - the two libraries must not touch each other (plan §9.1).

The 2026-08-08 draft listed three collisions to FIX inside a merged engine. D4 made
the spec finder its own module instead, so each one now cannot occur - but "cannot
occur" is a property of how the module is written, and the next person to reach for
a shared helper needs a test that fails rather than a comment they may not read.

Three properties, one per collision:

  * **S1** - a spec folder whose sharing is revoked must not fast-fail that
    company's CERTIFICATE lookups for the cooldown. Separate breaker registries.
  * **S2** - a spec re-walk must not consume the certificate re-walk allowance.
    A visitor searching specifications could otherwise silently stop a customer's
    certificate from being found after an upload.
  * **S3** - the two listings must not evict each other. Separate memos.

This is also the §9.2 tripwire from the other side: every assertion here would break
if somebody merged the modules back together without keying the shared state.
"""
import httpx
import pytest

from byod_breaker import BreakerRegistry
from services import coa_drive, spec_drive

COMPANY_ID = "11111111-2222-3333-4444-555555555555"
COA_FOLDER = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"
SPEC_FOLDER = "1KCRfrRQ9pLmXt4vB2nHy7WqZs3EdCa6T"
API_KEY = "AIzaTESTKEY0000000000000000000000000000"


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True


def file_entry(name):
    return {
        "id": f"id-{name}",
        "name": name,
        "mimeType": "application/pdf",
        "modifiedTime": "2026-07-01T09:00:00.000Z",
        "webViewLink": f"https://drive.google.com/file/d/id-{name}/view",
    }


def healthy_drive(name="Acetone_USP_Spec.pdf"):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"files": [file_entry(name)]})

    return httpx.MockTransport(handler), calls


def dead_drive():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503, json={"error": {"message": "nope"}})

    return httpx.MockTransport(handler), calls


@pytest.fixture(autouse=True)
def _no_real_sleeping(monkeypatch):
    """The retry backoff is asserted elsewhere; nothing here should actually wait."""
    async def fake_backoff(attempt):
        return None

    monkeypatch.setattr(coa_drive, "_backoff", fake_backoff)


async def load_spec(transport, **kw):
    async with httpx.AsyncClient(transport=transport) as client:
        return await spec_drive.load_index(
            COMPANY_ID, SPEC_FOLDER, api_key=API_KEY, client=client, **kw)


async def load_coa(transport, **kw):
    async with httpx.AsyncClient(transport=transport) as client:
        return await coa_drive.load_index(
            COMPANY_ID, COA_FOLDER, api_key=API_KEY, client=client, **kw)


# ───────────────────────────── S1: the breaker ─────────────────────────────

class TestBreakerIsolation:
    @pytest.mark.asyncio
    async def test_a_dead_spec_folder_does_not_open_the_certificate_breaker(self):
        transport, _ = dead_drive()
        for _ in range(spec_drive.SPEC_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(spec_drive.SpecDriveError):
                await load_spec(transport)

        assert spec_drive.breaker_state(COMPANY_ID) == "open"
        assert coa_drive.breaker_state(COMPANY_ID) == "closed"

    @pytest.mark.asyncio
    async def test_certificates_still_reach_drive_while_the_spec_folder_is_dead(self):
        # The live consequence of S1: a customer holding a real drum must still get
        # their certificate while the owner's spec folder is misconfigured.
        transport, _ = dead_drive()
        for _ in range(spec_drive.SPEC_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(spec_drive.SpecDriveError):
                await load_spec(transport)

        healthy, calls = healthy_drive()
        result, from_cache = await load_coa(healthy)
        assert result.indexed == 1 and from_cache is False
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_the_registries_are_not_the_same_object(self):
        # The cheapest possible statement of the whole decision.
        assert spec_drive._breakers is not coa_drive._breakers

    @pytest.mark.asyncio
    async def test_resetting_one_breaker_does_not_reset_the_other(self):
        transport, _ = dead_drive()
        for _ in range(coa_drive.COA_BREAKER_CONFIG.failure_threshold):
            with pytest.raises(coa_drive.CoaDriveError):
                await load_coa(transport)
        assert coa_drive.breaker_state(COMPANY_ID) == "open"

        spec_drive.reset_breakers()
        assert coa_drive.breaker_state(COMPANY_ID) == "open"


# ────────────────────────── S2: the forced-walk gate ──────────────────────────

class TestForcedWalkIsolation:
    def test_the_two_gates_use_different_keys(self):
        assert spec_drive.forced_walk_key(COMPANY_ID) != coa_drive.forced_walk_key(COMPANY_ID)
        assert spec_drive.forced_walk_key(COMPANY_ID).startswith("spec:")
        assert coa_drive.forced_walk_key(COMPANY_ID).startswith("coa:")

    @pytest.mark.asyncio
    async def test_a_spec_re_walk_does_not_consume_the_certificate_allowance(self):
        # S2's live consequence: a visitor searching specifications could otherwise
        # silently stop a customer's certificate from being found after an upload.
        cache = FakeRedis()
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is True
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is False
        assert await coa_drive.forced_walk_allowed(COMPANY_ID, cache) is True

    @pytest.mark.asyncio
    async def test_each_gate_still_holds_within_its_own_library(self):
        cache = FakeRedis()
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is True
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is False

    @pytest.mark.asyncio
    async def test_the_gate_holds_across_workers(self):
        # The property that makes this H5 rather than a process-local cooldown: a
        # second worker has an empty local map and must still be refused.
        cache = FakeRedis()
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is True
        spec_drive.reset_forced_walk_gate()
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, cache) is False

    @pytest.mark.asyncio
    async def test_a_redis_outage_degrades_to_the_local_gate_not_to_no_gate(self):
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, None) is True
        assert await spec_drive.forced_walk_allowed(COMPANY_ID, None) is False


# ──────────────────────────── S3: the cache and memo ────────────────────────────

class TestCacheIsolation:
    def test_the_two_cache_keys_cannot_collide(self):
        # Even when an owner pastes the SAME folder into both fields, which is the
        # one case a folder-scoped key alone would not survive.
        assert spec_drive.cache_key(COMPANY_ID, COA_FOLDER) != coa_drive.cache_key(
            COMPANY_ID, COA_FOLDER)
        assert spec_drive.cache_key(COMPANY_ID, SPEC_FOLDER).startswith("spec:folder:")

    def test_the_memos_are_not_the_same_object(self):
        assert spec_drive._index_memo is not coa_drive._index_memo

    @pytest.mark.asyncio
    async def test_both_listings_stay_warm_at_the_same_time(self):
        # S3: with one shared memo of 8 entries, two libraries per tenant kept only
        # about four tenants warm, and each new spec listing evicted a certificate
        # listing that was about to be needed.
        spec_transport, spec_calls = healthy_drive("Acetone_USP_Spec.pdf")
        coa_transport, coa_calls = healthy_drive("100RG_100.26R016_ACETONE RG.pdf")

        await load_spec(spec_transport)
        await load_coa(coa_transport)

        _, spec_cached = await load_spec(spec_transport)
        _, coa_cached = await load_coa(coa_transport)
        assert spec_cached is True and coa_cached is True
        assert len(spec_calls) == 1 and len(coa_calls) == 1

    @pytest.mark.asyncio
    async def test_filling_the_spec_memo_does_not_evict_the_certificate_listing(self):
        coa_transport, coa_calls = healthy_drive("100RG_100.26R016_ACETONE RG.pdf")
        await load_coa(coa_transport)

        spec_transport, _ = healthy_drive("Acetone_USP_Spec.pdf")
        for i in range(spec_drive.INDEX_MEMO_MAX_ENTRIES + 3):
            async with httpx.AsyncClient(transport=spec_transport) as client:
                await spec_drive.load_index(
                    f"company-{i}", SPEC_FOLDER, api_key=API_KEY, client=client)

        _, from_cache = await load_coa(coa_transport)
        assert from_cache is True
        assert len(coa_calls) == 1

    @pytest.mark.asyncio
    async def test_the_spec_memo_is_still_bounded(self):
        spec_transport, _ = healthy_drive()
        for i in range(spec_drive.INDEX_MEMO_MAX_ENTRIES + 3):
            async with httpx.AsyncClient(transport=spec_transport) as client:
                await spec_drive.load_index(
                    f"company-{i}", SPEC_FOLDER, api_key=API_KEY, client=client)
        assert len(spec_drive._index_memo) == spec_drive.INDEX_MEMO_MAX_ENTRIES

    @pytest.mark.asyncio
    async def test_a_cached_spec_listing_round_trips_through_redis(self):
        # The codec is shared with COA, so this is really asserting that sharing it
        # is safe: same encoder, different key, no confusion between the two.
        cache = FakeRedis()
        transport, calls = healthy_drive()
        await load_spec(transport, redis_client=cache)
        spec_drive.reset_index_memo()

        result, from_cache = await load_spec(transport, redis_client=cache)
        assert from_cache is True and result.indexed == 1
        assert len(calls) == 1
        assert spec_drive.cache_key(COMPANY_ID, SPEC_FOLDER) in cache.store


# ──────────────────────────────── the resolver ────────────────────────────────

class TestResolve:
    @pytest.mark.asyncio
    async def test_a_hit_returns_rows_without_re_walking(self):
        transport, calls = healthy_drive()
        async with httpx.AsyncClient(transport=transport) as client:
            found = await spec_drive.resolve(
                COMPANY_ID, SPEC_FOLDER, "acetone", api_key=API_KEY, client=client)
        assert found.status == "ok" and len(found.documents) == 1
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_a_miss_against_a_cached_listing_re_walks_once(self):
        # What makes a sheet uploaded two minutes ago findable, and why there is no
        # cron job.
        transport, calls = healthy_drive()
        await load_spec(transport)                       # warms the memo

        async with httpx.AsyncClient(transport=transport) as client:
            found = await spec_drive.resolve(
                COMPANY_ID, SPEC_FOLDER, "zylophonium", api_key=API_KEY, client=client)
        assert found.status == "empty"
        assert len(calls) == 2

    @pytest.mark.asyncio
    async def test_a_second_miss_inside_the_window_does_not_re_walk(self):
        transport, calls = healthy_drive()
        await load_spec(transport)

        for _ in range(3):
            async with httpx.AsyncClient(transport=transport) as client:
                await spec_drive.resolve(
                    COMPANY_ID, SPEC_FOLDER, "zylophonium", api_key=API_KEY, client=client)
        assert len(calls) == 2

    @pytest.mark.asyncio
    async def test_a_too_broad_query_never_spends_a_drive_walk(self):
        # The trap the resolver's `status != "empty"` check exists for: re-walking on
        # anything but an empty result would spend a Drive call on every `spec` a
        # visitor types.
        names = [f"Product{i}_Spec.pdf" for i in range(300)]

        def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"files": [file_entry(n) for n in names]})

        calls = []
        transport = httpx.MockTransport(handler)
        await load_spec(transport)

        async with httpx.AsyncClient(transport=transport) as client:
            found = await spec_drive.resolve(
                COMPANY_ID, SPEC_FOLDER, "spec", api_key=API_KEY, client=client)
        assert found.status == "too_broad"
        assert len(calls) == 1
