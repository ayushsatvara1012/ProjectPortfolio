# Single-Sheet Catalog Fan-Out Plan

## Problem

A chemical bot reads pricing from `product_skus` and SDS/spec from `products`.
Today the importer picks ONE table per sheet (most-specific full match wins), so a combined price+SDS sheet only populates `product_skus`; `products` stays empty and `get_sds` / `get_product_spec` return nothing, and the sheet's SDS column is silently dropped (`product_skus` has no SDS column).

Owners had to split their data into two sheets (one for price, one for SDS/spec).
They want a single wide sheet to power all features automatically.

## Goal

One uploaded sheet that carries both SKU/price columns AND an SDS column fans out into BOTH tables automatically:
- `product_skus`: every row (unchanged).
- `products`: the same data collapsed to one row per product+grade, pack sizes aggregated into `packaging`, SDS link carried into `sds_ref`.

Config-driven on the pack (no hardcoded vertical logic). The two-sheet workflow keeps working unchanged.

## Locked decision (user, 2026-07-10)

Fan-out to the secondary (coarser) table fires ONLY when the sheet actually carries that table's signature column (for `products`: an SDS column resolves to `sds_ref`).
Rationale: every import is replace-all. If a price-only sheet always fanned out to `products`, a later price-only re-upload would wipe previously-loaded SDS/packaging rows. Gating fan-out on the SDS column means price-only sheets never touch `products`, so SDS data is safe.

## Design

### `packs/schema.py` — extend `CatalogTable`

Add three optional, config-only fields (all default to today's behavior):

- `grain: Tuple[str, ...] = ()` — dedup key (canonical DB columns). When set, cleaned rows collapse to one row per distinct grain tuple.
- `aggregate_columns: Tuple[str, ...] = ()` — for a deduped table, these columns become the distinct-joined set of the group's values (", " joined). Non-grain, non-aggregate columns take the first non-null value in the group.
- `secondary_requires: Tuple[str, ...] = ()` — fan-out gate. When this table is NOT the primary (most-specific) full match for a sheet, it is imported only if ALL of these canonical columns resolved from the sheet. Empty = never imported as a secondary target (must be the primary).

### `packs/chemical.py` — configure the two tables

- `products`: `grain=("name","cas_number","grade")`, `aggregate_columns=("packaging",)`, `secondary_requires=("sds_ref",)`.
- `product_skus`: unchanged (no grain, never a secondary target).

### `services/catalog_import.py` — fan-out planning + grain dedup

`plan_catalog_import` per sheet:
1. Resolve columns + hit/total for every catalog table (as today).
2. `full_matches = [ct for ct in tables if total>0 and hit==total]`.
3. If none: keep existing near-miss / RAG handling (use the best partial for the warning).
4. `primary = max(full_matches, key=len(required_columns))` (most specific).
5. `targets = [primary]` + every other full match `ct` whose `secondary_requires` is non-empty and fully present in that table's resolved columns.
6. For each target: clean rows (existing `_clean_rows_for_table`), then if `ct.grain` is set, collapse via a new `_dedupe_by_grain(db_cols, rows, grain, aggregate_columns)` helper. Merge into `plan.tables[ct.table_name]` (existing multi-sheet merge/realign path).
7. Safety gate (zero valid rows aborts) applies per target as today.

`_dedupe_by_grain`: group rows by the tuple of grain-column values (case-insensitive, stripped); first row seeds each group; aggregate columns collect distinct truthy values in first-seen order joined by ", "; other columns keep the seed's value.

`apply_catalog_import` is unchanged (still replace-all per planned table).

## Tests (`tests/test_catalog_import.py`)

- Combined sheet (price + SDS) → `product_skus` gets all rows AND `products` gets one row per (name,cas,grade) with packaging aggregated + sds_ref set.
- Price-only sheet (no SDS column) → only `product_skus`; `products` NOT in plan (no clobber).
- Dedicated SDS/products sheet (name,cas,grade,packaging,sds, no price/pack) → only `products` (primary), grain dedup is a no-op.
- `_dedupe_by_grain` unit test: aggregation, first-non-null, case-insensitive keys.

## Verification

- Backend pytest green (existing catalog tests may need updating for the new fan-out).
- tsc + lint unaffected (no frontend change; the catalog viewer already renders whatever lands in `products`).
- Optionally re-run the trial sheet through `plan_catalog_import` in a scratch script to confirm the derived `products` rows.

## Out of scope

- The POR/`is_por` cleaning bug (separate task).
- Frontend changes (the catalog viewer from `docs/archived/catalog-viewer-plan.md` already shows both tables).
