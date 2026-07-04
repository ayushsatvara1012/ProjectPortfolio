"""Tests for the vertical-agent runtime (chemical-vertical-agent plan, Phase 1, §9).

Three layers, all deterministic (no DB, no live LLM):
  1. get_sds            — every resolution branch + tenant scoping + url safety.
  2. build_tool_schemas / build_agent_directive — pack -> function schema + the
     enforceable safety directive.
  3. run_agent_loop     — the bounded ReAct loop: direct answer, one tool round,
     runaway loop, and LLM/tool failure all degrade safely.

The live-LLM guardrail eval (does the *model* refuse to fabricate safety info?)
lives in test_guardrail_eval.py and is skipped unless RUN_LLM_EVALS=1.
"""
import asyncio
import datetime
import json

import pytest

from services import agent
from services.agent import (
    AGENT_FALLBACK_TEXT,
    build_agent_directive,
    build_tool_schemas,
    execute_tool,
    get_product_spec,
    get_sds,
    run_agent_loop,
)
from packs import load_pack


# ── Fakes ────────────────────────────────────────────────────────────────────

class FakeCursor:
    """Returns programmed rows by inspecting the SQL shape get_sds emits, and
    records every (sql, params) so tests can assert tenant scoping."""

    def __init__(self, *, cas=None, name_exact=None, partial=None):
        self._cas = cas or []
        self._name_exact = name_exact or []
        self._partial = partial or []
        self._last_sql = ""
        self.calls = []  # list of (sql, params)

    def execute(self, sql, params=None):
        self._last_sql = sql
        self.calls.append((sql, params))

    def fetchall(self):
        s = self._last_sql
        if "cas_number = %s" in s:
            return list(self._cas)
        if "lower(name) = lower" in s:
            return list(self._name_exact)
        if "ILIKE" in s:
            return list(self._partial)
        return []


def _row(name="Sulphuric Acid", cas="7664-93-9", grade="Battery",
         packaging="35kg can", sds_ref="https://sds.example.com/h2so4.pdf",
         updated=None):
    updated = updated or datetime.datetime(2026, 1, 2, tzinfo=datetime.timezone.utc)
    return (name, cas, grade, packaging, sds_ref, updated)


class FakeResp:
    def __init__(self, content="", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []


class FakeModel:
    """Yields canned responses in order; records the convo it was asked to invoke."""

    def __init__(self, responses, raise_on=None):
        self._responses = list(responses)
        self._raise_on = raise_on  # round index (0-based) to raise on
        self.invocations = []

    async def ainvoke(self, convo):
        idx = len(self.invocations)
        self.invocations.append(list(convo))
        if self._raise_on is not None and idx == self._raise_on:
            raise RuntimeError("simulated LLM failure")
        return self._responses[idx]


def _run(coro):
    return asyncio.run(coro)


CID = "11111111-1111-1111-1111-111111111111"


# ── get_sds ──────────────────────────────────────────────────────────────────

class TestGetSdsResolution:
    def test_missing_identifier(self):
        out = get_sds(FakeCursor(), CID)
        assert out["status"] == "missing_identifier"

    def test_found_by_cas(self):
        out = get_sds(FakeCursor(cas=[_row()]), CID, cas_number="7664-93-9")
        assert out["status"] == "found"
        assert out["sds_url"] == "https://sds.example.com/h2so4.pdf"
        assert out["product"]["grade"] == "Battery"
        assert out["last_updated"].startswith("2026-01-02")

    def test_found_by_exact_name_case_insensitive(self):
        out = get_sds(FakeCursor(name_exact=[_row()]), CID, product_name="sulphuric acid")
        assert out["status"] == "found"

    def test_cas_strips_whitespace(self):
        cur = FakeCursor(cas=[_row()])
        get_sds(cur, CID, cas_number="  7664-93-9 ")
        # the CAS query param is the trimmed value
        cas_call = [c for c in cur.calls if "cas_number = %s" in c[0]][0]
        assert cas_call[1] == (CID, "7664-93-9")

    def test_not_found(self):
        out = get_sds(FakeCursor(), CID, product_name="unobtainium")
        assert out["status"] == "not_found"

    def test_product_exists_but_no_sds_ref_is_no_sheet(self):
        out = get_sds(FakeCursor(cas=[_row(sds_ref=None)]), CID, cas_number="7664-93-9")
        assert out["status"] == "no_sheet_on_file"
        assert "sds_url" not in out

    def test_non_https_sds_ref_is_rejected(self):
        # An http:// or relative link is never served — treated as no sheet.
        out = get_sds(FakeCursor(cas=[_row(sds_ref="http://insecure/h2so4.pdf")]),
                      CID, cas_number="7664-93-9")
        assert out["status"] == "no_sheet_on_file"

    def test_multiple_exact_matches_are_ambiguous(self):
        rows = [_row(grade="Battery"), _row(grade="Technical")]
        out = get_sds(FakeCursor(cas=rows), CID, cas_number="7664-93-9")
        assert out["status"] == "ambiguous"
        assert {c["grade"] for c in out["candidates"]} == {"Battery", "Technical"}

    def test_partial_name_single_match_still_confirms(self):
        # A fuzzy match never auto-serves — even one hit must be confirmed.
        out = get_sds(FakeCursor(partial=[_row()]), CID, product_name="acid")
        assert out["status"] == "ambiguous"
        assert len(out["candidates"]) == 1

    def test_partial_name_multiple_matches(self):
        rows = [_row(name="Hydrochloric Acid"), _row(name="Nitric Acid")]
        out = get_sds(FakeCursor(partial=rows), CID, product_name="acid")
        assert out["status"] == "ambiguous"
        assert len(out["candidates"]) == 2

    def test_cas_falls_back_to_name_when_cas_misses(self):
        # CAS given but no CAS row; an exact-name row should still resolve.
        cur = FakeCursor(cas=[], name_exact=[_row()])
        out = get_sds(cur, CID, cas_number="0000-00-0", product_name="Sulphuric Acid")
        assert out["status"] == "found"


class TestGetSdsGradeDisambiguation:
    """Regression: a name/CAS with several grades must resolve once a grade is
    given — previously get_sds had no grade slot and looped on 'ambiguous'."""

    def test_grade_narrows_multiple_matches_to_one(self):
        rows = [_row(grade="LR"), _row(grade="AR"), _row(grade="HPLC")]
        out = get_sds(FakeCursor(name_exact=rows), CID,
                      product_name="Acetone", grade="AR")
        assert out["status"] == "found"
        assert out["product"]["grade"] == "AR"

    def test_grade_is_case_insensitive(self):
        rows = [_row(grade="LR"), _row(grade="AR")]
        out = get_sds(FakeCursor(cas=rows), CID, cas_number="7664-93-9", grade="ar")
        assert out["status"] == "found"
        assert out["product"]["grade"] == "AR"

    def test_unstocked_grade_lists_available_grades(self):
        rows = [_row(grade="LR"), _row(grade="AR")]
        out = get_sds(FakeCursor(cas=rows), CID, cas_number="7664-93-9", grade="HPLC")
        assert out["status"] == "ambiguous"
        assert "HPLC" in out["message"]
        assert "LR" in out["message"] and "AR" in out["message"]

    def test_no_grade_still_ambiguous(self):
        rows = [_row(grade="LR"), _row(grade="AR")]
        out = get_sds(FakeCursor(cas=rows), CID, cas_number="7664-93-9")
        assert out["status"] == "ambiguous"

    def test_grade_narrows_partial_name_match(self):
        rows = [_row(name="Acetone", grade="LR"), _row(name="Acetone", grade="AR")]
        out = get_sds(FakeCursor(partial=rows), CID, product_name="aceto", grade="AR")
        assert out["status"] == "found"
        assert out["product"]["grade"] == "AR"

    def test_grade_threaded_through_product_spec(self):
        rows = [_row(grade="LR"), _row(grade="AR")]
        out = get_product_spec(FakeCursor(cas=rows), CID,
                               cas_number="7664-93-9", grade="LR")
        assert out["status"] == "found"
        assert out["product"]["grade"] == "LR"


class TestGetSdsTenantScoping:
    def test_every_query_is_company_scoped(self):
        cur = FakeCursor(cas=[], name_exact=[], partial=[])
        get_sds(cur, CID, cas_number="7664-93-9", product_name="acid")
        assert cur.calls, "expected at least one query"
        for sql, params in cur.calls:
            assert "company_id = %s" in sql
            assert params[0] == CID  # company_id is always the first bound param


# ── get_product_spec ─────────────────────────────────────────────────────────

class TestGetProductSpec:
    def test_missing_identifier(self):
        out = get_product_spec(FakeCursor(), CID)
        assert out["status"] == "missing_identifier"

    def test_found_by_cas_returns_commercial_fields_only(self):
        out = get_product_spec(FakeCursor(cas=[_row()]), CID, cas_number="7664-93-9")
        assert out["status"] == "found"
        assert out["product"] == {
            "name": "Sulphuric Acid",
            "cas_number": "7664-93-9",
            "grade": "Battery",
            "packaging": "35kg can",
        }
        # The SDS URL is NEVER exposed by this tool — only a boolean nudge.
        assert "sds_url" not in out
        assert "sds_ref" not in out

    def test_found_by_exact_name_case_insensitive(self):
        out = get_product_spec(FakeCursor(name_exact=[_row()]), CID,
                               product_name="sulphuric acid")
        assert out["status"] == "found"

    def test_sds_available_true_when_https_on_file(self):
        out = get_product_spec(FakeCursor(cas=[_row()]), CID, cas_number="7664-93-9")
        assert out["sds_available"] is True

    def test_sds_available_false_when_no_or_insecure_ref(self):
        out = get_product_spec(FakeCursor(cas=[_row(sds_ref=None)]), CID,
                               cas_number="7664-93-9")
        assert out["status"] == "found"  # spec still resolves without a sheet
        assert out["sds_available"] is False
        out2 = get_product_spec(FakeCursor(cas=[_row(sds_ref="http://insecure/x")]),
                                CID, cas_number="7664-93-9")
        assert out2["sds_available"] is False

    def test_null_spec_fields_returned_as_none_not_invented(self):
        row = _row(grade=None, packaging=None)
        out = get_product_spec(FakeCursor(cas=[row]), CID, cas_number="7664-93-9")
        assert out["status"] == "found"
        assert out["product"]["grade"] is None
        assert out["product"]["packaging"] is None

    def test_not_found(self):
        out = get_product_spec(FakeCursor(), CID, product_name="unobtainium")
        assert out["status"] == "not_found"

    def test_multiple_exact_matches_are_ambiguous(self):
        rows = [_row(grade="Battery"), _row(grade="Technical")]
        out = get_product_spec(FakeCursor(cas=rows), CID, cas_number="7664-93-9")
        assert out["status"] == "ambiguous"
        assert {c["grade"] for c in out["candidates"]} == {"Battery", "Technical"}

    def test_same_product_many_grades_flattens_to_grade_chips(self):
        # One product in several grades → enrich with a grade list for chips.
        rows = [_row(grade="Battery"), _row(grade="Technical")]
        out = get_product_spec(FakeCursor(cas=rows), CID, cas_number="7664-93-9")
        assert out["grades"] == ["Battery", "Technical"]
        assert out["product"] == "Sulphuric Acid"
        assert "products" not in out

    def test_mixed_products_surface_products_not_grades(self):
        # Phase 1.6: a CAS/name that maps to DIFFERENT products must not flatten
        # their grades under the first product's name — surface the products.
        rows = [_row(name="Sulphuric Acid", grade="Battery"),
                _row(name="Rust Remover", grade="Industrial")]
        out = get_product_spec(FakeCursor(cas=rows), CID, cas_number="7664-93-9")
        assert out["status"] == "ambiguous"
        assert "grades" not in out          # never a mislabeled grade chip list
        assert "product" not in out          # never a single wrong product label
        assert out["products"] == ["Sulphuric Acid", "Rust Remover"]

    def test_partial_name_single_match_still_confirms(self):
        # Same discipline as get_sds: a fuzzy match never auto-serves a spec.
        out = get_product_spec(FakeCursor(partial=[_row()]), CID, product_name="acid")
        assert out["status"] == "ambiguous"
        assert len(out["candidates"]) == 1

    def test_every_query_is_company_scoped(self):
        cur = FakeCursor(cas=[], name_exact=[], partial=[])
        get_product_spec(cur, CID, cas_number="7664-93-9", product_name="acid")
        assert cur.calls
        for sql, params in cur.calls:
            assert "company_id = %s" in sql
            assert params[0] == CID


# ── execute_tool ─────────────────────────────────────────────────────────────

class TestExecuteTool:
    def test_dispatches_get_sds(self):
        out = execute_tool("get_sds", {"cas_number": "7664-93-9"},
                           FakeCursor(cas=[_row()]), CID)
        assert out["status"] == "found"

    def test_dispatches_get_product_spec(self):
        out = execute_tool("get_product_spec", {"cas_number": "7664-93-9"},
                           FakeCursor(cas=[_row()]), CID)
        assert out["status"] == "found"
        assert "sds_url" not in out

    def test_unknown_tool_is_benign_error(self):
        out = execute_tool("delete_everything", {}, FakeCursor(), CID)
        assert out["status"] == "error"
        assert "not available" in out["message"]

    def test_dispatches_request_quote(self):
        cur = FakeSkuCursor(name_exact=[_sku()])
        out = execute_tool(
            "request_quote",
            {"product_name": "acetone", "grade": "AR", "pack_size": "2.5 Ltr", "quantity": "2"},
            cur, CID,
        )
        assert out["status"] == "quoted"

    def test_dispatches_request_sample(self):
        cur = FakeProductCursor(cas=[_row()])
        out = execute_tool(
            "request_sample",
            {"product_name": "Acetone", "grade": "AR"},
            cur, CID,
        )
        assert out["status"] == "open_form"   # form launcher, no DB write
        assert cur.inserts == []

    def test_request_quote_persists_session_id(self):
        # Phase 1.2: the quote record must be tied to the conversation, not NULL,
        # so funnel/BI joins on quote_requests.session_id work.
        cur = FakeSkuCursor(name_exact=[_sku()])
        out = execute_tool(
            "request_quote",
            {"product_name": "acetone", "grade": "AR", "pack_size": "2.5 Ltr", "quantity": "2"},
            cur, CID, session_id="sess-abc-123",
        )
        assert out["status"] == "quoted"
        assert len(cur.inserts) == 1
        # INSERT params: (company_id, session_id, product_name, ...)
        assert cur.inserts[0][1] == "sess-abc-123"


# ── request_quote (Phase 4a) ─────────────────────────────────────────────────

from services.agent import request_quote, _norm_pack  # noqa: E402


class TestNormPack:
    """Pack-size canonicalisation: same size collapses, different sizes never."""

    def test_spellings_collapse_to_one_key(self):
        keys = {_norm_pack(x) for x in ("5 Ltr", "5L", "5 litre", "5000 ml")}
        assert keys == {"5000ml"}

    def test_fractional_litre(self):
        assert _norm_pack("2.5 Ltr") == "2500ml" == _norm_pack("2.5 litre")

    def test_mass_to_grams(self):
        assert _norm_pack("35 Kg") == "35000g" == _norm_pack("35000 g")

    def test_different_sizes_never_collide(self):
        assert _norm_pack("5 Ltr") != _norm_pack("2.5 Ltr")   # the reported bug
        assert _norm_pack("5 Ltr") != _norm_pack("25 Ltr")
        assert _norm_pack("500 ml") != _norm_pack("5 Ltr")

    def test_last_size_wins_for_multipack_text(self):
        assert _norm_pack("8 x 500 ml") == "500ml"

    def test_unparseable_falls_back_to_text(self):
        assert _norm_pack("sample") == "sample"


class FakeSkuCursor:
    """Returns programmed product_skus rows by SQL shape, and records INSERTs +
    commit so quote tests can assert persistence and tenant scoping. Acts as its
    own ``connection`` so ``cursor.connection.commit()`` works."""

    def __init__(self, *, cas=None, name_exact=None, partial=None):
        self._cas = cas or []
        self._name = name_exact or []
        self._partial = partial or []
        self._last = ""
        self.calls = []        # (sql, params)
        self.inserts = []      # params of INSERTs
        self.committed = False
        self.connection = self

    def execute(self, sql, params=None):
        self._last = sql
        self.calls.append((sql, params))
        if sql.strip().upper().startswith("INSERT"):
            self.inserts.append(params)

    def fetchall(self):
        s = self._last
        if "product_skus" not in s:
            return []
        if "cas_number = %s" in s:
            return list(self._cas)
        if "lower(product_name) = lower" in s:
            return list(self._name)
        if "ILIKE" in s:
            return list(self._partial)
        return []

    def commit(self):
        self.committed = True


def _sku(name="Acetone", cas="67-64-1", grade="AR", pack="2.5 Ltr", norm=None,
         code="100AR2500M", price=1894, gst=18, por=False, currency="INR"):
    """A product_skus row tuple in _SKU_COLS order."""
    return (name, cas, grade, pack, norm, code, price, gst, por, currency)


class TestRequestQuote:
    def test_missing_identifier(self):
        out = request_quote(FakeSkuCursor(), CID)
        assert out["status"] == "missing_identifier"

    def test_not_found(self):
        out = request_quote(FakeSkuCursor(), CID, product_name="unobtainium")
        assert out["status"] == "not_found"

    def test_needs_grade_lists_available_grades(self):
        cur = FakeSkuCursor(name_exact=[_sku(grade="LR", price=1660),
                                        _sku(grade="AR", price=1894)])
        out = request_quote(cur, CID, product_name="acetone")
        assert out["status"] == "needs_grade"
        assert set(out["grades"]) == {"LR", "AR"}

    def test_needs_pack_lists_available_packs(self):
        cur = FakeSkuCursor(name_exact=[_sku(grade="AR", pack="500 ml", price=507),
                                        _sku(grade="AR", pack="2.5 Ltr", price=1894)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR")
        assert out["status"] == "needs_pack"
        assert set(out["pack_sizes"]) == {"500 ml", "2.5 Ltr"}

    def test_quoted_computes_subtotal_and_persists(self):
        cur = FakeSkuCursor(name_exact=[_sku(price=1894)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 Ltr", quantity="3")
        assert out["status"] == "quoted"
        assert out["unit_price"] == 1894.0
        assert out["subtotal"] == 5682.0       # 1894 * 3, code never trusts the model
        assert out["gst_note"] == "GST extra as applicable"
        assert len(cur.inserts) == 1 and cur.committed   # owner lead recorded + committed

    def test_quote_pack_match_is_tolerant(self):
        cur = FakeSkuCursor(name_exact=[_sku(pack="2.5 Ltr", price=1894)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 litre")   # spelling variant
        assert out["status"] == "quoted"

    def test_pack_match_no_cross_size_collision(self):
        # Regression: '5 Litre' must resolve to ONLY the 5 Ltr SKU. The old
        # substring key ('5 l' is a substring of '2.5 l') pulled in the 2.5 Ltr
        # row too, and the two prices surfaced as a false 'ambiguous_price'.
        cur = FakeSkuCursor(name_exact=[
            _sku(grade="LR", pack="500 ml", code="c1", price=230),
            _sku(grade="LR", pack="2.5 Ltr", code="c2", price=510),
            _sku(grade="LR", pack="5 Ltr", code="c3", price=950),
        ])
        out = request_quote(cur, CID, product_name="acetone", grade="LR",
                            pack_size="5 Litre")
        assert out["status"] == "quoted"
        assert out["unit_price"] == 950.0

    def test_pack_match_ignores_inconsistent_stored_norm(self):
        # The stored pack_size_norm can be a foreign format ('5000 ml') the query
        # key never equals — matching must rely on the pack_size text, not r[4].
        cur = FakeSkuCursor(name_exact=[
            _sku(grade="LR", pack="2.5 Ltr", norm="2500 ml", code="c2", price=510),
            _sku(grade="LR", pack="5 Ltr", norm="5000 ml", code="c3", price=950),
        ])
        out = request_quote(cur, CID, product_name="acetone", grade="LR",
                            pack_size="5 Ltr")
        assert out["status"] == "quoted"
        assert out["unit_price"] == 950.0

    def test_quantity_defaults_to_one_when_missing(self):
        # A truly-absent quantity is a single-pack default — quote proceeds.
        for qty in (None, "", "   "):
            cur = FakeSkuCursor(name_exact=[_sku(price=1894)])
            out = request_quote(cur, CID, product_name="acetone", grade="AR",
                                pack_size="2.5 Ltr", quantity=qty)
            assert out["status"] == "quoted"
            assert out["quantity"] == 1 and out["subtotal"] == 1894.0

    def test_unparseable_or_nonpositive_quantity_asks_to_confirm(self):
        # Phase 1.4: a quantity the buyer WROTE but we can't read ("10-20") — or a
        # nonsensical 0/-5 — must never be silently coerced to 1 and quoted.
        for qty in ("10-20", "a few", "abc", "0", "-5"):
            cur = FakeSkuCursor(name_exact=[_sku(price=1894)])
            out = request_quote(cur, CID, product_name="acetone", grade="AR",
                                pack_size="2.5 Ltr", quantity=qty)
            assert out["status"] == "confirm_quantity"
            assert cur.inserts == []   # nothing recorded until the count is confirmed

    def test_quantity_is_capped(self):
        # Absurd counts clamp to the cap rather than compute a runaway subtotal.
        cur = FakeSkuCursor(name_exact=[_sku(price=10)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 Ltr", quantity="99999999")
        assert out["status"] == "quoted"
        assert out["quantity"] == 10000 and out["subtotal"] == 100000.0

    def test_por_needs_contact_then_records(self):
        # Price-on-request pack with no contact -> ask for it, do NOT record.
        cur = FakeSkuCursor(name_exact=[_sku(pack="25 Ltr", price=None, por=True)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="25 Ltr")
        assert out["status"] == "needs_contact"
        assert cur.inserts == []
        # With a contact -> route-to-human record created.
        cur2 = FakeSkuCursor(name_exact=[_sku(pack="25 Ltr", price=None, por=True)])
        out2 = request_quote(cur2, CID, product_name="acetone", grade="AR",
                             pack_size="25 Ltr", contact_email="buyer@acme.com")
        assert out2["status"] == "price_on_request"
        assert len(cur2.inserts) == 1 and cur2.committed

    def test_zero_price_treated_as_por_not_free(self):
        cur = FakeSkuCursor(name_exact=[_sku(price=0)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 Ltr")
        assert out["status"] == "needs_contact"   # 0 price -> POR path, never "free"

    def test_ambiguous_price_escalates_never_guesses(self):
        # Same product/grade/pack, two different prices (real data-entry dup).
        cur = FakeSkuCursor(name_exact=[_sku(price=1894, code="A"),
                                        _sku(price=2000, code="B")])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 Ltr")
        assert out["status"] == "ambiguous_price"
        assert cur.inserts == []   # never persist/quote a guessed number

    def test_priced_and_por_dup_rows_escalate_not_arbitrary(self):
        # Same product/grade/pack, one priced row and one price-on-request row.
        # DB order must not decide the answer: a priced row winning would quote a
        # possibly-stale number; a POR row winning would hide a real price. Escalate.
        for rows in (
            [_sku(price=1894, code="A"), _sku(price=None, por=True, code="B")],
            [_sku(price=None, por=True, code="B"), _sku(price=1894, code="A")],
        ):
            cur = FakeSkuCursor(name_exact=rows)
            out = request_quote(cur, CID, product_name="acetone", grade="AR",
                                pack_size="2.5 Ltr", contact_email="buyer@acme.com")
            assert out["status"] == "ambiguous_price"
            assert cur.inserts == []   # never quote nor log a guessed reading

    def test_agreeing_priced_dup_rows_still_quote(self):
        # Two dup rows with the SAME price are not a conflict — quote normally.
        cur = FakeSkuCursor(name_exact=[_sku(price=1894, code="A"),
                                        _sku(price=1894, code="B")])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="2.5 Ltr")
        assert out["status"] == "quoted"
        assert out["unit_price"] == 1894.0

    def test_ambiguous_product_when_cas_maps_to_many(self):
        # CAS is NOT unique in this catalog (e.g. an acid AND a rust remover).
        cur = FakeSkuCursor(cas=[_sku(name="Hydrochloric acid", cas="7647-01-0"),
                                 _sku(name="RustEXclean", cas="7647-01-0")])
        out = request_quote(cur, CID, cas_number="7647-01-0")
        assert out["status"] == "ambiguous"
        assert len(out["candidates"]) == 2

    def test_not_found_sku_when_pack_absent_for_grade(self):
        cur = FakeSkuCursor(name_exact=[_sku(grade="AR", pack="2.5 Ltr", price=1894)])
        out = request_quote(cur, CID, product_name="acetone", grade="AR",
                            pack_size="999 Ltr")
        assert out["status"] == "not_found_sku"

    def test_every_query_is_tenant_scoped(self):
        cur = FakeSkuCursor(name_exact=[_sku(price=1894)])
        request_quote(cur, CID, product_name="acetone", grade="AR", pack_size="2.5 Ltr")
        selects = [c for c in cur.calls if "product_skus" in c[0] and c[0].strip().upper().startswith("SELECT")]
        assert selects  # at least one lookup ran
        for _sql, params in selects:
            assert params[0] == CID   # company_id is always the first bound param

    def test_insert_carries_company_id_and_snapshot(self):
        cur = FakeSkuCursor(name_exact=[_sku(price=1894, gst=18)])
        request_quote(cur, CID, product_name="acetone", grade="AR",
                      pack_size="2.5 Ltr", quantity="2")
        assert cur.inserts and cur.inserts[0][0] == CID   # tenant-scoped write
        # subtotal snapshot = 1894 * 2 (frozen on the record).
        assert 3788.0 in cur.inserts[0]


# ── request_sample (Phase 4b) ────────────────────────────────────────────────

from services.agent import request_sample  # noqa: E402


class FakeProductCursor:
    """products-shaped cursor (drives `_resolve_product`) that ALSO records INSERTs
    + commit, so request_sample's record-and-route path is fully testable."""

    def __init__(self, *, cas=None, name_exact=None, partial=None):
        self._cas = cas or []
        self._name = name_exact or []
        self._partial = partial or []
        self._last = ""
        self.calls = []        # (sql, params)
        self.inserts = []      # params of INSERTs
        self.committed = False
        self.connection = self

    def execute(self, sql, params=None):
        self._last = sql
        self.calls.append((sql, params))
        if sql.strip().upper().startswith("INSERT"):
            self.inserts.append(params)

    def fetchall(self):
        s = self._last
        if "FROM products" not in s:
            return []
        if "cas_number = %s" in s:
            return list(self._cas)
        if "lower(name) = lower" in s:
            return list(self._name)
        if "ILIKE" in s:
            return list(self._partial)
        return []

    def commit(self):
        self.committed = True


class TestRequestSample:
    # Phase 4b form: request_sample is a FORM LAUNCHER — it never resolves a product,
    # never touches the DB, and never records. Collection + recording happen on the
    # form submit (main.submit_sample_request). It only emits an open_form action
    # with any product/grade the model parsed as a prefill hint.

    def test_returns_open_form(self):
        out = request_sample(None, CID)
        assert out["status"] == "open_form"
        assert out["form_id"] == "sample"
        assert out["prefill"] == {}

    def test_prefills_from_parsed_fields(self):
        out = request_sample(None, CID, product_name="Acetone", grade="AR",
                             cas_number="67-64-1")
        assert out["prefill"] == {"product": "Acetone", "grade": "AR",
                                  "cas_number": "67-64-1"}

    def test_never_touches_db_and_ignores_extra_kwargs(self):
        cur = FakeProductCursor(cas=[_row()])
        out = request_sample(cur, CID, product_name="Acetone", quantity="3",
                             contact_email="a@b.com")  # extras the model might pass
        assert out["status"] == "open_form"
        assert cur.calls == [] and cur.inserts == []   # launcher does zero DB work


class TestInsertAgentRequest:
    # The endpoint's persistence helper: typed columns for the dashboard + a JSON
    # form_data blob for the full customizable submission, tenant-scoped + committed.

    def test_records_form_data_tenant_scoped_and_commits(self):
        cur = FakeProductCursor()
        ok = agent._insert_agent_request(
            cur, CID, kind="sample", product="Acetone", cas="67-64-1", grade="AR",
            pack_size=None, qty=2, note="urgent", name="Asha", email="a@b.com",
            phone=None, session_id="s1", form_data={"product": "Acetone", "company": "Acme"})
        assert ok is True   # Phase 1.5: signals successful capture to the caller
        assert len(cur.inserts) == 1 and cur.committed
        params = cur.inserts[0]
        assert params[0] == CID and "sample" in params   # tenant-scoped, kind recorded
        # form_data is serialized to a JSON string for the ::jsonb cast.
        assert any(isinstance(p, str) and "Acme" in p for p in params)

    def test_null_form_data_is_allowed(self):
        cur = FakeProductCursor()
        ok = agent._insert_agent_request(
            cur, CID, kind="sample", product="X", cas=None, grade=None,
            pack_size=None, qty=1, note=None, name=None, email="a@b.com",
            phone=None, session_id=None, form_data=None)
        assert ok is True
        assert len(cur.inserts) == 1 and cur.committed

    def test_returns_false_when_insert_fails(self):
        # Phase 1.5: a failed persist must be reported, not swallowed, so the
        # endpoint can decide whether to tell the visitor "we've got it".
        class BoomCursor(FakeProductCursor):
            def execute(self, sql, params=None):
                raise RuntimeError("db down")
        ok = agent._insert_agent_request(
            BoomCursor(), CID, kind="sample", product="X", cas=None, grade=None,
            pack_size=None, qty=1, note=None, name=None, email="a@b.com",
            phone=None, session_id=None, form_data=None)
        assert ok is False


# ── pack -> schema + directive ───────────────────────────────────────────────

class TestSchemasAndDirective:
    def test_chemical_schema_shape(self):
        schemas = build_tool_schemas(load_pack("chemical"))
        by_name = {s["name"]: s for s in schemas}
        assert set(by_name) == {"get_sds", "get_product_spec", "request_quote", "request_sample"}
        # The two read-only tools take CAS or name, plus an optional grade to
        # disambiguate the many-grades-per-product case (none individually required).
        for name in ("get_sds", "get_product_spec"):
            props = by_name[name]["parameters"]["properties"]
            assert set(props) == {"cas_number", "product_name", "grade"}
            assert by_name[name]["parameters"]["required"] == []
        # request_quote adds the pricing slots; still nothing hard-required (the tool
        # guides collection step by step).
        qp = by_name["request_quote"]["parameters"]["properties"]
        assert {"product_name", "cas_number", "grade", "pack_size", "quantity"} <= set(qp)
        assert by_name["request_quote"]["parameters"]["required"] == []
        # request_sample is a form launcher: only product/CAS/grade prefill hints.
        sp = by_name["request_sample"]["parameters"]["properties"]
        assert set(sp) == {"product_name", "cas_number", "grade"}
        assert by_name["request_sample"]["parameters"]["required"] == []

    def test_directive_names_tools_and_states_safety_rule(self):
        directive = build_agent_directive(load_pack("chemical"))
        assert "get_sds" in directive
        assert "get_product_spec" in directive
        assert "request_quote" in directive
        assert "request_sample" in directive
        assert "NEVER" in directive
        assert "Safety Data Sheet" in directive
        # The spec tool must not become a backdoor: safety still routes to get_sds.
        assert "safety-class question still goes to get_sds" in directive
        # Pricing guardrail: the model must never compute a price itself.
        assert "NEVER state, compute" in directive


# ── run_agent_loop ───────────────────────────────────────────────────────────

class TestRunAgentLoop:
    def test_direct_text_answer_no_tools(self):
        model = FakeModel([FakeResp(content="Hello there.")])
        out = _run(run_agent_loop(model, [], lambda n, a: {}))
        assert out == "Hello there."
        assert len(model.invocations) == 1

    def test_one_tool_round_then_answer(self):
        calls = []

        def executor(name, args):
            calls.append((name, args))
            return {"status": "found", "sds_url": "https://x/y.pdf"}

        model = FakeModel([
            FakeResp(tool_calls=[{"name": "get_sds",
                                  "args": {"cas_number": "7664-93-9"},
                                  "id": "call_1"}]),
            FakeResp(content="Here is the SDS: https://x/y.pdf"),
        ])
        out = _run(run_agent_loop(model, [], executor))
        assert out == "Here is the SDS: https://x/y.pdf"
        assert calls == [("get_sds", {"cas_number": "7664-93-9"})]
        # second invocation must include the tool result (a ToolMessage).
        second = model.invocations[1]
        assert any(getattr(m, "content", "").startswith("{") for m in second)

    def test_runaway_tool_calls_exhaust_to_fallback(self):
        loop_resp = FakeResp(tool_calls=[{"name": "get_sds", "args": {}, "id": "c"}])
        model = FakeModel([loop_resp, loop_resp, loop_resp, loop_resp])
        out = _run(run_agent_loop(model, [], lambda n, a: {"status": "not_found"}))
        assert out == AGENT_FALLBACK_TEXT

    def test_llm_failure_degrades_to_fallback(self):
        model = FakeModel([FakeResp(content="never reached")], raise_on=0)
        out = _run(run_agent_loop(model, [], lambda n, a: {}))
        assert out == AGENT_FALLBACK_TEXT

    def test_tool_exception_is_caught_and_observed(self):
        def boom(name, args):
            raise RuntimeError("db down")

        model = FakeModel([
            FakeResp(tool_calls=[{"name": "get_sds", "args": {}, "id": "c"}]),
            FakeResp(content="Sorry, let me connect you to the team."),
        ])
        out = _run(run_agent_loop(model, [], boom))
        assert out == "Sorry, let me connect you to the team."
        # the failed tool still produced a ToolMessage observation
        observation = json.loads(model.invocations[1][-1].content)
        assert observation["status"] == "error"

    def test_empty_content_answer_falls_back(self):
        model = FakeModel([FakeResp(content="")])
        out = _run(run_agent_loop(model, [], lambda n, a: {}))
        assert out == AGENT_FALLBACK_TEXT
