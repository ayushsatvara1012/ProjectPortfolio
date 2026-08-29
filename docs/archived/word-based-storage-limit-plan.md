# Word-based storage limit (replace "chunks" as the plan unit)

## Why

The knowledge-base storage limit is currently a raw "chunk" count (a chunk = one
~300-char embedded RAG vector, an internal ingestion-mechanics detail). The
frontend already papers over this everywhere except the super-admin Custom Plan
Builder: pricing page, Train page, Bots page, and both demo pages all display a
`chunks * 60` conversion labeled "words." The admin panel is the one place still
showing a raw chunk number to a human operator, which is confusing and was the
proximate trigger for this change (see conversation: admin wants to raise one
Explore-tier client's storage and finds "chunks" meaningless).

Decision: make **words** the real, system-wide unit — not just a display
conversion. Config, DB, quota enforcement, and every UI surface speak "words."
`chunk_type='child'/'parent'` rows remain the internal RAG storage mechanism
(unrelated, untouched) — words is the metric layered on top of it.

## Non-goals

- Not building per-company limit overrides independent of tier (a separate,
  already-discussed possible follow-up — out of scope here).
- Not changing the CUSTOM-plan-requires-price-to-provision constraint.
- Not retrofitting already-provisioned live BYOD tenant databases (schema
  version bump documents the change; existing tenants degrade gracefully — see
  Phase 5).

## Design

### Unit conversion (parity, not re-pricing)

Every existing "chunks" limit is multiplied by 60 (the frontend's existing
display constant) to become the words limit, so commercial parity is exact:

| Tier | old chunks | new words |
|---|---|---|
| FREE | 0 | 0 |
| EXPLORE | 200 | 12,000 |
| STARTER | 1,000 | 60,000 |
| PRO | 4,000 | 240,000 |
| BUSINESS | 15,000 | 900,000 |
| ENTERPRISE | 99,999 | 5,999,940 |
| BYOD | 50,000 | 3,000,000 |
| CUSTOM_PLAN_DEFAULTS.max_chunks | 100 | 6,000 (max_words) |

Pricing-page marketing copy already reads "60,000 / 240,000 / 900,000 / 12,000
words of knowledge" — these numbers become literally true (sourced from real
enforcement) instead of a coincidentally-matching display multiplier.

### Real word counting, not an estimate

Today the pre-flight quota gate estimates chunk count from `total_chars / 250`
before the text is actually split. Moving to words removes the need for that
estimate: the full document text is already in memory at that point, so the
gate computes `len(text.split())` directly — more accurate than the old
heuristic, not just renamed.

At ingestion, each **child** chunk gets a stored `word_count` (`len(text.split())`).
Quota accounting sums `word_count` over child rows instead of counting rows.
Parent rows stay free storage (unchanged).

### New column: `company_knowledge.word_count`

Additive, nullable `INTEGER`. Backfilled once in the migration itself via
Postgres (`regexp_split_to_array`), not an app-level script — safe, idempotent,
one-shot.

## Phases

### Phase 1 — DB migration
- `alembic_migrations/versions/0035_company_knowledge_word_count.py`: add
  `word_count INTEGER` to `company_knowledge` (control plane), backfill
  existing child rows in-DB, idempotent (`WHERE word_count IS NULL`).
- `byod_dataplane.py`: append `ALTER TABLE company_knowledge ADD COLUMN IF NOT
  EXISTS word_count INTEGER;` to `_build_schema_sql()`; bump
  `DATA_PLANE_SCHEMA_VERSION` to `"0002"`. New BYOD provisions get the column
  from day one. Already-provisioned tenants are not retrofitted by this change
  (no live-tenant migration runner exists yet — same limitation the v21
  chunk_type migration accepted); their old rows have `word_count IS NULL` and
  are treated as 0 words until re-ingested (matches the "old data keeps
  working without re-ingestion" precedent in the v21 migration comment).

### Phase 2 — Backend config layer (`core/config.py`, `db/models.py`)
- `PLAN_LIMITS[tier]["chunks"]` → `["words"]`, values ×60 per table above.
- `UNLIMITED_PLAN["chunks"]` → `["words"]`.
- `CUSTOM_PLAN_DEFAULTS["max_chunks"]` → `["max_words"]` (100 → 6000).
- `BYOD_PLAN_DEFAULTS` derivation line updates to `max_words`.
- `db/models.py` `CustomPlanConfig`: `max_chunks` field → `max_words`
  (validator list updates too).

### Phase 3 — Backend enforcement (`main.py`)
- `get_plan()`: return `"words"` key; custom-plan branch reads
  `cfg.get("max_words")`.
- `/api/train` pre-flight gate: quota SQL `COUNT(*) WHERE chunk_type='child'`
  → `COALESCE(SUM(word_count), 0) WHERE chunk_type='child'`; `estimated_chunks`
  (char/250 heuristic) → `estimated_words = sum(len(d.page_content.split())
  for d in docs)` (exact); error codes `CHUNK_LIMIT_EXCEEDED` →
  `WORD_LIMIT_EXCEEDED`, `CHUNK_QUOTA_OVERFLOW` → `WORD_QUOTA_OVERFLOW`;
  messages drop "chunk" wording.
- `run_training_job`: compute `word_count` per child chunk at insert time,
  include it in both INSERT statements (tabular flat-child path and
  parent-child path); quota check + the truncation cap switch from
  row-count-based (`all_child_texts_flat[:remaining]`) to cumulative
  word-budget-based (accumulate `word_count` per child, stop once the running
  total would exceed `remaining` words) — a chunk is no longer an atomic unit
  of quota, a word is.
- `_byod_remaining_chunk_quota` → rename `_byod_remaining_word_quota`; SQL
  `COUNT(*)` → `SUM(word_count)`; same cumulative-budget capping applied to
  `_byod_run_training_job`'s `chunks[:remaining]` slice.
- `byod_ingest.run_tenant_ingest`: both `INSERT INTO company_knowledge`
  statements gain `word_count` column + computed value.
- `/api/companies`: SQL `chunks_used` stays as a raw child-row COUNT (kept —
  it's the "N segments indexed" footer metric, a legitimate mechanics display,
  not a quota) but add `words_used` = `SUM(word_count)`; `chunk_limit` →
  `word_limit`.
- `/api/me`: `chunk_limit` → `word_limit`.
- Segment browser / preview endpoints (`/api/knowledge/chunks/{id}`,
  `/api/knowledge/sources`) are untouched — chunk-level mechanics, already
  labeled "segments" in the UI, not the quota unit.

### Phase 4 — Frontend
- `src/lib/validation/schemas.ts`: `customPlanConfigSchema.max_chunks` →
  `max_words`.
- `src/lib/types/api.ts`: `chunk_limit` → `word_limit`; `chunks_added?` →
  `words_added?`.
- Admin panel (`.../settings/admin/page.tsx`): `BLANK_CUSTOM_CONFIG.max_chunks`
  → `max_words`; `buildCandidate()`, `validate()`, initial-draft mapping all
  follow; `NumInput label="Knowledge base chunks"` → `"Knowledge base words"`
  (placeholder scaled ×60, hint text updated to drop "RAG vector chunks"
  wording); `PlanRowDetail` summary row `'Chunks'` → `'Words'`.
- `dashboard/train/page.tsx`: `chunksUsed`/`chunkLimit` → `wordsUsed`/
  `wordLimit`, read directly from `words_used`/`word_limit` (drop the `* 60`
  display math — now backend-native); "N segment(s) indexed" footer keeps
  using the raw `chunks_used` (segment count, unchanged metric).
- `dashboard/bots/BotsClient.tsx`: `plan.chunk_limit` → `plan.word_limit`, drop
  `* 60`.
- `demo/bots/page.tsx`, `demo/train/page.tsx` (pure client-side sandbox, no
  backend): `chunkLimit = 200` → `wordLimit = 12000`; `chunksUsed =
  chunks.length` (a proxy) → real word count of the accumulated demo text;
  segment-count footer keeps using the raw array length.
- `InlineTrainingWidget.tsx`, `UpgradePrompt.tsx`: error-code strings
  `CHUNK_LIMIT_EXCEEDED`/`CHUNK_QUOTA_OVERFLOW` → `WORD_LIMIT_EXCEEDED`/
  `WORD_QUOTA_OVERFLOW`, fallback message text updated.
- `pricing/components.tsx`: no change — static marketing copy already reads
  "words" with the correct ×60-parity numbers.

### Phase 5 — Tests
- `sapybase_ai_engine/tests/test_plan_limits.py`: `["chunks"]` → `["words"]`
  assertions, values ×60.
- `sapybase_ai_engine/tests/test_custom_plan_flow.py`: `max_chunks` →
  `max_words` throughout.
- `src/__tests__/subscription-tiers.test.ts`: mirror the same rename + value
  scaling.
- Add one backfill-safety test: a `company_knowledge` child row with
  `word_count IS NULL` is treated as 0 in quota SQL (`COALESCE`), proving the
  BYOD graceful-degradation path from Phase 1.

## Rollout

- Local: run backend pytest + frontend vitest + `tsc --noEmit` green after
  Phases 2–5.
- Migration 0035 applied dark to the prod control DB via Supabase MCP
  (additive, idempotent) once code is ready — same pattern as prior
  migrations in this project. Requires explicit go-ahead before touching prod.
- No BYOD tenant retrofit in this pass (see Non-goals).

## Status: implemented, migration not yet applied to prod

All 5 phases done 2026-07-16, uncommitted on local `MainV2`.
Backend: 1510 pytest passing (0 failed).
Frontend: 407 vitest passing, `tsc --noEmit` clean, `npm run lint` clean (0
new errors — pre-existing warnings only, none in touched files).

Deviations from the original design during implementation:
- `chunks_used` (raw child-row COUNT) was kept as its own field on
  `/api/companies` alongside the new `words_used` (SUM word_count) — needed
  for the "N segments indexed" footer metric, which is legitimately a
  row/segment count, not the quota.
- `run_training_job`'s `old_child_count` (row COUNT, not SUM) had to be kept
  separately from the word-sum quota calc — it gates the upsert delete-old-
  rows step via `>0`, and a legacy source with `word_count IS NULL` rows
  would wrongly read as 0 words even though real rows exist to clean up.
- Found and fixed an "unlimited" display-threshold bug the ×60 scaling
  introduced: `word_limit >= 999999` incorrectly matched ENTERPRISE's real
  words value (5,999,940) as "Unlimited" in `BotsClient.tsx` and
  `train/page.tsx`. Threshold raised to `10000000` (still well under
  UNLIMITED_PLAN's 999,999,999) in both places.
- Extended the "chunks" → "segments" wording cleanup to a few adjacent
  mechanics-level UI strings (delete-confirm dialogs, training-progress
  label, toast messages) for full consistency, per the user's "make sure
  everything is synced" ask — not strictly required by the plan's phase list
  but same-spirit.

Migration 0035 applied dark to the prod control DB (`tticllabbbqwnhsmggfo`)
2026-07-16 via Supabase MCP: `word_count` column added + backfilled on all
619 child rows (100% coverage, 16,807 total words across current tenants) and
92 parent rows. `alembic_version` intentionally left at `0034` — the next
real deploy's `alembic upgrade head` will find the column/backfill already
done (idempotent) and just stamp `0035` as a no-op, per this project's
established dark-migration pattern.

NEXT: commit (not yet committed or pushed — user said commit only on
request).
