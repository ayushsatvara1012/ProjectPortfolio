"""Phase 2: the tool registry - pack agreement, availability gating, capture shape.

docs/agent-runtime-restructure-plan.md Phase 2 / §3. The point of the registry is
that a tool's schema, dispatch, capture and availability can no longer disagree;
these are the tests that hold that.
"""
import asyncio

import pytest

from packs import load_pack
from services.agent_runtime import registry as agent_registry
from services.agent_runtime.registry import (
    RuntimeTool,
    ToolContext,
    assert_registry_covers_packs,
    build_schemas,
    executor,
)

CID = "11111111-1111-1111-1111-111111111111"


def _ctx(**kw):
    kw.setdefault("company", {"id": CID})
    return ToolContext(**kw)


class TestPackRegistryAgreement:
    def test_boot_assertion_passes_today(self):
        assert_registry_covers_packs() is None

    def test_every_chemical_tool_has_a_runtime_tool(self):
        pack = load_pack("chemical")
        for name in pack.tool_names():
            assert agent_registry.get(name) is not None, name

    def test_a_pack_tool_with_no_runtime_tool_fails_at_boot(self, monkeypatch):
        import packs.registry as packs_registry

        class FakePack:
            def tool_names(self):
                return ("get_sds", "book_demo")

        monkeypatch.setattr(packs_registry, "load_pack", lambda v: FakePack())
        with pytest.raises(RuntimeError, match="book_demo"):
            assert_registry_covers_packs()

    def test_a_runtime_tool_no_pack_declares_fails_at_boot(self, monkeypatch):
        orphan = RuntimeTool(name="send_invoice", execute=lambda ctx, args: {})
        monkeypatch.setitem(agent_registry._REGISTRY, "send_invoice", orphan)
        with pytest.raises(RuntimeError, match="send_invoice"):
            assert_registry_covers_packs()

    def test_duplicate_registration_is_refused(self):
        with pytest.raises(ValueError, match="duplicate"):
            agent_registry.register(RuntimeTool(name="get_sds", execute=lambda c, a: {}))


class TestAvailabilityGating:
    """B10: get_coa was advertised to every chemical bot, including those with no
    Drive folder, which could only ever answer 'not set up'."""

    def test_coa_is_offered_when_a_folder_is_configured(self):
        names = {s["name"] for s in build_schemas(load_pack("chemical"), _ctx(coa_configured=True))}
        assert "get_coa" in names

    def test_coa_is_withheld_when_no_folder_is_configured(self):
        names = {s["name"] for s in build_schemas(load_pack("chemical"), _ctx(coa_configured=False))}
        assert "get_coa" not in names
        assert {"get_sds", "get_product_spec", "request_quote", "request_sample"} <= names

    def test_no_context_means_no_filtering(self):
        names = {s["name"] for s in build_schemas(load_pack("chemical"))}
        assert names == set(load_pack("chemical").tool_names())

    def test_an_unavailable_tool_called_anyway_gets_the_benign_error(self):
        obs = executor(_ctx(coa_configured=False), {})(
            "get_coa", {"product_code": "x", "batch_number": ""})
        assert obs["status"] == "error" and "not available" in obs["message"]

    def test_an_unknown_tool_gets_the_benign_error(self):
        obs = executor(_ctx(), {})("delete_everything", {})
        assert obs["status"] == "error" and "not available" in obs["message"]


class TestCaptureShape:
    def _run(self, name, obs, args=None, **ctxkw):
        captured = {}
        tool = RuntimeTool(
            name=name,
            execute=lambda ctx, a: obs,
            capture=agent_registry.get(name).capture,
            capture_keys=agent_registry.get(name).capture_keys,
        )
        agent_registry._apply_capture(tool, args or {}, obs, captured)
        return captured

    def test_get_sds_capture_builds_the_button_payload(self):
        captured = self._run("get_sds", {
            "status": "found", "sds_url": "https://x/sds.pdf",
            "product": {"name": "Acetone", "cas_number": "67-64-1"},
            "last_updated": "2026-01-01",
        })
        assert captured["sds"]["url"] == "https://x/sds.pdf"
        assert captured["sds"]["product"] == "Acetone"

    def test_get_sds_captures_nothing_without_a_document(self):
        assert self._run("get_sds", {"status": "not_found"}) == {}

    def test_quote_capture_emits_both_the_card_and_the_owner_handoff(self):
        captured = self._run(
            "request_quote",
            {"status": "quoted", "product": "Acetone", "unit_price": 100, "subtotal": 200},
            args={"contact_email": "buyer@acme.com", "contact_name": "Asha"},
        )
        assert captured["quote"]["status"] == "quoted"
        assert captured["quote"]["captured_contact"]["email"] == "buyer@acme.com"
        assert captured["handoff"]["kind"] == "quote" and captured["handoff"]["is_por"] is False

    def test_por_quote_is_flagged_for_the_owner(self):
        captured = self._run("request_quote", {"status": "price_on_request", "product": "X"})
        assert captured["handoff"]["is_por"] is True
        assert captured["quote"]["captured_contact"] is None

    def test_quote_needs_grade_emits_chips_not_a_quote(self):
        captured = self._run(
            "request_quote", {"status": "needs_grade", "product": "X", "grades": ["AR", "LR"]}
        )
        assert captured["grade_selector"]["grades"] == ["AR", "LR"]
        assert "quote" not in captured and "handoff" not in captured

    def test_spec_found_with_multiple_packs_emits_a_pack_selector(self):
        captured = self._run("get_product_spec", {
            "status": "found",
            "product": {"name": "Acetone", "grade": "AR", "packaging": "2.5 Ltr"},
            "pack_sizes": ["500 ml", "2.5 Ltr"],
        })
        assert captured["spec"]["product"] == "Acetone"
        assert captured["pack_selector"]["pack_sizes"] == ["500 ml", "2.5 Ltr"]

    def test_spec_found_with_one_pack_emits_no_selector(self):
        captured = self._run("get_product_spec", {
            "status": "found", "product": {"name": "Acetone"}, "pack_sizes": ["2.5 Ltr"],
        })
        assert "pack_selector" not in captured

    def test_sample_capture_opens_the_form(self):
        captured = self._run("request_sample", {"status": "open_form", "prefill": {"product": "X"}})
        assert captured["form"] == {"form_id": "sample", "prefill": {"product": "X"}}

    def test_a_tool_capturing_an_undeclared_key_is_a_hard_error(self):
        rogue = RuntimeTool(
            name="rogue",
            execute=lambda ctx, a: {},
            capture=lambda a, o: {"quote": {"status": "quoted"}},
            capture_keys=("spec",),
        )
        with pytest.raises(ValueError, match="undeclared keys"):
            agent_registry._apply_capture(rogue, {}, {}, {})


class TestAsyncToolAndPrivateKeys:
    def test_coa_capture_reads_rows_and_the_observation_loses_them(self):
        async def runner(company, args, *, visitor_id=None, client_ip=None):
            return {"status": "found", "message": "1 match", "_rows": [{"name": "COA.pdf"}]}

        captured = {}
        run = executor(_ctx(coa_configured=True, runners={"get_coa": runner}), captured)
        obs = asyncio.run(run("get_coa", {"product_code": "acetone", "batch_number": ""}))
        assert captured["coa"] == {
            "status": "found", "results": [{"name": "COA.pdf"}], "query": "acetone",
        }
        assert "_rows" not in obs, "raw rows must never reach the model's prompt"
        assert obs["status"] == "found"

    def test_coa_lockout_is_captured_so_the_panel_opens_disabled(self):
        async def runner(company, args, *, visitor_id=None, client_ip=None):
            return {"status": "error", "_lockout": 900}

        captured = {}
        run = executor(_ctx(coa_configured=True, runners={"get_coa": runner}), captured)
        obs = asyncio.run(run("get_coa", {"product_code": "x", "batch_number": ""}))
        assert captured["coa"]["status"] == "locked_out"
        assert captured["coa"]["retry_after"] == 900
        assert "_lockout" not in obs

    def test_coa_without_an_injected_runner_degrades_benignly(self):
        obs = executor(_ctx(coa_configured=True), {})(
            "get_coa", {"product_code": "x", "batch_number": ""})
        assert obs["status"] == "error"


class TestStatusPhrases:
    def test_every_registered_tool_has_a_visitor_safe_phrase(self):
        for name in agent_registry.names():
            phrase = agent_registry.status_phrase(name)
            assert phrase and name not in phrase

    def test_unknown_tool_gets_the_generic_phrase(self):
        assert agent_registry.status_phrase("nope") == "Working on it…"
