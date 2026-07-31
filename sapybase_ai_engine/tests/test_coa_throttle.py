"""COA lookup throttle — coa-confidential-access §5 (C4, C7, C8) and §10.

Three misses in five minutes disables the lookup for fifteen. The properties that
matter are not the arithmetic:

* **The lockout is enforced by the BACKEND.** The panel disables its field, but a
  disabled input is presentation and anyone can undo it from devtools, so the last
  block of this file drives the endpoint itself.
* **A release does not clear the counter.** Anyone probing this library holds one
  certificate they know exists, so a counter reset by a success would be reset by
  alternating one known-good query with each guess.
* **Redis down degrades open** (C8): a soft control on a feature whose real security
  property is uniqueness must never cost a customer their certificate.
* **The IP counter is a backstop, not the primary axis.** It has to trip on its own
  for a visitor rotating their `visitorId`, and to be loose enough that a shared
  office never reaches it.
"""
import json
from datetime import date, timedelta

import pytest

from services import coa_drive, coa_throttle
from services.coa_throttle import (
    IP_MISS_LIMIT,
    LEDGER_TTL_SECONDS,
    LOCKOUT_SECONDS,
    MISS_LEDGER_DAYS,
    MISS_LIMIT,
    MISS_WINDOW_SECONDS,
    ledger_key,
    lock_key,
    lockout_seconds,
    miss_key,
    recent_misses,
    record_miss,
)
from tests.test_coa_endpoint import (
    AMBIGUOUS,
    COMPANY_ID,
    RELEASES,
    company,
    widget_get,
)

VISITOR = "8f14e45f-ceea-467a-9f1a-1b2c3d4e5f60"
OTHER_VISITOR = "1c9d7e22-aaaa-4bbb-8ccc-9d0e1f2a3b4c"
IP = "203.0.113.7"


class FakeRedis:
    """Enough async Redis for the throttle. ``fail`` makes every call raise."""

    def __init__(self, fail=False):
        self.store = {}
        self.ttls = {}
        self.fail = fail

    def _check(self):
        if self.fail:
            raise RuntimeError("redis down")

    async def ttl(self, key):
        self._check()
        if key not in self.store:
            return -2
        return self.ttls.get(key, -1)

    async def incr(self, key):
        self._check()
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    async def expire(self, key, seconds):
        self._check()
        self.ttls[key] = seconds
        return True

    async def set(self, key, value, nx=False, ex=None):
        self._check()
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = ex
        return True

    async def delete(self, key):
        self._check()
        self.store.pop(key, None)
        self.ttls.pop(key, None)
        return 1

    async def get(self, key):
        self._check()
        return self.store.get(key)

    async def setex(self, key, seconds, value):
        self._check()
        self.store[key] = value
        self.ttls[key] = seconds
        return True

    async def mget(self, keys):
        self._check()
        return [self.store.get(k) for k in keys]


@pytest.fixture(autouse=True)
def _clean_local_state():
    coa_throttle.reset_local_state()
    yield
    coa_throttle.reset_local_state()


async def misses(n, *, visitor=VISITOR, ip=IP, redis=None, now=0.0, company_id=COMPANY_ID,
                 today=None):
    """Record ``n`` misses at one instant and return what the last one earned."""
    earned = 0
    for _ in range(n):
        earned = await record_miss(company_id, visitor, ip, redis_client=redis, now=now,
                                   today=today)
    return earned


# ───────────────────────────────── the counters ─────────────────────────────────

class TestVisitorCounter:
    @pytest.mark.asyncio
    async def test_a_fresh_visitor_is_open(self):
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=0.0) == 0

    @pytest.mark.asyncio
    async def test_the_third_miss_inside_the_window_locks(self):
        assert await misses(MISS_LIMIT - 1) == 0
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=0.0) == 0
        # The miss that trips it says so immediately, so the visitor learns on the
        # attempt that earned it rather than on the next one they waste.
        assert await misses(1) == LOCKOUT_SECONDS
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=0.0) == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_the_block_outlives_the_miss_window(self):
        # The counting window is 5 minutes and the lockout is 15: expiring the
        # counter must not release the lock it produced.
        await misses(MISS_LIMIT)
        later = MISS_WINDOW_SECONDS + 1
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=later) > 0

    @pytest.mark.asyncio
    async def test_the_lock_lifts_on_its_own(self):
        await misses(MISS_LIMIT)
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=LOCKOUT_SECONDS + 1) == 0

    @pytest.mark.asyncio
    async def test_misses_spread_past_the_window_do_not_accumulate(self):
        # A customer who mistypes twice today and twice next week is not a guesser.
        await misses(MISS_LIMIT - 1, now=0.0)
        assert await misses(MISS_LIMIT - 1, now=MISS_WINDOW_SECONDS + 1) == 0
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, now=MISS_WINDOW_SECONDS + 1) == 0

    @pytest.mark.asyncio
    async def test_a_release_does_not_clear_the_counter(self):
        # Deliberate (§11 residual 3). A success between guesses is exactly what
        # someone holding one genuine drum has, so resetting on one would hand the
        # walker of a batch sequence an unlimited allowance.
        await misses(MISS_LIMIT - 1)
        # …a certificate is released here; the endpoint records nothing…
        assert await misses(1) == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_one_visitor_never_locks_another_out(self):
        await misses(MISS_LIMIT, visitor=VISITOR, ip=IP)
        assert await lockout_seconds(COMPANY_ID, OTHER_VISITOR, "198.51.100.4", now=0.0) == 0

    @pytest.mark.asyncio
    async def test_one_company_never_locks_out_another_companys_visitor(self):
        await misses(MISS_LIMIT, company_id=COMPANY_ID)
        assert await lockout_seconds("99999999-0000-0000-0000-000000000000", VISITOR, IP, now=0.0) == 0


class TestIpBackstop:
    @pytest.mark.asyncio
    async def test_it_trips_independently_of_the_visitor_counter(self):
        # A script clearing `visitorId` between attempts never reaches the primary
        # counter — every request looks like a first-time visitor. This is the gate
        # that catches it.
        for i in range(IP_MISS_LIMIT):
            earned = await record_miss(COMPANY_ID, f"fresh-visitor-{i}", IP, now=0.0)
        assert earned == LOCKOUT_SECONDS
        assert await lockout_seconds(COMPANY_ID, "another-brand-new-visitor", IP, now=0.0) > 0

    @pytest.mark.asyncio
    async def test_it_is_loose_enough_for_a_shared_office(self):
        # Well past the visitor limit and nowhere near the IP one: colleagues behind
        # one NAT address are the bystanders this is written not to punish.
        for i in range(MISS_LIMIT * 3):
            await record_miss(COMPANY_ID, f"colleague-{i}", IP, now=0.0)
        assert await lockout_seconds(COMPANY_ID, "colleague-next", IP, now=0.0) == 0

    @pytest.mark.asyncio
    async def test_a_missing_visitor_id_still_leaves_the_ip_gate(self):
        # An older cached embed sends no visitor_id. That must not be a way to opt
        # out of the throttle entirely.
        for _ in range(IP_MISS_LIMIT):
            earned = await record_miss(COMPANY_ID, None, IP, now=0.0)
        assert earned == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_no_identity_at_all_is_a_no_op_rather_than_an_error(self):
        assert await record_miss(COMPANY_ID, None, None, now=0.0) == 0
        assert await lockout_seconds(COMPANY_ID, None, None, now=0.0) == 0


class TestTunables:
    """The limits are env-overridable so they can be loosened for testing and retuned
    against Phase E's real numbers. The safety that matters is that an unset or junk
    environment lands on the plan's values rather than on zero."""

    def test_the_shipped_defaults_are_the_plan_values(self, monkeypatch):
        for name in ("COA_MISS_LIMIT", "COA_MISS_WINDOW_SECONDS", "COA_LOCKOUT_SECONDS",
                     "COA_IP_MISS_LIMIT", "COA_IP_MISS_WINDOW_SECONDS"):
            monkeypatch.delenv(name, raising=False)
        assert coa_throttle._tunable("COA_MISS_LIMIT", 3) == 3
        assert coa_throttle._tunable("COA_LOCKOUT_SECONDS", 900) == 900

    def test_an_override_is_read(self, monkeypatch):
        monkeypatch.setenv("COA_MISS_LIMIT", "50")
        assert coa_throttle._tunable("COA_MISS_LIMIT", 3) == 50

    def test_junk_falls_back_rather_than_raising(self, monkeypatch):
        # A typo in a dashboard env var must not stop the app booting.
        monkeypatch.setenv("COA_MISS_LIMIT", "three")
        assert coa_throttle._tunable("COA_MISS_LIMIT", 3) == 3

    def test_zero_or_negative_cannot_take_the_gate_to_nothing(self, monkeypatch):
        # `0` would mean "locked out before your first attempt", which is the one
        # value an override must never be able to produce by accident.
        monkeypatch.setenv("COA_MISS_LIMIT", "0")
        assert coa_throttle._tunable("COA_MISS_LIMIT", 3) == 3
        monkeypatch.setenv("COA_MISS_LIMIT", "-5")
        assert coa_throttle._tunable("COA_MISS_LIMIT", 3) == 3


class TestKeys:
    def test_identities_are_hashed_into_the_key(self):
        # `visitor_id` comes from the browser, so raw it could carry a megabyte, or a
        # `:` that walks into another company's key space. Hashing also keeps a raw
        # IP out of Redis for free.
        assert VISITOR not in miss_key(COMPANY_ID, VISITOR)
        assert IP not in miss_key(COMPANY_ID, IP, ip=True)
        assert VISITOR not in lock_key(COMPANY_ID, VISITOR)

    def test_a_hostile_identity_cannot_grow_or_escape_the_key(self):
        hostile = "x" * 100_000 + ":coa:lock:v:other-company:deadbeef"
        key = lock_key(COMPANY_ID, hostile)
        assert len(key) < 120
        assert key.startswith(f"coa:lock:v:{COMPANY_ID}:")

    def test_the_visitor_and_ip_axes_never_share_a_key(self):
        assert miss_key(COMPANY_ID, VISITOR) != miss_key(COMPANY_ID, VISITOR, ip=True)
        assert miss_key(COMPANY_ID, VISITOR) != lock_key(COMPANY_ID, VISITOR)


# ───────────────────────────────── Redis (C8) ─────────────────────────────────

class TestRedisTier:
    @pytest.mark.asyncio
    async def test_the_lock_is_shared_across_workers(self):
        # The whole reason there is a Redis tier: a lockout held only in one worker's
        # memory is escaped by the next request landing on a different worker.
        redis = FakeRedis()
        await misses(MISS_LIMIT, redis=redis)
        coa_throttle.reset_local_state()      # a different worker, with no memory of it
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, redis_client=redis, now=0.0) == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_the_shared_counter_survives_a_worker_that_never_saw_the_misses(self):
        redis = FakeRedis()
        await misses(MISS_LIMIT - 1, redis=redis)
        coa_throttle.reset_local_state()
        assert await misses(1, redis=redis) == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_a_dead_redis_never_raises_and_never_invents_a_lockout(self):
        # C8 — degrade OPEN. The counters are a soft control; the security property
        # is uniqueness, and an outage must cost a throttle, not a certificate.
        redis = FakeRedis(fail=True)
        assert await record_miss(COMPANY_ID, VISITOR, IP, redis_client=redis, now=0.0) == 0
        assert await lockout_seconds(COMPANY_ID, VISITOR, IP, redis_client=redis, now=0.0) == 0

    @pytest.mark.asyncio
    async def test_a_dead_redis_still_leaves_the_in_process_counter(self):
        # …but not to "no limit at all" (C8): the fallback degrades to a few tries
        # per worker rather than an open door.
        redis = FakeRedis(fail=True)
        assert await misses(MISS_LIMIT, redis=redis) == LOCKOUT_SECONDS

    @pytest.mark.asyncio
    async def test_a_missing_ttl_reads_as_unlocked_not_as_forever(self):
        # A key we always write with an expiry answering -1 is a corrupted state, and
        # "locked forever" is the wrong reading of it.
        redis = FakeRedis()
        redis.store[lock_key(COMPANY_ID, VISITOR)] = b"1"
        assert await lockout_seconds(COMPANY_ID, VISITOR, None, redis_client=redis, now=0.0) == 0


# ───────────────────────── the owner's ledger (§8, Phase E) ─────────────────────────

DAY = date(2026, 7, 30)


class TestOwnerLedger:
    """The tripwire. The throttle makes a guesser slow; this is what makes them visible.

    Two properties carry it: the count is per COMPANY rather than per visitor, so
    someone clearing their `visitorId` between attempts still accumulates in one place;
    and an unreadable counter reports ``None`` rather than 0, because "nobody is
    guessing at your batch numbers" is the one thing this must never say falsely.
    """

    @pytest.mark.asyncio
    async def test_refused_lookups_are_counted_for_the_owner(self):
        redis = FakeRedis()
        await misses(2, redis=redis, today=DAY)
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 2

    @pytest.mark.asyncio
    async def test_a_visitor_rotating_their_id_still_accumulates_in_one_place(self):
        # The primary counter never sees this person twice; the ledger sees all of it,
        # which is the whole reason the owner's view is worth more than the control.
        redis = FakeRedis()
        for i in range(6):
            await record_miss(COMPANY_ID, f"fresh-{i}", IP, redis_client=redis, now=0.0, today=DAY)
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 6

    @pytest.mark.asyncio
    async def test_the_window_rolls(self):
        redis = FakeRedis()
        await misses(1, redis=redis, today=DAY - timedelta(days=MISS_LEDGER_DAYS - 1))
        await misses(1, redis=redis, today=DAY - timedelta(days=MISS_LEDGER_DAYS))
        # The oldest day inside the window counts; the one that fell out does not.
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 1

    @pytest.mark.asyncio
    async def test_a_quiet_week_is_zero_and_says_so(self):
        # Distinct from `None` on purpose: this is the reassuring answer, and it is
        # only reassuring because the unknown case does not borrow it.
        assert await recent_misses(COMPANY_ID, redis_client=FakeRedis(), today=DAY) == 0

    @pytest.mark.asyncio
    async def test_no_redis_is_unknown_rather_than_none_seen(self):
        assert await recent_misses(COMPANY_ID, redis_client=None, today=DAY) is None

    @pytest.mark.asyncio
    async def test_a_dead_redis_is_unknown_rather_than_none_seen(self):
        assert await recent_misses(COMPANY_ID, redis_client=FakeRedis(fail=True), today=DAY) is None

    @pytest.mark.asyncio
    async def test_recording_never_raises_when_redis_is_down(self):
        # Same C8 rule as the counters: the ledger is a report, and a report must
        # never cost a visitor their certificate.
        redis = FakeRedis(fail=True)
        assert await record_miss(COMPANY_ID, VISITOR, IP, redis_client=redis, now=0.0,
                                 today=DAY) == 0

    @pytest.mark.asyncio
    async def test_one_companys_probing_never_shows_in_anothers_report(self):
        redis = FakeRedis()
        await misses(3, redis=redis, today=DAY)
        assert await recent_misses("99999999-0000-0000-0000-000000000000",
                                   redis_client=redis, today=DAY) == 0

    @pytest.mark.asyncio
    async def test_the_days_expire_on_their_own(self):
        # No table (D9), so the window has to be enforced by the TTL rather than by
        # anything sweeping up after it.
        redis = FakeRedis()
        await misses(1, redis=redis, today=DAY)
        assert redis.ttls[ledger_key(COMPANY_ID, DAY)] == LEDGER_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_the_real_clients_bytes_are_read_as_numbers(self):
        # `decode_responses=False`, so a day written by a previous process comes back
        # as `b"12"` — which `int()` refuses outright rather than misreading.
        redis = FakeRedis()
        redis.store[ledger_key(COMPANY_ID, DAY)] = b"12"
        redis.store[ledger_key(COMPANY_ID, DAY - timedelta(days=1))] = "3"
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 15

    @pytest.mark.asyncio
    async def test_a_junk_day_is_skipped_rather_than_raised(self):
        redis = FakeRedis()
        redis.store[ledger_key(COMPANY_ID, DAY)] = b"not-a-number"
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 0

    @pytest.mark.asyncio
    async def test_reading_the_report_does_not_count_as_probing(self):
        redis = FakeRedis()
        await recent_misses(COMPANY_ID, redis_client=redis, today=DAY)
        await lockout_seconds(COMPANY_ID, VISITOR, IP, redis_client=redis, now=0.0)
        assert await recent_misses(COMPANY_ID, redis_client=redis, today=DAY) == 0

    def test_the_ledger_key_carries_no_visitor_identity(self):
        # The owner gets a count, never a list of who missed — surfacing that would be
        # a privacy decision (L1), not a panel row.
        key = ledger_key(COMPANY_ID, DAY)
        assert VISITOR not in key
        assert IP not in key
        assert key == f"coa:missday:{COMPANY_ID}:2026-07-30"


# ───────────────────────── the gate, through the endpoint ─────────────────────────

class TestEndpointEnforcesTheLockout:
    """§10 — asserted against the endpoint, because the disabled field is only paint."""

    def test_three_refusals_lock_the_lookup(self, monkeypatch):
        for _ in range(MISS_LIMIT - 1):
            assert widget_get(monkeypatch, query=AMBIGUOUS, reset_throttle=False).status_code == 200
        resp = widget_get(monkeypatch, query=AMBIGUOUS, reset_throttle=False)
        assert resp.status_code == 429
        assert resp.json()["detail"]["code"] == "COA_LOCKED_OUT"

    def test_the_429_carries_the_window_the_panel_re_enables_on(self, monkeypatch):
        for _ in range(MISS_LIMIT):
            resp = widget_get(monkeypatch, query=AMBIGUOUS, reset_throttle=False)
        assert resp.json()["detail"]["retry_after"] == LOCKOUT_SECONDS

    def test_a_locked_out_visitor_cannot_get_a_certificate_they_could_name(self, monkeypatch):
        # The point of the whole file: the backend refuses regardless of what the
        # interface shows, and even for a query that would have resolved perfectly.
        for _ in range(MISS_LIMIT):
            widget_get(monkeypatch, query=AMBIGUOUS, reset_throttle=False)
        resp = widget_get(monkeypatch, query=RELEASES, reset_throttle=False)
        assert resp.status_code == 429
        assert "results" not in resp.json()

    def test_the_lockout_body_still_names_nothing_about_the_library(self, monkeypatch):
        for _ in range(MISS_LIMIT):
            resp = widget_get(monkeypatch, query=AMBIGUOUS, reset_throttle=False)
        body = json.dumps(resp.json()).lower()
        assert "support" in body      # it says what to do next, and only that
        for leak in ("batch", "acetone", "found", "match", "certificates"):
            assert leak not in body

    def test_a_drive_outage_is_not_a_miss(self, monkeypatch):
        # An outage is our failure. Counting it would lock out the customers who kept
        # trying during it, exactly when they most need the handoff.
        for _ in range(MISS_LIMIT + 1):
            assert widget_get(monkeypatch, status=403, reset_throttle=False).status_code == 503
        # H15's breaker is now open for this company, which is a different gate with
        # its own cooldown — reset it, or this asserts the breaker rather than the
        # throttle.
        coa_drive.reset_breakers()
        assert widget_get(monkeypatch, query=RELEASES, reset_throttle=False).status_code == 200

    def test_an_unconfigured_bot_is_not_a_miss(self, monkeypatch):
        # Nothing was looked up, so nothing was missed — and a company that has not
        # set a folder yet must not be able to lock its own visitors out.
        for _ in range(MISS_LIMIT + 1):
            widget_get(monkeypatch, comp=company(pack_overrides={}), reset_throttle=False)
        assert widget_get(monkeypatch, query=RELEASES, reset_throttle=False).status_code == 200

    def test_a_release_does_not_spend_an_attempt(self, monkeypatch):
        for _ in range(MISS_LIMIT + 2):
            assert widget_get(monkeypatch, query=RELEASES, reset_throttle=False).status_code == 200

    def test_the_visitor_id_is_what_the_lockout_follows(self, monkeypatch):
        # sessionId rotates on "New conversation"; visitorId does not. A cooldown
        # bound to the session would survive exactly one click.
        for _ in range(MISS_LIMIT):
            widget_get(monkeypatch, query=AMBIGUOUS, visitor="visitor-a", reset_throttle=False)
        assert widget_get(monkeypatch, query=RELEASES, visitor="visitor-a",
                          reset_throttle=False).status_code == 429
        assert widget_get(monkeypatch, query=RELEASES, visitor="visitor-b",
                          reset_throttle=False).status_code == 200
