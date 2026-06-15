-- BYOD data-plane fixture schema (Phase 0.1, test harness only)
-- ---------------------------------------------------------------------------
-- This is a MINIMAL, representative slice of the data-plane tables a BYOD
-- tenant database holds (see RFC §2 / Appendix A.7). It exists so the test
-- harness can spin an ephemeral tenant Postgres, seed it, and run a real
-- vector query against it.
--
-- IMPORTANT: this is NOT the authoritative data-plane migration set. The real,
-- versioned data-plane Alembic lineage is built in Phase 3.1. Keep this file in
-- sync with the columns the engine actually reads/writes (mirrors the columns
-- in main.py's INSERT/SELECT statements and SCHEMA_AUDIT_2026-04-26.md), but do
-- not treat it as production schema.
--
-- The vector(N) dimension MUST equal EMBEDDING_DIMENSIONS (768) from
-- embedding_config.py. The harness substitutes {EMBEDDING_DIMENSIONS} below so
-- the two can never silently drift.

CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base: RAG vectors. Mirrors company_knowledge (SCHEMA_AUDIT §company_knowledge).
CREATE TABLE IF NOT EXISTS company_knowledge (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid,
    url         text,
    content     text,
    embedding   vector({EMBEDDING_DIMENSIONS}),
    created_at   timestamptz DEFAULT now(),
    chunk_type  text NOT NULL DEFAULT 'child',
    parent_id   uuid
);

-- HNSW index on cosine distance, mirroring the production RAG search operator
-- (embedding <=> query). Proves index creation works on the tenant DB.
CREATE INDEX IF NOT EXISTS company_knowledge_embedding_hnsw
    ON company_knowledge USING hnsw (embedding vector_cosine_ops);

-- Conversation log. Mirrors the INSERT in main.py /api/chat.
CREATE TABLE IF NOT EXISTS chat_logs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    uuid,
    user_query    text,
    bot_response  text,
    was_cache_hit boolean DEFAULT false,
    is_unanswered boolean DEFAULT false,
    session_id    text,
    confidence    double precision,
    created_at     timestamptz DEFAULT now()
);

-- Captured leads + scoring. Mirrors the INSERT in main.py /api/leads/capture.
CREATE TABLE IF NOT EXISTS lead_capture (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    uuid,
    email         text,
    name          text,
    context       text,
    score         integer,
    score_band    text,
    score_reasons text,
    page_url      text,
    referrer      text,
    utm_source    text,
    utm_medium    text,
    utm_campaign  text,
    created_at     timestamptz DEFAULT now()
);
