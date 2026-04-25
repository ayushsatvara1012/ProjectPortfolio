-- V20: Hybrid Search (BM25 full-text + pgvector cosine)
--
-- Adds a GIN index on a generated tsvector column so PostgreSQL can run
-- full-text (BM25) search alongside the existing HNSW vector search.
-- The application layer merges both result sets using Reciprocal Rank Fusion.
--
-- Safe to run on existing data — the generated column back-fills automatically.

-- 1. Add a generated tsvector column that PostgreSQL keeps in sync automatically.
--    'english' stemming handles plurals, conjugations, etc.
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2. GIN index for fast full-text lookup.
CREATE INDEX IF NOT EXISTS idx_knowledge_fts
  ON company_knowledge
  USING gin(content_tsv);
