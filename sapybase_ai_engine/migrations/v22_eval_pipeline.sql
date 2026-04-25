-- V22: RAG Evaluation Pipeline
--
-- Stores evaluation runs and per-question scores so you can measure
-- retrieval quality and answer faithfulness before and after each
-- improvement (HyDE, reranking, hybrid search, parent-child chunking).

-- One row per evaluation run (a batch of test questions)
CREATE TABLE IF NOT EXISTS eval_runs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_label     TEXT NOT NULL,           -- e.g. "after-hybrid-search", "baseline"
    triggered_by  TEXT,                   -- clerk_id of the user who triggered it
    total_questions INT NOT NULL DEFAULT 0,
    avg_retrieval_score  NUMERIC(4,2),    -- 0.0 – 10.0, average across questions
    avg_faithfulness_score NUMERIC(4,2),  -- 0.0 – 10.0, average across questions
    avg_combined_score   NUMERIC(4,2),    -- simple mean of the two averages
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- One row per question within a run
CREATE TABLE IF NOT EXISTS eval_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    expected_answer TEXT NOT NULL,        -- ground-truth provided by the user
    retrieved_chunks TEXT,               -- what the RAG pipeline actually fetched
    actual_answer   TEXT,                -- what the LLM replied
    retrieval_score NUMERIC(4,2),        -- 0–10: did retrieval find relevant chunks?
    faithfulness_score NUMERIC(4,2),     -- 0–10: does the answer match the expected?
    retrieval_reason   TEXT,             -- judge's one-line reasoning
    faithfulness_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_company
    ON eval_runs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eval_results_run
    ON eval_results(run_id);
