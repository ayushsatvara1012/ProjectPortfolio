"""
Tests for the per-answer groundedness/confidence score (Track 3 item 10).

Covers the pure _compute_confidence mapping and the new rerank_chunks tuple
contract (chunks, top_score) — including the no-score fallback paths.
"""
import asyncio
import json
from unittest.mock import MagicMock

import pytest

import main


def _run(coro):
    return asyncio.run(coro)


# ── _compute_confidence ──────────────────────────────────────────────────────

class TestComputeConfidence:
    def test_unanswered_is_zero(self):
        assert main._compute_confidence(True, 5, 9.0) == 0.0

    def test_no_docs_is_zero(self):
        assert main._compute_confidence(False, 0, None) == 0.0

    def test_score_normalized_to_0_1(self):
        assert main._compute_confidence(False, 3, 9.0) == 0.9
        assert main._compute_confidence(False, 3, 5.0) == 0.5
        assert main._compute_confidence(False, 3, 10.0) == 1.0

    def test_score_clamped_to_ceiling(self):
        # A score above 10 (model misbehavior) must clamp to 1.0, not exceed it.
        assert main._compute_confidence(False, 3, 12.0) == 1.0

    def test_negative_score_clamped_to_floor(self):
        assert main._compute_confidence(False, 3, -2.0) == 0.0

    def test_none_score_is_unknown(self):
        # Reranker skipped (small KB) or failed -> honest None, not a fake number.
        assert main._compute_confidence(False, 3, None) is None

    def test_unanswered_takes_priority_over_score(self):
        # Even with a high score, a fallback answer is not grounded.
        assert main._compute_confidence(True, 3, 10.0) == 0.0

    def test_returns_float_in_range(self):
        for s in (0.0, 1.0, 3.3, 7.7, 9.99):
            c = main._compute_confidence(False, 2, s)
            assert 0.0 <= c <= 1.0


# ── rerank_chunks tuple contract ─────────────────────────────────────────────

class _FakeModel:
    """Stands in for ChatGoogleGenerativeAI: returns a fixed JSON score array."""
    def __init__(self, scores):
        self._scores = scores

    async def ainvoke(self, _messages):
        resp = MagicMock()
        resp.content = json.dumps(self._scores)
        return resp


class TestRerankChunksContract:
    def test_returns_tuple_when_at_or_below_top_k(self):
        cands = [("chunk a", "src1"), ("chunk b", "src2")]
        result, score = _run(main.rerank_chunks("q", cands, top_k=5))
        assert result == cands
        assert score is None  # no scoring performed

    def test_empty_candidates_returns_empty_and_none(self):
        result, score = _run(main.rerank_chunks("q", [], top_k=5))
        assert result == []
        assert score is None

    def test_scores_and_returns_top_with_max_score(self, monkeypatch):
        # 6 candidates so reranking runs (len > top_k).
        cands = [(f"chunk {i}", f"src{i}") for i in range(6)]
        scores = [3, 9, 1, 7, 2, 5]
        monkeypatch.setattr(main, "ChatGoogleGenerativeAI", lambda **kw: _FakeModel(scores))
        result, top_score = _run(main.rerank_chunks("q", cands, top_k=3))
        assert len(result) == 3
        # top 3 by score are 9,7,5 -> max is 9.0
        assert top_score == 9.0
        # highest-scoring chunk (index 1) must be first
        assert result[0] == ("chunk 1", "src1")

    def test_reranker_failure_falls_back_to_none_score(self, monkeypatch):
        cands = [(f"chunk {i}", f"src{i}") for i in range(6)]

        class _BrokenModel:
            async def ainvoke(self, _m):
                raise RuntimeError("LLM down")

        monkeypatch.setattr(main, "ChatGoogleGenerativeAI", lambda **kw: _BrokenModel())
        result, top_score = _run(main.rerank_chunks("q", cands, top_k=3))
        assert len(result) == 3          # falls back to first top_k
        assert top_score is None         # no score available

    def test_score_length_mismatch_falls_back(self, monkeypatch):
        cands = [(f"chunk {i}", f"src{i}") for i in range(6)]
        monkeypatch.setattr(main, "ChatGoogleGenerativeAI", lambda **kw: _FakeModel([1, 2, 3]))  # wrong length
        result, top_score = _run(main.rerank_chunks("q", cands, top_k=3))
        assert len(result) == 3
        assert top_score is None


# ── end-to-end: confidence derived from rerank output ────────────────────────

class TestConfidenceFromRerank:
    def test_high_score_yields_high_confidence(self, monkeypatch):
        cands = [(f"c{i}", f"s{i}") for i in range(6)]
        monkeypatch.setattr(main, "ChatGoogleGenerativeAI",
                            lambda **kw: _FakeModel([8, 2, 1, 0, 3, 4]))
        docs, top_score = _run(main.rerank_chunks("q", cands, top_k=3))
        conf = main._compute_confidence(False, len(docs), top_score)
        assert conf == 0.8

    def test_rerank_skipped_small_kb_yields_unknown_confidence(self):
        # Only 2 chunks (<= top_k) -> no score -> confidence unknown (None).
        docs, top_score = _run(main.rerank_chunks("q", [("a", "s"), ("b", "s")], top_k=5))
        conf = main._compute_confidence(False, len(docs), top_score)
        assert conf is None
