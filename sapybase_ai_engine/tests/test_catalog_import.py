"""Edge-case coverage for the robust catalog auto-import pipeline.

Mirrors docs/catalog-auto-import-plan.md: dirty headers, synonyms, currency
cleaning, POR/null handling, NOT-NULL skips, near-miss warnings, the
zero-valid-rows safety gate, two-sheets-one-table merge, and the apply write.
"""
from __future__ import annotations

import pandas as pd
import pytest

from packs.chemical import CHEMICAL_PACK
from services import catalog_import as ci

# DB schema the planner needs (table -> {col: type}), matching prod.
PRODUCTS_SCHEMA = {
    "name": "text", "cas_number": "text", "grade": "text",
    "packaging": "text", "sds_ref": "text",
}
SKUS_SCHEMA = {
    "product_name": "text", "cas_number": "text", "grade": "text",
    "pack_code": "text", "pack_size": "text", "pack_size_norm": "text",
    "list_price": "numeric", "gst_rate": "numeric", "hsn_code": "text",
    "is_por": "boolean", "currency": "text",
}
DB_SCHEMA = {"products": PRODUCTS_SCHEMA, "product_skus": SKUS_SCHEMA}
CATALOG_TABLES = CHEMICAL_PACK.catalog_tables


def _raw(rows):
    """Build a header=None DataFrame from a list of row-lists."""
    return pd.DataFrame(rows)


# ── Header normalization ─────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("CAS Number", "cas_number"),
    ("  CAS  No. ", "cas_no"),
    ("CAS #", "cas"),
    ("GST %", "gst"),
    ("Product_Name", "product_name"),
    ("List Price", "list_price"),
])
def test_normalize_header(raw, expected):
    assert ci.normalize_header(raw) == expected


# ── Header-row detection (skip title/logo rows) ──────────────────────────────

def test_detect_header_row_skips_title():
    raw = _raw([
        ["ACME CHEMICALS PRICE LIST", "", ""],   # title row
        ["", "", ""],                             # blank
        ["name", "cas_number", "grade"],          # real header
        ["Acetone", "67-64-1", "AR"],
    ])
    assert ci.detect_header_row(raw) == 2


def test_reheader_promotes_real_header():
    raw = _raw([
        ["Catalog", "", ""],
        ["name", "cas_number", "grade"],
        ["Acetone", "67-64-1", "AR"],
    ])
    df = ci.reheader(raw)
    assert list(df.columns) == ["name", "cas_number", "grade"]
    assert df.iloc[0]["name"] == "Acetone"


# ── Synonym resolution ───────────────────────────────────────────────────────

def test_synonyms_resolve_dirty_product_headers():
    products = CATALOG_TABLES[0]
    resolved = ci.resolve_columns(
        ["Chemical Name", "CAS #", "Purity", "Pack", "MSDS URL"],
        products, tuple(PRODUCTS_SCHEMA),
    )
    assert resolved == {
        "Chemical Name": "name", "CAS #": "cas_number", "Purity": "grade",
        "Pack": "packaging", "MSDS URL": "sds_ref",
    }


def test_synonyms_resolve_price_aliases():
    skus = CATALOG_TABLES[1]
    resolved = ci.resolve_columns(
        ["Product", "CAS", "Grade", "Size", "Rate", "GST", "POR"],
        skus, tuple(SKUS_SCHEMA),
    )
    assert resolved["Rate"] == "list_price"
    assert resolved["POR"] == "is_por"
    assert resolved["Size"] == "pack_size"


# ── Numeric cleaning ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("420.00", 420.0),
    ("₹1,450", 1450.0),
    ("Rs. 420", 420.0),
    ("420/-", 420.0),
    ("1,450.50", 1450.5),
    ("18%", 18.0),
    ("POR", None),
    ("-", None),
    ("N/A", None),
    ("", None),
    ("on request", None),
    ("garbage", None),
])
def test_clean_numeric(raw, expected):
    assert ci.clean_numeric(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("TRUE", True), ("true", True), ("yes", True), ("Y", True), ("1", True),
    ("FALSE", False), ("no", False), ("", False), ("0", False),
])
def test_clean_bool(raw, expected):
    assert ci.clean_bool(raw) is expected


# ── Full-match import ────────────────────────────────────────────────────────

def test_products_full_match_planned():
    raw = _raw([
        ["name", "cas_number", "grade", "sds_ref"],
        ["Acetone", "67-64-1", "AR", "https://x.com/a.pdf"],
        ["Toluene", "108-88-3", "AR", "https://x.com/t.pdf"],
    ])
    plan = ci.plan_catalog_import([("products", raw)], CATALOG_TABLES, DB_SCHEMA)
    assert "products" in plan.tables
    assert len(plan.tables["products"].rows) == 2
    assert plan.rag_sheets == []


def test_skus_currency_and_por_cleaned():
    raw = _raw([
        ["product_name", "cas_number", "grade", "pack_size", "list_price", "is_por"],
        ["Acetone", "67-64-1", "AR", "500 ml", "₹413.00", "FALSE"],
        ["Sulphuric Acid", "7664-93-9", "Battery", "35 Kg", "POR", "TRUE"],
    ])
    plan = ci.plan_catalog_import([("skus", raw)], CATALOG_TABLES, DB_SCHEMA)
    tp = plan.tables["product_skus"]
    price_idx = tp.db_columns.index("list_price")
    por_idx = tp.db_columns.index("is_por")
    assert tp.rows[0][price_idx] == 413.0
    assert tp.rows[1][price_idx] is None      # POR → NULL
    assert tp.rows[1][por_idx] is True


# ── NOT-NULL skip ────────────────────────────────────────────────────────────

def test_row_missing_name_is_skipped_not_crashed():
    raw = _raw([
        ["name", "cas_number"],
        ["Acetone", "67-64-1"],
        ["", "108-88-3"],                 # missing required name
    ])
    plan = ci.plan_catalog_import([("p", raw)], CATALOG_TABLES, DB_SCHEMA)
    tp = plan.tables["products"]
    assert len(tp.rows) == 1
    assert len(tp.skipped) == 1
    assert any("missing required 'name'" in s for s in tp.skipped)


def test_blank_rows_dropped_silently():
    raw = _raw([
        ["name", "cas_number"],
        ["Acetone", "67-64-1"],
        ["", ""],                         # fully blank → dropped, not skipped-with-reason
    ])
    plan = ci.plan_catalog_import([("p", raw)], CATALOG_TABLES, DB_SCHEMA)
    tp = plan.tables["products"]
    assert len(tp.rows) == 1
    assert tp.skipped == []


# ── Safety gate ──────────────────────────────────────────────────────────────

def test_header_only_sheet_aborts_no_wipe():
    raw = _raw([["name", "cas_number"]])   # header, zero data rows
    with pytest.raises(ci.CatalogImportError):
        ci.plan_catalog_import([("p", raw)], CATALOG_TABLES, DB_SCHEMA)


def test_all_invalid_rows_aborts():
    raw = _raw([
        ["name", "cas_number"],
        ["", "67-64-1"],                  # only row violates NOT-NULL
    ])
    with pytest.raises(ci.CatalogImportError):
        ci.plan_catalog_import([("p", raw)], CATALOG_TABLES, DB_SCHEMA)


# ── Near-miss → warn + RAG ───────────────────────────────────────────────────

def test_near_miss_warns_and_routes_to_rag():
    # Has product name + grade (catalog signal) but no CAS → not a full match.
    raw = _raw([
        ["name", "grade", "notes"],
        ["Acetone", "AR", "fast moving"],
    ])
    plan = ci.plan_catalog_import([("looks-like-products", raw)], CATALOG_TABLES, DB_SCHEMA)
    assert plan.tables == {}
    assert len(plan.rag_sheets) == 1
    assert any("missing column" in w for w in plan.warnings)


def test_genuine_text_sheet_goes_to_rag_no_warning():
    raw = _raw([
        ["question", "answer"],
        ["What are your hours?", "9-5 Mon-Fri"],
    ])
    plan = ci.plan_catalog_import([("FAQ", raw)], CATALOG_TABLES, DB_SCHEMA)
    assert plan.tables == {}
    assert len(plan.rag_sheets) == 1
    assert plan.warnings == []


# ── Two sheets → same table merge ────────────────────────────────────────────

def test_two_product_sheets_merge_not_clobber():
    s1 = _raw([
        ["name", "cas_number"],
        ["Acetone", "67-64-1"],
    ])
    s2 = _raw([
        ["name", "cas_number"],
        ["Toluene", "108-88-3"],
    ])
    plan = ci.plan_catalog_import(
        [("products_a", s1), ("products_b", s2)], CATALOG_TABLES, DB_SCHEMA,
    )
    assert len(plan.tables["products"].rows) == 2
    assert set(plan.tables["products"].source_sheets) == {"products_a", "products_b"}


def test_merge_realigns_mismatched_column_order():
    s1 = _raw([
        ["name", "cas_number", "grade"],
        ["Acetone", "67-64-1", "AR"],
    ])
    s2 = _raw([
        ["grade", "name", "cas_number"],          # different order
        ["LR", "Toluene", "108-88-3"],
    ])
    plan = ci.plan_catalog_import(
        [("a", s1), ("b", s2)], CATALOG_TABLES, DB_SCHEMA,
    )
    tp = plan.tables["products"]
    name_idx = tp.db_columns.index("name")
    assert {row[name_idx] for row in tp.rows} == {"Acetone", "Toluene"}


# ── apply_catalog_import (fake cursor) ───────────────────────────────────────

class _FakeCursor:
    def __init__(self):
        self.executed = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))


def test_apply_does_delete_then_insert_scoped_by_company():
    raw = _raw([
        ["name", "cas_number"],
        ["Acetone", "67-64-1"],
    ])
    plan = ci.plan_catalog_import([("p", raw)], CATALOG_TABLES, DB_SCHEMA)
    cur = _FakeCursor()
    summary = ci.apply_catalog_import(cur, "company-123", plan)

    deletes = [e for e in cur.executed if e[0].startswith("DELETE")]
    inserts = [e for e in cur.executed if e[0].startswith("INSERT")]
    assert len(deletes) == 1
    assert deletes[0][1] == ("company-123",)
    assert len(inserts) == 1
    assert inserts[0][1][0] == "company-123"   # company_id is first value
    assert any("products: 1 rows" in s for s in summary)
