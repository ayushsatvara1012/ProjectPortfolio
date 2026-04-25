-- V21: Parent-Child Chunking
--
-- Adds two columns to company_knowledge to support the small-to-big retrieval
-- pattern:
--   chunk_type : 'child'  — small chunk (embedded + searched, counts toward quota)
--                'parent' — large chunk (stored only, returned to the LLM as context)
--   parent_id  : UUID FK pointing from a child row to its parent row.
--
-- Existing rows (all flat chunks) are labelled 'child' with no parent.
-- This is safe: the retrieval logic falls back to returning the child's own
-- content when parent_id IS NULL, so old data keeps working without re-ingestion.
--
-- Re-ingesting a source via /api/train will upgrade that source to parent-child.
-- You do NOT need to re-ingest everything at once.

-- 1. Add chunk_type column (default 'child' so existing rows are classified correctly)
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'child'
    CHECK (chunk_type IN ('child', 'parent'));

-- 2. Add parent_id FK (nullable — children point to parent, parents leave it NULL)
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES company_knowledge(id) ON DELETE CASCADE;

-- 3. Index for fast parent lookup from child
CREATE INDEX IF NOT EXISTS idx_knowledge_parent_id
  ON company_knowledge(parent_id)
  WHERE parent_id IS NOT NULL;

-- 4. Index to quickly count/list only child chunks (quota enforcement, UI preview)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_type
  ON company_knowledge(company_id, chunk_type);

-- 5. Quota-aware view: only child rows count toward the plan limit.
--    Application code uses this view for COUNT queries instead of the raw table.
CREATE OR REPLACE VIEW company_knowledge_child_count AS
  SELECT company_id, COUNT(*) AS child_count
  FROM company_knowledge
  WHERE chunk_type = 'child'
  GROUP BY company_id;
