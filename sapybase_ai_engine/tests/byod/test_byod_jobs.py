"""Phase 5.1 test gate: BYOD background-job batch runner.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 5.1; rule E9 / §16.4):
    "Batch over many tenants (some slow/broken) completes, isolates failures,
     throttles." (route weekly_digest/lead_alerts/attribution/cron via
     get_tenant_db + per-tenant breaker + bounded concurrency, skip open-breaker
     tenants, isolate per-tenant failures.)

Pure unit tests — no DB, no Redis. The runner is injectable scheduling logic, so
a sleeping worker proves throttling and a raising worker proves isolation. Also
covers the ``tenant_breaker_open`` skip helper via a fake registry.
"""
from __future__ import annotations

import threading
import time

import pytest

import byod_engine
import byod_jobs
from byod_breaker import BreakerState


# ── run_tenant_batch: completeness + failure isolation ───────────────────────────
def test_all_succeed_reports_each_outcome():
    report = byod_jobs.run_tenant_batch(["a", "b", "c"], lambda cid: f"ok:{cid}")
    assert report.total == 3
    assert report.succeeded == 3
    assert report.failed == 0
    assert report.skipped == 0
    assert {o.company_id: o.value for o in report.outcomes} == {
        "a": "ok:a", "b": "ok:b", "c": "ok:c",
    }
    assert all(o.ok for o in report.outcomes)


def test_broken_tenant_is_isolated_batch_still_completes():
    """A worker raising for one tenant must NOT abort the batch or affect others
    (§16.4: isolate per-tenant failures)."""
    def worker(cid):
        if cid == "bad":
            raise RuntimeError("tenant DB exploded")
        return "sent"

    report = byod_jobs.run_tenant_batch(["good1", "bad", "good2"], worker)
    assert report.total == 3
    assert report.succeeded == 2  # good1 + good2 both ran to completion
    assert report.failed == 1
    assert report.skipped == 0
    bad = next(o for o in report.outcomes if o.company_id == "bad")
    assert bad.ok is False and bad.skipped is False
    assert bad.error == "RuntimeError"  # default sanitizer = class name only


def test_failure_reason_is_sanitized_not_raw():
    """E6: the recorded error is the sanitized reason, never the raw exception text
    (which could carry host/DSN/schema)."""
    def worker(cid):
        raise ValueError("postgres://secret@10.0.0.5:5432/prod connection refused")

    def sanitize(exc):
        return "tenant database error"

    report = byod_jobs.run_tenant_batch(["t1"], worker, sanitize=sanitize)
    assert report.failed == 1
    assert report.outcomes[0].error == "tenant database error"
    assert "secret" not in report.outcomes[0].error
    assert "10.0.0.5" not in report.outcomes[0].error


def test_every_tenant_failing_still_returns_full_report():
    report = byod_jobs.run_tenant_batch(
        ["a", "b", "c"], lambda cid: (_ for _ in ()).throw(RuntimeError("x"))
    )
    assert report.total == 3 and report.failed == 3 and report.succeeded == 0


def test_empty_batch_is_a_clean_noop():
    report = byod_jobs.run_tenant_batch([], lambda cid: "x")
    assert report.total == 0 and report.succeeded == 0
    assert report.failed == 0 and report.skipped == 0
    assert report.outcomes == []


# ── Bounded concurrency (throttle) ───────────────────────────────────────────────
def test_concurrency_is_bounded_by_max_concurrency():
    """No more than ``max_concurrency`` workers may run at once — a fleet of slow
    tenant DBs must not exhaust capacity (§16.4 'throttles')."""
    lock = threading.Lock()
    state = {"current": 0, "peak": 0}

    def slow_worker(cid):
        with lock:
            state["current"] += 1
            state["peak"] = max(state["peak"], state["current"])
        time.sleep(0.05)
        with lock:
            state["current"] -= 1
        return "ok"

    report = byod_jobs.run_tenant_batch(
        [f"t{i}" for i in range(20)], slow_worker, max_concurrency=3
    )
    assert report.succeeded == 20
    assert state["peak"] <= 3  # never exceeded the cap
    assert state["peak"] >= 2  # but did run in parallel (not serialized)


def test_one_slow_tenant_does_not_block_the_others():
    """A single hanging tenant occupies one worker slot; the rest still finish."""
    started = threading.Event()

    def worker(cid):
        if cid == "slow":
            started.set()
            time.sleep(0.3)
        return cid

    start = time.monotonic()
    report = byod_jobs.run_tenant_batch(
        ["slow", "f1", "f2", "f3", "f4"], worker, max_concurrency=5
    )
    elapsed = time.monotonic() - start
    assert report.succeeded == 5
    # Fast tenants finished concurrently with the slow one, not after it serially.
    assert elapsed < 0.3 + 0.2


def test_workers_count_capped_to_item_count():
    """max_concurrency larger than the work set must not crash or over-allocate."""
    report = byod_jobs.run_tenant_batch(["only"], lambda cid: "ok", max_concurrency=50)
    assert report.succeeded == 1


# ── Skip open-breaker tenants ────────────────────────────────────────────────────
def test_skip_predicate_excludes_tenant_and_worker_never_runs():
    """A tenant the skip predicate rejects (e.g. breaker OPEN) is recorded skipped
    and its worker is never invoked (§16.4: skip open-breaker tenants)."""
    ran = []

    def worker(cid):
        ran.append(cid)
        return "sent"

    report = byod_jobs.run_tenant_batch(
        ["a", "skipme", "b"], worker, skip=lambda cid: cid == "skipme"
    )
    assert report.skipped == 1
    assert report.succeeded == 2
    assert "skipme" not in ran
    skipped = next(o for o in report.outcomes if o.company_id == "skipme")
    assert skipped.skipped is True and skipped.ok is False


def test_flaky_skip_predicate_does_not_drop_the_tenant():
    """If the skip predicate itself errors, we must NOT skip — the connection is
    breaker-guarded and will fast-fail anyway (fail-soft, don't drop work)."""
    def bad_skip(cid):
        raise RuntimeError("breaker registry hiccup")

    report = byod_jobs.run_tenant_batch(["a", "b"], lambda cid: "ok", skip=bad_skip)
    assert report.succeeded == 2 and report.skipped == 0


def test_mixed_skip_success_and_failure_tally():
    def worker(cid):
        if cid == "bad":
            raise RuntimeError("boom")
        return "sent"

    report = byod_jobs.run_tenant_batch(
        ["ok1", "ok2", "bad", "skip1", "skip2"],
        worker,
        skip=lambda cid: cid.startswith("skip"),
    )
    assert report.total == 5
    assert report.succeeded == 2
    assert report.failed == 1
    assert report.skipped == 2


# ── max_concurrency_from_env ─────────────────────────────────────────────────────
def test_max_concurrency_default(monkeypatch):
    monkeypatch.delenv("BYOD_BATCH_MAX_CONCURRENCY", raising=False)
    assert byod_jobs.max_concurrency_from_env() == byod_jobs.DEFAULT_MAX_CONCURRENCY


def test_max_concurrency_valid_override(monkeypatch):
    monkeypatch.setenv("BYOD_BATCH_MAX_CONCURRENCY", "12")
    assert byod_jobs.max_concurrency_from_env() == 12


@pytest.mark.parametrize("bad", ["0", "-3", "abc", ""])
def test_max_concurrency_invalid_falls_back(monkeypatch, bad):
    monkeypatch.setenv("BYOD_BATCH_MAX_CONCURRENCY", bad)
    assert byod_jobs.max_concurrency_from_env(default=7) == 7


# ── byod_engine.tenant_breaker_open ──────────────────────────────────────────────
class _FakeRegistry:
    def __init__(self, mapping):
        self._mapping = mapping

    def breaker_state(self, company_id):
        return self._mapping.get(company_id)


def test_tenant_breaker_open_true_only_when_open():
    reg = _FakeRegistry({
        "open": BreakerState.OPEN,
        "half": BreakerState.HALF_OPEN,
        "closed": BreakerState.CLOSED,
    })
    assert byod_engine.tenant_breaker_open("open", registry=reg) is True
    # HALF_OPEN must be allowed through so a probe can recover the tenant.
    assert byod_engine.tenant_breaker_open("half", registry=reg) is False
    assert byod_engine.tenant_breaker_open("closed", registry=reg) is False


def test_tenant_breaker_open_unknown_tenant_not_skipped():
    reg = _FakeRegistry({})  # breaker_state -> None (no breaker yet)
    assert byod_engine.tenant_breaker_open("never-seen", registry=reg) is False


def test_tenant_breaker_open_fail_soft_on_error():
    class _BoomRegistry:
        def breaker_state(self, company_id):
            raise RuntimeError("registry down")

    # On doubt, don't skip — the connect attempt is itself breaker-guarded.
    assert byod_engine.tenant_breaker_open("x", registry=_BoomRegistry()) is False
