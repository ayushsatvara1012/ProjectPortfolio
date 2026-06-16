"""Phase 3.4 test gate: checkpointed/idempotent ingest + cost guard (byod_ingest).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3.4, rule E11 / §16.7):
    "Partial-failure resume; dedup; embedding-cost cap holds."

Layers:
  * Pure (no DB) — fingerprint identity, source-URL normalization, the per-job
    embedding-cost guard, the dedup planner, and capped retry/backoff.
  * Functional (real tenant Postgres) — run_tenant_ingest against the tenant's own
    company_knowledge: dedup/idempotent re-run (no re-embed, no duplicate rows),
    resume after a mid-job failure (committed batches survive; only the remainder
    is embedded), and the embedding-cost cap stopping a job cleanly. Skips when no
    backend is available.
"""
from __future__ import annotations

import asyncio
import uuid

import psycopg2
import pytest

import byod_engine
import byod_ingest
from byod_ingest import (
    EmbeddingCostExceeded,
    EmbeddingCostGuard,
    IngestConfig,
    content_fingerprint,
    normalize_source_url,
    plan_ingest,
    retry_with_backoff,
)
from embedding_config import EMBEDDING_DIMENSIONS


# ── Pure: identity + normalization ───────────────────────────────────────────────
def test_content_fingerprint_stable_and_distinct():
    assert content_fingerprint("hello") == content_fingerprint("hello")
    assert content_fingerprint("hello") != content_fingerprint("world")


def test_normalize_source_url():
    assert normalize_source_url("https://Acme.TEST/Pricing/") == "https://acme.test/Pricing"
    assert normalize_source_url("https://acme.test/p#frag") == "https://acme.test/p"
    assert normalize_source_url("  https://acme.test/p  ") == "https://acme.test/p"
    # Non-URL sources pass through trimmed (path case preserved).
    assert normalize_source_url("My File.pdf") == "My File.pdf"


# ── Pure: embedding-cost guard ───────────────────────────────────────────────────
def test_cost_guard_charges_and_caps():
    guard = EmbeddingCostGuard(max_embeddings=5)
    guard.charge(3)
    assert guard.remaining == 2
    assert guard.can_afford(2) is True
    assert guard.can_afford(3) is False
    with pytest.raises(EmbeddingCostExceeded):
        guard.charge(3)
    # Failed charge does not consume budget.
    assert guard.used == 3


# ── Pure: dedup planner ──────────────────────────────────────────────────────────
def test_plan_ingest_skips_existing_and_intra_batch_dups():
    chunks = [(None, "a"), (None, "b"), (None, "a"), (None, "c")]
    existing = {content_fingerprint("b")}
    plan = plan_ingest(chunks, existing)
    # 'b' already stored, second 'a' is a dup → both skipped; 'a','c' embedded.
    assert [c for _p, c in plan.to_embed] == ["a", "c"]
    assert plan.skipped == 2


# ── Pure: capped retry/backoff ───────────────────────────────────────────────────
def test_retry_succeeds_after_transient_failures():
    calls = {"n": 0}
    slept: list[float] = []

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient")
        return "ok"

    out = retry_with_backoff(flaky, attempts=3, base_delay=1.0, sleep=slept.append)
    assert out == "ok"
    assert calls["n"] == 3
    assert slept == [1.0, 2.0]  # exponential backoff between attempts


def test_retry_reraises_after_exhausting_attempts():
    def always_fail():
        raise ValueError("boom")

    with pytest.raises(ValueError):
        retry_with_backoff(always_fail, attempts=2, base_delay=0, sleep=lambda _s: None)


def test_config_from_env(monkeypatch):
    monkeypatch.setenv("BYOD_INGEST_MAX_EMBEDDINGS_PER_JOB", "42")
    monkeypatch.setenv("BYOD_INGEST_BATCH_SIZE", "7")
    cfg = IngestConfig.from_env()
    assert cfg.max_embeddings_per_job == 42
    assert cfg.batch_size == 7


# ── Functional helpers ───────────────────────────────────────────────────────────
def _registry(dsn: str):
    return byod_engine.build_registry(lambda _cid: dsn)


def _fake_embedder():
    async def _embed(texts):
        return [[0.1] * EMBEDDING_DIMENSIONS for _ in texts]
    return _embed


def _flat_chunks(n: int, salt: str = "") -> list[tuple[None, str]]:
    return [(None, f"{salt}chunk number {i} unique content") for i in range(n)]


def _count_children(dsn: str, company_id: str, source: str) -> int:
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM company_knowledge "
                "WHERE company_id = %s AND url = %s AND chunk_type = 'child'",
                (company_id, source),
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


# ── Functional: happy path + content_tsv ─────────────────────────────────────────
def test_ingest_writes_children_to_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    source = "https://acme.test/docs"
    reg = _registry(tenant_db_dsn)
    cfg = IngestConfig(max_embeddings_per_job=1000, batch_size=5, max_retries=2, retry_base_delay_seconds=0)
    try:
        result = asyncio.run(byod_ingest.run_tenant_ingest(
            company_id=company_id, source_name=source, chunks=_flat_chunks(12),
            embed_documents=_fake_embedder(), config=cfg, registry=reg,
        ))
    finally:
        reg.close_all()

    assert result.added == 12
    assert result.skipped == 0
    assert _count_children(tenant_db_dsn, company_id, source) == 12

    # content_tsv is the GENERATED column → auto-populated, so BM25 will work.
    conn = psycopg2.connect(tenant_db_dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM company_knowledge "
                "WHERE company_id = %s AND chunk_type = 'child' AND content_tsv IS NOT NULL",
                (company_id,),
            )
            assert cur.fetchone()[0] == 12
    finally:
        conn.close()


# ── Functional: dedup / idempotent re-run ────────────────────────────────────────
def test_reingest_is_idempotent_no_reembed_no_dups(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    source = "https://acme.test/docs"
    reg = _registry(tenant_db_dsn)
    cfg = IngestConfig(max_embeddings_per_job=1000, batch_size=5, max_retries=2, retry_base_delay_seconds=0)
    embedder = _fake_embedder()
    chunks = _flat_chunks(8)
    try:
        first = asyncio.run(byod_ingest.run_tenant_ingest(
            company_id=company_id, source_name=source, chunks=chunks,
            embed_documents=embedder, config=cfg, registry=reg,
        ))
        # Re-run the EXACT same source → everything dedups, nothing re-embedded.
        second = asyncio.run(byod_ingest.run_tenant_ingest(
            company_id=company_id, source_name=source, chunks=chunks,
            embed_documents=embedder, config=cfg, registry=reg,
        ))
    finally:
        reg.close_all()

    assert first.added == 8
    assert second.added == 0
    assert second.skipped == 8
    assert second.embedded == 0
    assert _count_children(tenant_db_dsn, company_id, source) == 8  # no duplicates


# ── Functional: partial-failure resume ───────────────────────────────────────────
def test_resume_after_midjob_failure(tenant_db_dsn):
    """A job killed after the first committed batch resumes by embedding only the
    remainder — no re-embed of committed work, no duplicate rows."""
    company_id = str(uuid.uuid4())
    source = "https://acme.test/docs"
    chunks = _flat_chunks(12)
    cfg = IngestConfig(max_embeddings_per_job=1000, batch_size=5, max_retries=2, retry_base_delay_seconds=0)

    # Embedder that fails from the 2nd embed call onward (so batch 0 commits, then
    # the job dies). retry exhausts and run_tenant_ingest raises.
    calls = {"n": 0}

    async def flaky_embed(texts):
        calls["n"] += 1
        if calls["n"] >= 2:
            raise RuntimeError("embed boom")
        return [[0.1] * EMBEDDING_DIMENSIONS for _ in texts]

    reg = _registry(tenant_db_dsn)
    try:
        with pytest.raises(RuntimeError):
            asyncio.run(byod_ingest.run_tenant_ingest(
                company_id=company_id, source_name=source, chunks=chunks,
                embed_documents=flaky_embed, config=cfg, registry=reg,
            ))
        # First batch (5) survived the crash.
        assert _count_children(tenant_db_dsn, company_id, source) == 5

        # Resume with a healthy embedder → only the remaining 7 are ingested.
        resumed = asyncio.run(byod_ingest.run_tenant_ingest(
            company_id=company_id, source_name=source, chunks=chunks,
            embed_documents=_fake_embedder(), config=cfg, registry=reg,
        ))
    finally:
        reg.close_all()

    assert resumed.skipped == 5      # the committed batch is recognized + skipped
    assert resumed.added == 7        # only the remainder embedded+written
    assert _count_children(tenant_db_dsn, company_id, source) == 12  # exactly once each


# ── Functional: embedding-cost cap holds ─────────────────────────────────────────
def test_embedding_cost_cap_stops_job(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    source = "https://acme.test/docs"
    # Budget of 5 embeddings, 12 candidate chunks, batch of 5 → one batch then stop.
    cfg = IngestConfig(max_embeddings_per_job=5, batch_size=5, max_retries=2, retry_base_delay_seconds=0)
    reg = _registry(tenant_db_dsn)
    try:
        result = asyncio.run(byod_ingest.run_tenant_ingest(
            company_id=company_id, source_name=source, chunks=_flat_chunks(12),
            embed_documents=_fake_embedder(), config=cfg, registry=reg,
        ))
    finally:
        reg.close_all()

    assert result.capped_by_cost is True
    assert result.embedded == 5          # never embedded beyond the budget
    assert result.added == 5
    assert _count_children(tenant_db_dsn, company_id, source) == 5
