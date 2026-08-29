"""Robust catalog auto-import for vertical bots.

When a vertical bot (e.g. chemical) uploads a tabular file, sheets that represent
structured catalog data — the ``products`` / ``product_skus`` tables that
``get_sds`` / ``get_product_spec`` / ``request_quote`` read from — are imported
into those tables instead of being embedded as RAG knowledge.

Real client spreadsheets are dirty, so this module is built to be *forgiving on
input, strict on safety, and loud about what it did* (see
docs/archived/catalog-auto-import-plan.md). The five stages:

  1. Header cleanup    — detect the real header row (skip title/logo rows).
  2. Synonym + match   — map normalized headers to canonical DB columns via the
                         pack's synonym list; a sheet matches when ALL of a
                         table's ``required_columns`` resolve.
  3. Row clean         — strip currency/commas from numerics, map POR/-/N/A → NULL,
                         parse booleans, drop NOT-NULL-violating rows with a reason.
  4. Safety gate       — a matched table that cleans to ZERO valid rows ABORTS
                         (never deletes existing data).
  5. Apply + report    — group rows per table across sheets (two tabs merge, not
                         clobber); one DELETE+INSERT per table; caller wraps the
                         whole thing in a single transaction.

This module is *pure data* (no langchain/Document deps): unmatched sheets are
returned as DataFrames for the caller to embed as RAG, and the structured write
is a plain cursor call so the caller owns the transaction.

SECURITY: table and column identifiers are only ever taken from the pack config
and validated against ``information_schema`` — never interpolated from raw client
text. Every write is scoped by ``company_id``.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

HEADER_SCAN_ROWS = 15
# Cell values that mean "no price" for a numeric column.
_NULLISH = {"", "-", "—", "–", "n/a", "na", "n.a", "n.a.", "nil", "none",
            "por", "p.o.r", "price on request", "on request", "tbd", "—/—"}
_TRUTHY = {"true", "t", "yes", "y", "1", "por", "price on request", "on request"}
# The subset of nullish price tokens that specifically mean "price on request"
# (a deliberate no-list-price), as opposed to a merely blank/missing price. A POR
# price sets the table's POR flag (see CatalogTable.por_flag_from); "-", "n/a",
# blank, etc. do NOT — they stay "price simply missing".
_POR_TOKENS = {"por", "p.o.r", "price on request", "on request"}


# ── Header normalization & detection ─────────────────────────────────────────

def normalize_header(name: object) -> str:
    """Canonicalize a header cell: lowercase, trim, punctuation/space → ``_``.

    ``"CAS  No."`` → ``"cas_no"``, ``"GST %"`` → ``"gst_%"`` is collapsed to
    ``"gst_"`` then stripped → ``"gst"``. Keeps ``#`` and ``%`` out by mapping all
    non-alphanumerics to ``_`` and squeezing repeats, so the synonym lists stay
    readable (alias ``"cas_#"`` normalizes the same way the header does).
    """
    s = str(name).strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _row_text_density(row_values) -> int:
    """Count non-empty, non-numeric cells — a good header row is text-rich."""
    count = 0
    for v in row_values:
        s = str(v).strip()
        if not s or s.lower() in ("nan", "none"):
            continue
        try:
            float(s)
        except ValueError:
            count += 1
    return count


def detect_header_row(raw_df) -> int:
    """0-based index of the most likely header row in a header=None DataFrame.

    Scans the first ``HEADER_SCAN_ROWS`` rows and picks the one with the most
    text labels (earliest wins ties), so title/logo/metadata rows above the real
    header are skipped.
    """
    probe = raw_df.iloc[:HEADER_SCAN_ROWS]
    best_idx, best_score = 0, -1
    for i, (_, row) in enumerate(probe.iterrows()):
        score = _row_text_density(row.values)
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def reheader(raw_df):
    """Promote the detected header row to columns; drop the rows above it.

    Returns a new DataFrame whose columns are the real header and whose rows are
    only the data below it. Column names are the raw header cells (str).
    """
    hdr = detect_header_row(raw_df)
    header_vals = [str(v).strip() for v in raw_df.iloc[hdr].values]
    body = raw_df.iloc[hdr + 1:].copy()
    body.columns = header_vals
    return body


# ── Synonym resolution & matching ────────────────────────────────────────────

def build_alias_index(catalog_table, db_columns: Tuple[str, ...]) -> Dict[str, str]:
    """Map every accepted normalized alias → canonical DB column.

    A column's own name is always an implicit alias, plus everything in the
    pack's ``synonyms`` and legacy ``column_map``. Only aliases whose target is a
    real DB column are kept (so a typo in a synonym list can't invent a column).
    """
    db_set = set(db_columns)
    index: Dict[str, str] = {}
    for col in db_columns:
        index[normalize_header(col)] = col
    for db_col, aliases in (getattr(catalog_table, "synonyms", {}) or {}).items():
        if db_col not in db_set:
            continue
        for alias in aliases:
            index[normalize_header(alias)] = db_col
    for raw_alias, db_col in (getattr(catalog_table, "column_map", {}) or {}).items():
        if db_col in db_set:
            index[normalize_header(raw_alias)] = db_col
    return index


def resolve_columns(sheet_columns, catalog_table, db_columns) -> Dict[Any, str]:
    """``sheet_column → db_column`` for headers this table understands.

    First resolution wins on duplicate targets (a sheet with two "price"-ish
    columns maps only the first). Unrecognized headers are simply omitted.
    """
    index = build_alias_index(catalog_table, tuple(db_columns))
    resolved: Dict[Any, str] = {}
    used_targets: set = set()
    for sheet_col in sheet_columns:
        db_col = index.get(normalize_header(sheet_col))
        if db_col and db_col not in used_targets:
            resolved[sheet_col] = db_col
            used_targets.add(db_col)
    return resolved


def _required_hits(resolved: Dict[Any, str], catalog_table) -> Tuple[int, int]:
    """(matched_required, total_required) for this table's required columns."""
    targets = set(resolved.values())
    req = catalog_table.required_columns
    hit = sum(1 for rc in req if rc in targets)
    return hit, len(req)


# ── Row cleaning ─────────────────────────────────────────────────────────────

def clean_numeric(raw: str) -> Optional[float]:
    """Parse a possibly-dirty money/number cell. Returns None for nullish/POR.

    Strips currency symbols, commas, trailing ``/-``, ``%`` and whitespace.
    ``"₹1,450.00"`` → ``1450.0``, ``"POR"`` → ``None``, ``"18%"`` → ``18.0``.
    """
    s = str(raw).strip()
    if s.lower() in _NULLISH:
        return None
    s = s.replace(",", "")
    s = re.sub(r"[₹$€£]", "", s)
    s = re.sub(r"(?i)\b(rs|inr|usd)\.?\s*", "", s)
    s = s.replace("/-", "").replace("%", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def clean_bool(raw: str) -> bool:
    return str(raw).strip().lower() in _TRUTHY


@dataclass
class TablePlan:
    table_name: str
    db_columns: List[str]
    rows: List[List[Any]] = field(default_factory=list)   # values aligned to db_columns
    skipped: List[str] = field(default_factory=list)
    source_sheets: List[str] = field(default_factory=list)


@dataclass
class CatalogPlan:
    tables: Dict[str, TablePlan] = field(default_factory=dict)
    rag_sheets: List[Tuple[str, Any]] = field(default_factory=list)  # (name, clean_df)
    warnings: List[str] = field(default_factory=list)


class CatalogImportError(ValueError):
    """A matched catalog sheet could not be safely imported (e.g. zero valid
    rows after cleaning → refusing to wipe existing data)."""


def _cell_str(raw, pd) -> str:
    """Normalize a raw cell to a trimmed string ('' for null/NaN)."""
    s = "" if (raw is None or (isinstance(raw, float) and pd.isna(raw))) else str(raw).strip()
    return "" if s.lower() == "nan" else s


def _clean_rows_for_table(df, resolved, catalog_table, db_types, sheet_name):
    """Yield cleaned value-lists for a table, plus per-row skip reasons.

    Returns (db_columns_order, rows, skipped_reasons).

    POR inference (config-driven via ``CatalogTable.por_flag_from``): when the
    configured price column reads a price-on-request token, the flag column is set
    TRUE — synthesized into the write even if the sheet has no explicit flag
    column — so the agent can tell POR apart from a merely missing price.
    """
    import pandas as pd

    db_cols = list(dict.fromkeys(resolved.values()))   # stable, unique
    bool_cols = set(getattr(catalog_table, "boolean_columns", ()) or ())
    notnull = set(getattr(catalog_table, "not_null_columns", ()) or ())
    inv_resolved: Dict[str, Any] = {v: k for k, v in resolved.items()}

    # POR flag from the price cell (see _POR_TOKENS). Active only when the price
    # column is actually present in this sheet; the flag column is added to the
    # write set when the sheet doesn't carry its own.
    por_pair = getattr(catalog_table, "por_flag_from", ()) or ()
    por_price_col, por_flag_col = por_pair if len(por_pair) == 2 else (None, None)
    por_active = bool(por_price_col and por_flag_col and por_price_col in db_cols)
    if por_active and por_flag_col not in db_cols:
        db_cols.append(por_flag_col)

    rows: List[List[Any]] = []
    skipped: List[str] = []
    for ridx, (_, row) in enumerate(df.iterrows()):
        # entirely blank row?
        if all((not str(row[sc]).strip() or str(row[sc]).strip().lower() == "nan")
               for sc in resolved):
            continue

        price_is_por = (
            por_active
            and _cell_str(row[inv_resolved[por_price_col]], pd).lower() in _POR_TOKENS
        )

        values: List[Any] = []
        skip_reason: Optional[str] = None
        for db_col in db_cols:
            if db_col == por_flag_col:
                # TRUE if the sheet's own flag cell is truthy OR the price reads
                # price-on-request. Handled here so a synthesized flag column
                # (no sheet source) still gets a value.
                explicit = (
                    db_col in inv_resolved
                    and clean_bool(_cell_str(row[inv_resolved[db_col]], pd))
                )
                values.append(bool(explicit or price_is_por))
                continue

            sval = _cell_str(row[inv_resolved[db_col]], pd)

            if db_col in bool_cols:
                values.append(clean_bool(sval))
                continue

            dtype = db_types.get(db_col, "text")
            if dtype in ("numeric", "integer", "bigint", "double precision", "real"):
                values.append(clean_numeric(sval))
            else:
                values.append(sval if sval else None)

            if db_col in notnull and not sval:
                skip_reason = f"missing required '{db_col}'"

        if skip_reason:
            skipped.append(f"sheet '{sheet_name}' row {ridx + 2}: {skip_reason}")
            continue
        rows.append(values)

    return db_cols, rows, skipped


# ── Planning ─────────────────────────────────────────────────────────────────

def plan_catalog_import(
    sheets: List[Tuple[str, Any]],
    catalog_tables: Tuple[Any, ...],
    db_schema: Dict[str, Dict[str, str]],
) -> CatalogPlan:
    """Classify and clean every sheet without touching the DB.

    ``sheets``     : list of (sheet_name, raw_df) where raw_df was read with
                     header=None (so we can detect the real header row).
    ``db_schema``  : {table_name: {db_column: data_type}} for each catalog table,
                     fetched once from information_schema by the caller.

    Returns a CatalogPlan: structured rows grouped per table (sheets targeting the
    same table merge), the leftover sheets to embed as RAG, and human-readable
    warnings (near-misses + skipped rows). Raises CatalogImportError if a clearly
    matched table would import zero rows (safety gate).
    """
    plan = CatalogPlan()

    for sheet_name, raw_df in sheets:
        if raw_df is None or raw_df.empty:
            continue
        df = reheader(raw_df)
        sheet_cols = list(df.columns)

        # Resolve every table against this sheet. A FULL match (every required
        # column resolves) beats any partial. One wide sheet can feed SEVERAL
        # tables (fan-out): the most-specific full match is the PRIMARY target;
        # other full matches join only if they opt in via `secondary_requires`
        # and the sheet carries those columns (e.g. `products` fans out from a
        # price sheet only when an SDS column is present). Partials are handled
        # as near-misses / RAG using the best partial for the warning.
        full_matches: List[Tuple[Any, Dict[Any, str]]] = []
        best_partial = None        # (ct, resolved, hit)
        for ct in catalog_tables:
            db_cols = tuple(db_schema.get(ct.table_name, {}).keys())
            if not db_cols:
                continue
            resolved = resolve_columns(sheet_cols, ct, db_cols)
            hit, total = _required_hits(resolved, ct)
            if total > 0 and hit == total:
                full_matches.append((ct, resolved))
            elif hit > 0 and (best_partial is None or hit > best_partial[2]):
                best_partial = (ct, resolved, hit)

        if not full_matches:
            if best_partial is not None:
                # Near-miss: looked like a catalog but missing required columns.
                ct, resolved, _hit = best_partial
                missing = [rc for rc in ct.required_columns
                           if rc not in set(resolved.values())]
                plan.warnings.append(
                    f"Sheet '{sheet_name}' looks like the {ct.table_name} catalog but "
                    f"is missing column(s): {', '.join(missing)}. It was added as "
                    f"general knowledge instead — rename those columns and re-upload to "
                    f"make it searchable by the bot's tools."
                )
            # else: no catalog signal at all → genuine knowledge content.
            plan.rag_sheets.append((sheet_name, df))
            continue

        # Primary = most specific full match (most required columns).
        primary = max(full_matches, key=lambda cr: len(cr[0].required_columns))
        targets = [primary]
        for cr in full_matches:
            if cr is primary:
                continue
            ct, resolved = cr
            targets_present = set(resolved.values())
            if ct.secondary_requires and all(
                col in targets_present for col in ct.secondary_requires
            ):
                targets.append(cr)

        for ct, resolved in targets:
            db_types = db_schema.get(ct.table_name, {})
            db_cols, rows, skipped = _clean_rows_for_table(
                df, resolved, ct, db_types, sheet_name,
            )
            if ct.grain:
                # Coarse table: collapse to one row per grain-tuple, aggregating
                # the pack-size-style columns across the group.
                db_cols, rows = _dedupe_by_grain(
                    db_cols, rows, ct.grain, ct.aggregate_columns,
                )
            if not rows:
                # Safety gate: never wipe a catalog with an empty/invalid sheet.
                raise CatalogImportError(
                    f"Sheet '{sheet_name}' matched the {ct.table_name} catalog but "
                    f"had no valid rows after cleaning "
                    f"({len(skipped)} row(s) skipped). Nothing was changed — fix the "
                    f"sheet and re-upload."
                )
            tp = plan.tables.get(ct.table_name)
            if tp is None:
                tp = TablePlan(table_name=ct.table_name, db_columns=db_cols)
                plan.tables[ct.table_name] = tp
                tp.rows.extend(rows)
            else:
                # Two sheets → same table: align this sheet's columns to the
                # first plan's column order before merging (missing → None).
                tp.rows.extend(
                    rows if tp.db_columns == db_cols
                    else _realign(db_cols, rows, tp.db_columns)
                )
            tp.skipped.extend(skipped)
            tp.source_sheets.append(sheet_name)
            if skipped:
                plan.warnings.append(
                    f"{ct.table_name}: skipped {len(skipped)} row(s) from "
                    f"'{sheet_name}' — {skipped[0]}"
                    + (f" (+{len(skipped) - 1} more)" if len(skipped) > 1 else "")
                )

    return plan


def _dedupe_by_grain(db_cols, rows, grain, aggregate_columns):
    """Collapse rows to one per distinct grain-tuple.

    ``grain`` and ``aggregate_columns`` are canonical DB columns; any not present
    in ``db_cols`` are ignored (a sheet may not carry every column). The first row
    of each group seeds it; aggregate columns become the ", "-joined distinct
    truthy values seen in the group (first-seen order); other columns keep the
    seed's value. Returns (db_cols, deduped_rows) — db_cols is unchanged.
    """
    grain_idx = [db_cols.index(c) for c in grain if c in db_cols]
    if not grain_idx:
        return db_cols, rows
    agg_idx = [db_cols.index(c) for c in aggregate_columns if c in db_cols]

    groups: Dict[Tuple, List[Any]] = {}
    agg_seen: Dict[Tuple, List[set]] = {}
    for row in rows:
        key = tuple(
            (str(row[i]).strip().lower() if row[i] is not None else "")
            for i in grain_idx
        )
        if key not in groups:
            groups[key] = list(row)
            agg_seen[key] = [[] for _ in agg_idx]
        seed = groups[key]
        for slot, i in enumerate(agg_idx):
            val = row[i]
            if val is not None and str(val).strip() and str(val) not in agg_seen[key][slot]:
                agg_seen[key][slot].append(str(val))

    out = []
    for key, seed in groups.items():
        for slot, i in enumerate(agg_idx):
            joined = ", ".join(agg_seen[key][slot])
            seed[i] = joined or None
        out.append(seed)
    return db_cols, out


def _realign(src_cols, rows, dst_cols):
    """Re-order/extend rows from src_cols to dst_cols order (missing → None)."""
    idx = {c: i for i, c in enumerate(src_cols)}
    out = []
    for r in rows:
        out.append([r[idx[c]] if c in idx else None for c in dst_cols])
    return out


# ── Apply (the only DB write) ────────────────────────────────────────────────

def apply_catalog_import(cursor, company_id, plan: CatalogPlan) -> List[str]:
    """Replace-all each planned table for this company. Caller owns the txn.

    Does NOT commit — the caller wraps all tables (and any RAG write) in one
    transaction so a later failure rolls everything back. Returns per-table
    summary strings for the API response.
    """
    summary: List[str] = []
    for table_name, tp in plan.tables.items():
        if not tp.rows:
            continue
        # Identifiers are pack-config + information_schema validated, never raw text.
        cursor.execute(f"DELETE FROM {table_name} WHERE company_id = %s", (company_id,))
        col_list = ", ".join(["company_id"] + tp.db_columns)
        placeholders = ", ".join(["%s"] * (len(tp.db_columns) + 1))
        insert_sql = f"INSERT INTO {table_name} ({col_list}) VALUES ({placeholders})"
        for values in tp.rows:
            cursor.execute(insert_sql, [company_id] + list(values))
        src = ", ".join(dict.fromkeys(tp.source_sheets))
        summary.append(f"{table_name}: {len(tp.rows)} rows imported from {src}")
    return summary
