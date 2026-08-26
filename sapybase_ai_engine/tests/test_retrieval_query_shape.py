"""The retrieval SQL dedupes resolved parents, and binds what it interpolates.

A companion to tests/byod/test_retrieval_parent_dedupe.py, which proves the BEHAVIOUR
but needs a real Postgres and therefore skips wherever one is not available. These run
everywhere, and exist for two reasons:

  * the dedupe is a one-line-deletable property with no local guard otherwise, and
  * wrapping either branch in a sub-select changes the placeholder count, which is a
    silent, runtime-only failure - a mismatch here raises at query time, in the chat
    hot path, on a code path a unit test never reaches.
"""
from __future__ import annotations

import pytest


class _RecordingCursor:
    def __init__(self, sink):
        self.sink = sink

    def execute(self, sql, params=None):
        self.sink.append((sql, params))

    def fetchall(self):
        return []

    def close(self):
        pass


class _RecordingConn:
    def __init__(self, sink):
        self.sink = sink

    def cursor(self):
        return _RecordingCursor(self.sink)


def _capture(monkeypatch, *, has_fts: bool, query_text: str):
    import main

    monkeypatch.setattr(main, "_check_fts_column", lambda: has_fts)
    sink: list = []
    main.retrieve_knowledge(
        _RecordingConn(sink), "c-1", [0.1] * 8, query_text=query_text, limit=5
    )
    assert len(sink) == 1
    return sink[0]


@pytest.mark.parametrize(
    "has_fts,query_text,label",
    [(True, "food additives", "hybrid"), (False, "", "pure-vector fallback")],
)
def test_placeholders_and_params_agree(monkeypatch, has_fts, query_text, label):
    sql, params = _capture(monkeypatch, has_fts=has_fts, query_text=query_text)
    assert sql.count("%s") == len(params), (
        f"{label} branch binds {len(params)} params for {sql.count('%s')} placeholders"
    )


@pytest.mark.parametrize(
    "has_fts,query_text,label",
    [(True, "food additives", "hybrid"), (False, "", "pure-vector fallback")],
)
def test_each_branch_dedupes_the_resolved_parent(monkeypatch, has_fts, query_text, label):
    # Children of one parent all resolve to the SAME parent text, so without this a
    # single parent can occupy several of the five slots handed to the reranker.
    sql, _ = _capture(monkeypatch, has_fts=has_fts, query_text=query_text)
    assert "DISTINCT ON" in sql, f"{label} branch lost its parent dedupe"


@pytest.mark.parametrize(
    "has_fts,query_text,label",
    [(True, "food additives", "hybrid"), (False, "", "pure-vector fallback")],
)
def test_relevance_order_is_restored_after_the_dedupe(monkeypatch, has_fts, query_text, label):
    # DISTINCT ON dictates its own leading ORDER BY, so the ordering that matters has
    # to be reapplied outside it - otherwise results come back ordered by parent id.
    sql, _ = _capture(monkeypatch, has_fts=has_fts, query_text=query_text)
    tail = sql[sql.rindex(") deduped"):]
    assert "ORDER BY" in tail, f"{label} branch does not re-order after DISTINCT ON"
    assert "LIMIT" in tail
