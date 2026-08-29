# Catalog Viewer Plan

## Problem

When a vertical bot (e.g. chemical) uploads a catalog-shaped sheet, the rows are routed into the structured `products` / `product_skus` tables instead of RAG (`services/catalog_import.py`, `main.py` `/api/train`).
The "Manage knowledge" panel only lists RAG chunks, so imported catalog rows are invisible in the dashboard.
Owners upload a price list, get a success toast, then see nothing in Manage Knowledge and assume the import failed.

There is currently no dashboard UI anywhere that renders `product_skus` / `products`.

## Goal

Add a read-only "Product catalog" viewer to the Train page that shows the structured rows the bot's tools (`get_product_spec`, `request_quote`, `get_sds`) actually read from.
Driven entirely by the pack's `catalog_tables` config (no hardcoded `if chemical`).
Non-vertical bots (no `catalog_tables`) show nothing.

## Scope (v1)

- View only: list rows per catalog table with real column headers, row count, scroll.
- Self-hiding: if the bot's pack has no `catalog_tables` or the tables are empty, the section renders nothing.
- NOT in scope: editing rows, per-row delete, fixing the `products`-stays-empty planner behavior (tracked separately).

## Backend

New endpoint `GET /api/knowledge/catalog/{company_id}` in `main.py` (next to the other `/api/knowledge/*` endpoints).

- Ownership guard: `SELECT id FROM companies WHERE id = %s AND user_id = %s AND is_active = true` (same as `get_knowledge_sources`).
- Load the company's vertical -> `load_pack(vertical)`. If no pack or `pack.catalog_tables` is empty, return `{"tables": []}`.
- For each `CatalogTable`:
  - Fetch its real columns + order from `information_schema.columns`, excluding `id`, `company_id`, `created_at`, `updated_at` (same query the import uses).
  - If the table has no columns (missing on this DB), skip it.
  - `SELECT <cols> FROM <table> WHERE company_id = %s ORDER BY <first required col> LIMIT 500`.
  - Count total rows for the company.
  - Table + column identifiers come only from pack config + information_schema, never raw client text (same safety rule as the importer).
- Catalog rows live on the control-plane DB (the importer writes via `get_db_connection()`, not BYOD tenant routing), so the viewer reads the control plane too. Consistent with where the data actually is.
- Response:
  ```json
  {
    "tables": [
      {
        "table_name": "product_skus",
        "columns": ["product_name", "cas_number", "grade", "pack_code", "pack_size", "list_price", "gst_rate", "hsn_code", "is_por", "currency"],
        "rows": [["Acetone", "67-64-1", "LR", "100LR0500M", "500 ml", "413.00", "18.00", "29.14.1100", false, "INR"], ...],
        "total": 9,
        "showing": 9
      }
    ]
  }
  ```

## Frontend

New `CatalogBrowser` component in `src/app/(app)/dashboard/train/page.tsx`, rendered inside a new "Product catalog" Card above or below "Manage knowledge".

- Query `['knowledge-catalog', selectedBotId]` -> `/api/knowledge/catalog/{botId}`.
- If `tables` is empty (non-vertical bot or nothing imported), return `null` (whole Card hidden by the parent checking the data, or the component renders nothing).
- For each table: a titled, horizontally scrollable table with column headers (humanized) and rows. Numeric/price columns right-aligned; booleans as yes/no; empty cells as a muted dash.
- Cap display at the 500 rows the API returns; show `showing/total` if truncated.
- Match the visual language of the existing knowledge browser (Card, SectionHeader, Badge, custom-scrollbar, dark mode).
- Invalidate `['knowledge-catalog', selectedBotId]` after a successful train upload (alongside the existing knowledge invalidations) so a fresh import shows immediately.

## Verification

- Backend pytest green.
- `npx tsc --noEmit` + `npm run lint` clean.
- Drive the Train page in the preview browser: upload the trial chemical CSV, confirm the catalog viewer shows the 9 imported SKU rows; confirm a non-vertical bot shows no catalog section.

## Follow-ups (not this change)

- `products` table stays empty when a combined sheet fully matches both `products` and `product_skus` (planner picks the most specific only) -> `get_sds` finds no `sds_ref`.
- Clearer upload feedback distinguishing "imported to catalog" vs "added to knowledge base".
