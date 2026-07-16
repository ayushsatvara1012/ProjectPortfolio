"""Tests for main._dedupe_ranked_qa — the near-duplicate-question ranking
helper shared by the public FAQ miner (get_bot_faqs) and the owner-facing
"fixes needed" / needs-attention aggregation (Phase 2b, vertical intelligence
plan). Rows must already arrive ORDER BY ask_count DESC.
"""
import main


def _row(question, answer, ask_count):
    return (question, answer, ask_count)


class TestDedupeRankedQa:
    def test_returns_question_answer_ask_count(self):
        out = main._dedupe_ranked_qa([_row("what are your hours?", "9-5 Mon-Fri", 4)], limit=10)
        assert out == [{"question": "what are your hours?", "answer": "9-5 Mon-Fri", "ask_count": 4}]

    def test_near_identical_questions_deduped_keeping_first(self):
        # Dedup keys off the first 40 normalized chars, so both questions must
        # share exactly those first 40 chars (this prefix IS 40 chars) and
        # only diverge after — otherwise they're treated as distinct.
        shared_prefix = "what are your opening and closing hours "
        assert len(shared_prefix) == 40
        rows = [
            _row(f"{shared_prefix}today", "9-5 Mon-Fri", 10),
            _row(f"{shared_prefix}on weekends", "different phrasing, same intent", 3),
        ]
        out = main._dedupe_ranked_qa(rows, limit=10)
        # Same 40-char normalized prefix -> only the first (higher ask_count) kept.
        assert len(out) == 1
        assert out[0]["answer"] == "9-5 Mon-Fri"

    def test_distinct_questions_both_kept(self):
        rows = [
            _row("what are your hours?", "9-5 Mon-Fri", 10),
            _row("do you ship internationally?", "yes, worldwide", 5),
        ]
        out = main._dedupe_ranked_qa(rows, limit=10)
        assert len(out) == 2

    def test_limit_is_applied(self):
        rows = [_row(f"question number {i} is unique", f"answer {i}", i) for i in range(20)]
        out = main._dedupe_ranked_qa(rows, limit=5)
        assert len(out) == 5

    def test_answer_truncated_to_max_len(self):
        long_answer = "x" * 500
        out = main._dedupe_ranked_qa([_row("q", long_answer, 1)], limit=10, answer_max_len=300)
        assert len(out[0]["answer"]) == 300
        assert out[0]["answer"].endswith("...")

    def test_answer_max_len_none_disables_truncation(self):
        long_answer = "x" * 500
        out = main._dedupe_ranked_qa([_row("q", long_answer, 1)], limit=10, answer_max_len=None)
        assert out[0]["answer"] == long_answer

    def test_empty_rows_returns_empty(self):
        assert main._dedupe_ranked_qa([], limit=10) == []
