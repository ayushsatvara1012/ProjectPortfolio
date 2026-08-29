# Catalog Auto-Import — Robust Ingestion Plan

> **Goal**: When a vertical bot (e.g. chemical) uploads a tabular file, sheets that
> represent structured catalog data (`products`, `product_skus`) are auto-imported
> into the right DB tables instead of being silently embedded as RAG knowledge —
> and the importer must survive *dirty, real-world* client spreadsheets.

## Background

`get_sds`, `get_product_spec`, and `request_quote` read from the structured
`products` / `product_skus` tables, NOT from `company_knowledge` (the RAG store).
The first cut of auto-import (commit on `MainV2`) matched sheets strictly: exact
column names, header on row 1, clean cells. Real client files break all three
assumptions, and an unmatched sheet fell back to RAG silently — reproducing the
original "I trained it but SDS returns nothing" bug. Worse, the importer did a
full `DELETE` + `INSERT`, so a header-only sheet could wipe a live catalog.

## Locked decisions (owner)

1. **Re-upload = replace-all.** The uploaded file is the complete current catalog.
2. **Near-miss = warn + RAG.** Import what matches; embed the rest as knowledge,
   but return an explicit warning naming the sheet and missing columns.
3. **Fuzzy header matching** via a curated synonym list declared per catalog table.

Refinements (not in question, clearly correct):
- All sheets import inside **one transaction** (all-or-nothing).
- **CSV** uploads run through the same matcher, not only `.xlsx`.

## The 5-stage ingestion pipeline

1. **Header cleanup** — detect the real header row (skip title/logo rows), then
   normalize names (lowercase, trim, punctuation→`_`).
2. **Synonym resolve + match** — map normalized headers to canonical DB columns
   via the pack's synonym map; a sheet matches a table when all `required_columns`
   resolve. A sheet that resolves *some* required columns but not all is a
   **near-miss** (flagged, not silently buried).
3. **Row clean + validate** — per row: trim; strip currency (`₹`, `Rs.`, `,`,
   `/-`) and parse numerics; map `POR`/`-`/`N/A`/blank → NULL; parse booleans
   (`TRUE`/`yes`/`Y`/`1`); strip `%` from rates; drop rows missing a NOT-NULL key
   (e.g. `name`), recording a skip reason.
4. **Safety gate** — if a target table cleans to **zero valid rows**, ABORT that
   table's import (never delete existing data). Surface a clear error.
5. **Apply + report** — group rows by target table across all sheets (two
   `products` tabs merge, not clobber), one `DELETE`+`INSERT` per table inside a
   single transaction; return `{imported, skipped+reasons}` per table plus
   near-miss warnings.

## Edge cases covered

| # | Case | Handling |
|---|------|----------|
| H1 | Casing/spacing (`CAS Number`) | normalize → match |
| H2 | Synonyms (`CAS #`, `Rate`, `MRP`, `Chemical Name`) | pack synonym map |
| H3 | Title/logo rows above header | `_find_header_row` detection |
| H4 | Duplicate/blank (`Unnamed: N`) headers | ignored; only resolved cols used |
| H5 | Extra unrelated columns | ignored |
| D1 | Currency/commas/`/-` in price | strip → float |
| D2 | `POR`/`-`/`N/A`/blank price | NULL (+ `is_por` stays as given) |
| D3 | Boolean variants for `is_por` | parsed to bool |
| D4 | `gst_rate` as `18%` | strip `%` |
| D5 | Whitespace/unicode | trimmed |
| M1 | Row missing NOT-NULL key (`name`) | skipped + reason |
| M2 | Entirely blank rows | skipped |
| S1 | Sheet matches no table but looks catalog-ish | near-miss warning + RAG |
| S2 | Two sheets → same table | merged before single replace |
| S3 | Genuine FAQ/text sheet | RAG (correct, no warning) |
| C1 | Header-only / all-invalid sheet | safety gate: no delete, error |
| C2 | One table ok, next fails | single transaction rolls back all |
| C3 | CSV of catalog data | same matcher path |
| F1 | Importer throws | clear 400 message, full rollback, nothing applied |
| Sec1 | SQL identifiers | table/column names validated against `information_schema`, never raw user text |

## Files

- `packs/schema.py` — extend `CatalogTable` with `synonyms` + `not_null_columns`.
- `packs/chemical.py` — declare synonyms for `products` / `product_skus`.
- `services/catalog_import.py` *(new)* — pure pipeline: header detect, match,
  clean, plan; plus `apply_catalog_import(cursor, company_id, plan)`.
- `main.py` `/api/train` — call the planner for vertical bots over all sheets
  (xlsx + csv), apply in one transaction, build the response summary/warnings.
- `tests/test_catalog_import.py` *(new)* — unit-cover every edge case above.

## Status

- [x] schema + pack synonyms (`CatalogTable.synonyms`/`not_null_columns`; chemical pack filled)
- [x] `services/catalog_import.py` (header detect, synonym match, row clean, safety gate, plan/apply)
- [x] `/api/train` rewire (single txn, csv+xlsx, warnings in response); shared `_df_to_documents` helper
- [x] tests green — `tests/test_catalog_import.py` 42 cases; full suite no new failures (88 pre-existing only)
- [x] end-to-end dirty-workbook sanity (title rows, synonyms, ₹/%/POR, FAQ→RAG) verified
- [ ] commit + push (awaiting user OK)
- [ ] live re-upload test on Test Web bot `c94ea365` once deployed

Old first-cut helpers (`_match_catalog_table`, `import_catalog_sheet` in
`services/agent.py`) were removed — superseded by `services/catalog_import.py`.
