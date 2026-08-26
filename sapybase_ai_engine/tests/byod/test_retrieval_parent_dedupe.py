"""One retrieved slot per PARENT, not per matching child.

Production regression (docs/list-answer-consistency-plan.md §1.2): children of one
parent routinely win adjacent ranks, and every one of them resolves to the SAME
parent text. Stored `chat_logs.sources` from the incident show one parent holding
ranks 1 and 2, and another holding ranks 1 and 4 - so the "top 5" handed to the
reranker was really a top 3, and the chunk holding the rest of the answer was
crowded out by copies of a chunk already present.

Lives under tests/byod/ purely to reuse the real-Postgres+pgvector fixture: this is
the SHARED retrieval path, which `_byod_retrieve_knowledge` also calls.
"""
from __future__ import annotations

import psycopg2
import pytest

import byod_dataplane
from core.embedding_config import EMBEDDING_DIMENSIONS


COMPANY = "11111111-1111-1111-1111-111111111111"


def _vec(seed: float) -> list[float]:
    return [seed] * EMBEDDING_DIMENSIONS


@pytest.fixture
def knowledge_conn(control_plane_db_dsn):
    """A data-plane DB holding one fat parent with many children, plus two rivals."""
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    with conn.cursor() as cur:
        byod_dataplane.apply_data_plane_schema(cur)

        def add_parent(content: str) -> str:
            cur.execute(
                "INSERT INTO company_knowledge (company_id, content, url, chunk_type) "
                "VALUES (%s, %s, 'src.pdf', 'parent') RETURNING id",
                (COMPANY, content),
            )
            return cur.fetchone()[0]

        def add_child(parent_id, content: str, seed: float):
            cur.execute(
                "INSERT INTO company_knowledge "
                "(company_id, content, url, chunk_type, parent_id, embedding) "
                "VALUES (%s, %s, 'src.pdf', 'child', %s, %s::vector)",
                (COMPANY, content, parent_id, _vec(seed)),
            )

        # The shape that caused the incident: ONE parent with six children, all of
        # them strong matches, so unchecked they can take every slot.
        fat = add_parent("PARENT-FAT: the whole product list")
        for i in range(6):
            add_child(fat, f"product listing chunk {i}", 0.01 + i * 0.001)

        # Two rivals that must still be reachable.
        for n in (1, 2):
            rival = add_parent(f"PARENT-RIVAL-{n}")
            add_child(rival, f"product listing rival {n}", 0.02 + n * 0.001)

    yield conn
    conn.close()


def _retrieve(conn, limit=5):
    from main import retrieve_knowledge

    return retrieve_knowledge(conn, COMPANY, _vec(0.01), query_text="product listing", limit=limit)


def test_one_parent_cannot_occupy_more_than_one_slot(knowledge_conn):
    rows = _retrieve(knowledge_conn)
    content_ids = [r[2] for r in rows]
    assert len(content_ids) == len(set(content_ids)), (
        f"a parent was returned more than once: {content_ids}"
    )


def test_the_rivals_are_not_crowded_out(knowledge_conn):
    # The point of the fix: slots freed by dedupe go to DIFFERENT sources, which is
    # what lets a second chunk complete an answer the first one only half-covers.
    contents = [r[0] for r in _retrieve(knowledge_conn)]
    assert any("RIVAL-1" in c for c in contents)
    assert any("RIVAL-2" in c for c in contents)


def test_relevance_order_survives_the_dedupe(knowledge_conn):
    # DISTINCT ON forces its own ORDER BY, so the outer query has to restore
    # relevance order. Getting that wrong would silently rank by parent id.
    contents = [r[0] for r in _retrieve(knowledge_conn)]
    assert "PARENT-FAT" in contents[0], f"nearest match did not rank first: {contents}"


def test_a_parent_is_returned_once_even_when_asking_for_many(knowledge_conn):
    rows = _retrieve(knowledge_conn, limit=15)
    content_ids = [r[2] for r in rows]
    # Three parents exist; nine children. Without dedupe this returns nine rows.
    assert len(content_ids) == 3
    assert len(set(content_ids)) == 3
