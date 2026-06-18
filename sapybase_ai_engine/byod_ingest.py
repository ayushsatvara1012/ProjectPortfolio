"""BYOD checkpointed, idempotent ingestion + per-job embedding-cost guard.

RFC docs/rfc-byod.md Phase 3.4 (rule E11; §16.7 ingestion & embeddings). Ingesting
knowledge into a BYOD tenant DB has a money-leak hazard: embeddings are billed to
Sapybase *before* the tenant write, so a failed write wastes spend and a naive
retry multiplies it. The fix (§16.7):

  * **Dedup + checkpointed resume.** A chunk's identity is the fingerprint of its
    content; before embedding we skip any chunk already stored for the source
    (and any duplicate within the batch). Writes are committed per batch, so a job
    killed midway *resumes* by re-deriving what is already stored and embedding
    only the remainder — never re-embedding or duplicating committed work.
  * **Per-job embedding-cost guard.** :class:`EmbeddingCostGuard` caps the number
    of embeddings a single job may consume; at the cap the job stops cleanly with
    what it has ingested (``capped_by_cost``) rather than draining the budget.
  * **Capped retries with backoff.** Transient embed/DB failures are retried a
    bounded number of times with exponential backoff, then surface.

The pure helpers (fingerprint, dedup planner, cost guard, retry) are stdlib-only
and unit-testable. :func:`run_tenant_ingest` is the data-plane writer: it routes
through ``byod_engine.tenant_connection`` (rule 1 — get_tenant_db / vaayu_runtime),
takes the embedding function injected (so it is testable with a fake embedder and
no LLM), and is idempotent/resumable against a real tenant Postgres.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass
from typing import (
    Awaitable,
    Callable,
    List,
    Optional,
    Sequence,
    Set,
    Tuple,
)

from embedding_config import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)


# ── Errors ─────────────────────────────────────────────────────────────────────
class IngestError(Exception):
    """Base for BYOD ingestion failures (sanitized — no DSN/host/driver text)."""


class EmbeddingCostExceeded(IngestError):
    """A job tried to embed more chunks than its per-job budget allows (§16.7)."""


# ── Config ─────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class IngestConfig:
    """Tunables for a BYOD ingest job (env-overridable)."""

    max_embeddings_per_job: int = 5_000   # per-job embedding-cost ceiling (§16.7)
    batch_size: int = 10                  # embed + write in batches (checkpoint unit)
    max_retries: int = 3                  # capped retries per batch (E11)
    retry_base_delay_seconds: float = 0.5  # exponential backoff base
    prune_superseded: bool = True         # re-train deletes stale chunks (§16.7; keeps count bounded)

    @classmethod
    def from_env(cls) -> "IngestConfig":
        def _int(name: str, default: int) -> int:
            raw = os.getenv(name)
            return int(raw) if raw and raw.strip() else default

        def _float(name: str, default: float) -> float:
            raw = os.getenv(name)
            return float(raw) if raw and raw.strip() else default

        def _bool(name: str, default: bool) -> bool:
            raw = os.getenv(name)
            if raw is None or not raw.strip():
                return default
            return raw.strip().lower() in ("1", "true", "yes", "on")

        return cls(
            max_embeddings_per_job=_int("BYOD_INGEST_MAX_EMBEDDINGS_PER_JOB", cls.max_embeddings_per_job),
            batch_size=_int("BYOD_INGEST_BATCH_SIZE", cls.batch_size),
            max_retries=_int("BYOD_INGEST_MAX_RETRIES", cls.max_retries),
            retry_base_delay_seconds=_float("BYOD_INGEST_RETRY_BASE_DELAY_SECONDS", cls.retry_base_delay_seconds),
            prune_superseded=_bool("BYOD_INGEST_PRUNE_SUPERSEDED", cls.prune_superseded),
        )


# ── Pure helpers: dedup identity + cost guard + retry ────────────────────────────
def content_fingerprint(text: str) -> str:
    """Stable identity for a chunk (sha256 of its UTF-8 content). Two chunks with
    identical content share a fingerprint → dedup key for resume/idempotency."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_source_url(url: str) -> str:
    """Canonicalize a source identifier so the same source dedups regardless of
    cosmetic differences (trailing slash, fragment, surrounding space, host case).
    Non-URL sources (filenames, manual_entry) pass through trimmed."""
    if url is None:
        return ""
    s = url.strip()
    if "#" in s:
        s = s.split("#", 1)[0]
    # Lowercase only the scheme://host, leave the path case-sensitive.
    if "://" in s:
        scheme_host, _, rest = s.partition("://")
        host, slash, path = rest.partition("/")
        s = f"{scheme_host.lower()}://{host.lower()}{slash}{path}"
    if len(s) > 1 and s.endswith("/"):
        s = s.rstrip("/")
    return s


@dataclass
class EmbeddingCostGuard:
    """Per-job embedding budget (§16.7). ``charge`` raises once the cap is reached,
    so a single job can never drain Sapybase's embedding spend."""

    max_embeddings: int
    used: int = 0

    def can_afford(self, n: int) -> bool:
        return self.used + n <= self.max_embeddings

    def charge(self, n: int) -> None:
        if not self.can_afford(n):
            raise EmbeddingCostExceeded(
                f"embedding budget exhausted (used {self.used}/{self.max_embeddings})"
            )
        self.used += n

    @property
    def remaining(self) -> int:
        return max(0, self.max_embeddings - self.used)


@dataclass(frozen=True)
class IngestPlan:
    to_embed: List[Tuple[Optional[str], str]]  # (parent_text|None, child_text) needing embed
    skipped: int                                # chunks deduped (already stored / dup in batch)


def plan_ingest(
    chunks: Sequence[Tuple[Optional[str], str]],
    existing_fingerprints: Set[str],
) -> IngestPlan:
    """Compute the delta to embed: drop any child chunk whose content fingerprint is
    already stored (resume/dedup, §16.7) or repeats earlier in this batch."""
    to_embed: List[Tuple[Optional[str], str]] = []
    seen: Set[str] = set()
    skipped = 0
    for parent_text, child_text in chunks:
        fp = content_fingerprint(child_text)
        if fp in existing_fingerprints or fp in seen:
            skipped += 1
            continue
        seen.add(fp)
        to_embed.append((parent_text, child_text))
    return IngestPlan(to_embed=to_embed, skipped=skipped)


def plan_prune(
    stored_children: Sequence[Tuple[str, str]],
    current_fingerprints: Set[str],
) -> List[str]:
    """Ids of stored child chunks that the current re-train no longer contains
    (content fingerprint absent from ``current_fingerprints``) → superseded, safe to
    delete. Without this, re-training changed content only *appends*, so stale chunks
    linger forever → answer-quality drift + ``max_chunks`` quota creep (§16.7).

    ``current_fingerprints`` must be the fingerprints of the *full* intended child
    set for the source — so chunks that survive a re-train unchanged are retained.
    Caller must only act on this for a complete run (not cost/quota-capped), else a
    truncated input set would mark legitimate not-yet-stored chunks for deletion."""
    to_delete: List[str] = []
    for row_id, content in stored_children:
        if content is None:
            continue
        if content_fingerprint(content) not in current_fingerprints:
            to_delete.append(row_id)
    return to_delete


def retry_with_backoff(
    fn: Callable[[], object],
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
    retry_on: Tuple[type, ...] = (Exception,),
    sleep: Callable[[float], None] = time.sleep,
):
    """Call ``fn`` with capped retries + exponential backoff (E11). Re-raises the
    last error after the final attempt."""
    last: Optional[BaseException] = None
    for i in range(max(1, attempts)):
        try:
            return fn()
        except retry_on as exc:
            last = exc
            if i >= attempts - 1:
                raise
            sleep(base_delay * (2 ** i))
    raise last  # pragma: no cover - loop always returns or raises


async def retry_with_backoff_async(
    coro_fn: Callable[[], Awaitable[object]],
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
    retry_on: Tuple[type, ...] = (Exception,),
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
):
    """Async variant of :func:`retry_with_backoff` for the embed call (E11)."""
    last: Optional[BaseException] = None
    for i in range(max(1, attempts)):
        try:
            return await coro_fn()
        except retry_on as exc:
            last = exc
            if i >= attempts - 1:
                raise
            await sleep(base_delay * (2 ** i))
    raise last  # pragma: no cover


# ── Tenant data-plane reads (for dedup/resume) ───────────────────────────────────
def existing_child_fingerprints(cur, company_id: str, source_name: str) -> Set[str]:
    """Fingerprints of child chunks already stored for a source on the tenant DB.
    A resumed/repeat job skips these, so it never re-embeds committed work."""
    cur.execute(
        "SELECT content FROM company_knowledge "
        "WHERE company_id = %s AND url = %s AND chunk_type = 'child'",
        (company_id, source_name),
    )
    return {content_fingerprint(r[0]) for r in cur.fetchall() if r[0]}


def stored_children_for_source(cur, company_id: str, source_name: str) -> List[Tuple[str, str]]:
    """(id, content) of every child chunk currently stored for a source on the tenant
    DB — input to :func:`plan_prune` so a re-train can delete superseded chunks."""
    cur.execute(
        "SELECT id, content FROM company_knowledge "
        "WHERE company_id = %s AND url = %s AND chunk_type = 'child'",
        (company_id, source_name),
    )
    return [(str(r[0]), r[1]) for r in cur.fetchall()]


def existing_parents(cur, company_id: str, source_name: str) -> dict:
    """Map of parent content -> parent row id already stored for a source. Preloaded
    so a resumed job reuses existing parents instead of duplicating them."""
    cur.execute(
        "SELECT content, id FROM company_knowledge "
        "WHERE company_id = %s AND url = %s AND chunk_type = 'parent'",
        (company_id, source_name),
    )
    return {r[0]: str(r[1]) for r in cur.fetchall() if r[0]}


# ── Result ───────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class IngestResult:
    added: int             # child chunks written this run
    skipped: int           # candidates deduped (already stored / dup)
    embedded: int          # embeddings actually consumed this run
    total_candidates: int  # input child chunks
    capped_by_cost: bool   # True if the per-job embedding budget stopped the run
    pruned: int = 0        # superseded child chunks deleted this run (re-train, §16.7)


# ── Tenant ingest writer (the data-plane cutover) ────────────────────────────────
EmbedFn = Callable[[List[str]], Awaitable[List[List[float]]]]
ProgressFn = Callable[[int, int], None]


async def run_tenant_ingest(
    *,
    company_id: str,
    source_name: str,
    chunks: Sequence[Tuple[Optional[str], str]],
    embed_documents: EmbedFn,
    on_progress: Optional[ProgressFn] = None,
    config: Optional[IngestConfig] = None,
    prune_superseded: Optional[bool] = None,
    registry=None,
) -> IngestResult:
    """Idempotent, checkpointed, cost-guarded ingest of ``chunks`` into the tenant's
    own ``company_knowledge`` (rule 1 — via get_tenant_db / vaayu_runtime; E11,
    §16.7).

    ``chunks`` are ``(parent_text | None, child_text)`` pairs (children are embedded;
    a non-None parent is stored once and linked). Dedup + resume: child chunks whose
    content is already stored are skipped, and existing parents are reused. The
    per-job :class:`EmbeddingCostGuard` stops the run cleanly at its budget. Each
    batch is committed (checkpoint) so an interrupted job resumes without
    re-embedding or duplicating. Imported lazily to keep ``byod_engine`` decoupled.

    Re-train pruning (§16.7): on a *complete* run (not stopped by the cost guard),
    child chunks stored for the source whose content is no longer in ``chunks`` are
    deleted, and parents thereby orphaned are removed — so re-training changed
    content stays bounded to the live source instead of accumulating stale chunks.
    ``prune_superseded`` overrides the config flag; the caller MUST pass ``False``
    when ``chunks`` is a truncated/quota-capped prefix of the source (else surviving
    tail chunks would be wrongly deleted).
    """
    import byod_engine  # lazy — byod_engine has no dependency on this module

    cfg = config or IngestConfig.from_env()
    guard = EmbeddingCostGuard(cfg.max_embeddings_per_job)
    do_prune = cfg.prune_superseded if prune_superseded is None else prune_superseded

    added = embedded = pruned = 0
    capped_by_cost = False

    # 1. Read existing state for dedup/resume in a SHORT tenant checkout (we do not
    #    hold a bounded pool connection across the slow embed calls below).
    with byod_engine.tenant_connection(company_id, registry=registry) as conn:
        cur = conn.cursor()
        existing_fps = existing_child_fingerprints(cur, company_id, source_name)
        seen_parents = existing_parents(cur, company_id, source_name)

    plan = plan_ingest(chunks, existing_fps)
    skipped = plan.skipped
    to_embed = plan.to_embed
    total = len(to_embed)

    for start in range(0, total, cfg.batch_size):
        batch = to_embed[start:start + cfg.batch_size]
        child_texts = [c for (_p, c) in batch]

        if not guard.can_afford(len(child_texts)):
            capped_by_cost = True
            break
        guard.charge(len(child_texts))

        # 2. Embed OUTSIDE any DB connection — it is slow (an LLM call), so holding a
        #    bounded tenant connection across it would starve the pool; and an
        #    embed-provider error propagates as itself, not as a tenant-DB error.
        embeddings = await retry_with_backoff_async(
            lambda: embed_documents(child_texts),
            attempts=cfg.max_retries,
            base_delay=cfg.retry_base_delay_seconds,
        )
        embedded += len(child_texts)

        # 3. Write the batch in a short checkout and commit it (checkpoint) so a
        #    later failure resumes from here rather than re-embedding committed work.
        with byod_engine.tenant_connection(company_id, registry=registry) as conn:
            cur = conn.cursor()
            for (parent_text, child_text), embedding in zip(batch, embeddings):
                if len(embedding) > EMBEDDING_DIMENSIONS:
                    embedding = embedding[:EMBEDDING_DIMENSIONS]

                parent_id = None
                if parent_text is not None:
                    parent_id = seen_parents.get(parent_text)
                    if parent_id is None:
                        cur.execute(
                            "INSERT INTO company_knowledge "
                            "(company_id, content, url, embedding, chunk_type, parent_id) "
                            "VALUES (%s, %s, %s, NULL, 'parent', NULL) RETURNING id",
                            (company_id, parent_text, source_name),
                        )
                        parent_id = str(cur.fetchone()[0])
                        seen_parents[parent_text] = parent_id

                cur.execute(
                    "INSERT INTO company_knowledge "
                    "(company_id, content, url, embedding, chunk_type, parent_id) "
                    "VALUES (%s, %s, %s, %s, 'child', %s)",
                    (company_id, child_text, source_name, embedding, parent_id),
                )
                added += 1
            conn.commit()  # checkpoint — committed work survives an interruption

        if on_progress is not None:
            on_progress(added, total)

    # 4. Prune superseded chunks — only on a COMPLETE run. If the cost guard stopped
    #    us, ``chunks`` was fully intended but not fully stored; deleting now would be
    #    fine for content drift, but we hold off so a partial run never mutates the
    #    stored set beyond what it added. ``current_fps`` is the full intended child
    #    set (incl. dedup-skipped chunks that survive unchanged), so anything not in
    #    it is genuinely gone from the source.
    if do_prune and not capped_by_cost:
        current_fps = {content_fingerprint(c) for (_p, c) in chunks}
        with byod_engine.tenant_connection(company_id, registry=registry) as conn:
            cur = conn.cursor()
            stored = stored_children_for_source(cur, company_id, source_name)
            stale_ids = plan_prune(stored, current_fps)
            if stale_ids:
                cur.execute(
                    "DELETE FROM company_knowledge WHERE company_id = %s AND id = ANY(%s::uuid[])",
                    (company_id, stale_ids),
                )
                pruned = cur.rowcount if cur.rowcount and cur.rowcount > 0 else len(stale_ids)
                # Remove parents for this source orphaned by the child deletes above.
                cur.execute(
                    "DELETE FROM company_knowledge "
                    "WHERE company_id = %s AND url = %s AND chunk_type = 'parent' "
                    "AND id NOT IN ("
                    "  SELECT parent_id FROM company_knowledge "
                    "  WHERE company_id = %s AND url = %s AND chunk_type = 'child' "
                    "    AND parent_id IS NOT NULL"
                    ")",
                    (company_id, source_name, company_id, source_name),
                )
                conn.commit()

    return IngestResult(
        added=added,
        skipped=skipped,
        embedded=embedded,
        total_candidates=len(chunks),
        capped_by_cost=capped_by_cost,
        pruned=pruned,
    )
