"""Tests for the Action Center worklist (pure helpers in action_center.py)."""
from datetime import datetime, timezone, timedelta

from action_center import (
    reference_age_hours,
    attention_priority,
    urgency_level,
    attention_reason,
    build_action_queue,
)

NOW = datetime(2026, 6, 3, 12, 0, 0, tzinfo=timezone.utc)


def _ago(hours):
    return NOW - timedelta(hours=hours)


class TestReferenceAgeHours:
    def test_new_uses_created_at(self):
        assert reference_age_hours(_ago(10), None, "new", NOW) == 10.0

    def test_contacted_uses_status_updated_at(self):
        assert reference_age_hours(_ago(100), _ago(5), "contacted", NOW) == 5.0

    def test_contacted_without_status_ts_falls_back_to_created(self):
        assert reference_age_hours(_ago(30), None, "contacted", NOW) == 30.0

    def test_missing_and_future_are_zero(self):
        assert reference_age_hours(None, None, "new", NOW) == 0.0
        assert reference_age_hours(_ago(-5), None, "new", NOW) == 0.0  # future


class TestPriorityOrdering:
    def test_band_dominates_at_equal_status_and_age(self):
        # With the same status + age, higher band always ranks higher.
        assert (attention_priority("HOT", "new", 10)
                > attention_priority("WARM", "new", 10)
                > attention_priority("COLD", "new", 10))

    def test_urgent_uncontacted_warm_can_outrank_idle_hot(self):
        # Intended: a WARM lead uncontacted for a week beats a HOT lead you just
        # contacted — the queue surfaces what needs action, not just raw value.
        assert attention_priority("WARM", "new", 168) > attention_priority("HOT", "contacted", 0)

    def test_new_outranks_contacted_same_band_same_age(self):
        assert attention_priority("HOT", "new", 10) > attention_priority("HOT", "contacted", 10)

    def test_age_increases_priority_but_is_capped(self):
        assert attention_priority("WARM", "new", 200) == attention_priority("WARM", "new", 168)
        assert attention_priority("WARM", "new", 50) < attention_priority("WARM", "new", 100)

    def test_score_is_tiebreaker(self):
        assert attention_priority("HOT", "new", 10, score=90) > attention_priority("HOT", "new", 10, score=10)


class TestUrgencyLevel:
    def test_hot_new_always_high(self):
        assert urgency_level("HOT", "new", 0) == "high"

    def test_hot_contacted_escalates_with_age(self):
        assert urgency_level("HOT", "contacted", 10) == "medium"
        assert urgency_level("HOT", "contacted", 48) == "high"

    def test_warm_new_escalates_after_a_day(self):
        assert urgency_level("WARM", "new", 5) == "medium"
        assert urgency_level("WARM", "new", 24) == "high"

    def test_warm_contacted(self):
        assert urgency_level("WARM", "contacted", 1) == "low"
        assert urgency_level("WARM", "contacted", 72) == "medium"

    def test_cold_never_escalates(self):
        assert urgency_level("COLD", "new", 500) == "low"

    def test_case_insensitive(self):
        assert urgency_level("hot", "new", 0) == "high"


class TestReason:
    def test_new_reason(self):
        assert attention_reason("HOT", "new", 36) == "Hot lead · uncontacted for 1d"

    def test_contacted_reason(self):
        assert attention_reason("WARM", "contacted", 5) == "Warm lead · contacted 5h ago"

    def test_just_now(self):
        assert "just now" in attention_reason("HOT", "new", 0.2)


class TestBuildActionQueue:
    def _leads(self):
        return [
            {"id": "1", "email": "a@x.com", "band": "HOT", "status": "new", "score": 90, "created_at": _ago(36), "status_updated_at": None},
            {"id": "2", "email": "b@x.com", "band": "WARM", "status": "contacted", "score": 50, "created_at": _ago(200), "status_updated_at": _ago(2)},
            {"id": "3", "email": "c@x.com", "band": "HOT", "status": "won", "score": 95, "created_at": _ago(48), "status_updated_at": _ago(1)},  # closed
            {"id": "4", "email": "d@x.com", "band": "COLD", "status": "new", "score": 10, "created_at": _ago(5), "status_updated_at": None},
        ]

    def test_excludes_closed_and_ranks(self):
        out = build_action_queue(self._leads(), now=NOW)
        ids = [x["id"] for x in out["queue"]]
        assert "3" not in ids                     # won lead excluded
        assert ids[0] == "1"                       # HOT new is top
        assert ids[-1] == "4"                      # COLD sinks to bottom
        assert out["counts"]["total"] == 3

    def test_counts_by_urgency(self):
        out = build_action_queue(self._leads(), now=NOW)
        c = out["counts"]
        assert c["high"] >= 1                       # the HOT new lead
        assert c["high"] + c["medium"] + c["low"] == c["total"]

    def test_limit(self):
        out = build_action_queue(self._leads(), now=NOW, limit=1)
        assert len(out["queue"]) == 1
        assert out["queue"][0]["id"] == "1"
        # counts still reflect the full set, not the truncated view
        assert out["counts"]["total"] == 3

    def test_empty(self):
        out = build_action_queue([], now=NOW)
        assert out["queue"] == []
        assert out["counts"] == {"high": 0, "medium": 0, "low": 0, "total": 0}

    def test_enriched_fields_present(self):
        out = build_action_queue(self._leads(), now=NOW)
        top = out["queue"][0]
        for key in ("id", "email", "band", "status", "age_hours", "priority", "urgency", "reason"):
            assert key in top
