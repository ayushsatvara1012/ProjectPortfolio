"""Phase 8.4 GA gate: every RFC §16.9 exceptional state has a detection metric,
an alert, and a runbook section — plus the RFC §11 operational runbooks.

Exit criterion (RFC §13, Phase 8.4): "All §16.9 states alert + have a runbook;
on-call sign-off." These tests are pure (no DB) and run in engine-regression.

The three artifacts are checked against ONE source of truth (observability/slo.py:
EXCEPTIONAL_STATES / ALERTS / OPERATIONAL_RUNBOOKS) so the matrix, the alert rules
file, and the runbook doc can never silently drift apart.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from observability import slo

_ENGINE_ROOT = Path(__file__).resolve().parents[1].parent  # sapybase_ai_engine/
_REPO_ROOT = _ENGINE_ROOT.parent
_OBS_DIR = _ENGINE_ROOT / "observability"
_ALERTS_PATH = _OBS_DIR / "alerts" / "byod_alerts.yml"
_RUNBOOK_PATH = _REPO_ROOT / "docs" / "runbooks" / "byod_runbook.md"

# Verbatim from the RFC §16.9 matrix — a renamed/dropped state must break this.
_RFC_16_9_TITLES = {
    "Tenant DB read-only / in recovery",
    "Wrong-dimension vectors",
    "Breaker open (repeated failures)",
    "Schema ahead/behind engine",
    "KMS unavailable",
    "Global ceiling reached",
    "Idempotency-key replay",
    "Routing / company mismatch",
}

_VALID_SEVERITIES = {"page", "ticket", "info"}


def _runbook_text() -> str:
    return _RUNBOOK_PATH.read_text()


def _doc_has_anchor(doc: str, anchor: str) -> bool:
    return f'id="{anchor}"' in doc


# ── §16.9 matrix is complete & faithful ──────────────────────────────────────

def test_exceptional_states_cover_the_rfc_16_9_matrix_exactly():
    titles = {st["title"] for st in slo.EXCEPTIONAL_STATES}
    assert titles == _RFC_16_9_TITLES, (
        "EXCEPTIONAL_STATES drifted from the RFC §16.9 matrix; "
        f"missing={_RFC_16_9_TITLES - titles} extra={titles - _RFC_16_9_TITLES}"
    )
    # No duplicate keys / alerts / runbook anchors.
    keys = [st["key"] for st in slo.EXCEPTIONAL_STATES]
    assert len(keys) == len(set(keys))
    anchors = [st["runbook"] for st in slo.EXCEPTIONAL_STATES]
    assert len(anchors) == len(set(anchors))


def test_every_state_has_metric_alert_and_runbook():
    for st in slo.EXCEPTIONAL_STATES:
        assert st["metrics"], st["key"]
        for m in st["metrics"]:
            assert m in slo.METRIC_CATALOG, f"{st['key']} -> unknown metric {m}"
        assert st["alert"] in slo.ALERTS, f"{st['key']} -> unknown alert {st['alert']}"
        assert st["runbook"], st["key"]
        # The alert must actually reference one of THIS state's detection metrics.
        expr = slo.ALERTS[st["alert"]]["expr"]
        assert any(m in expr for m in st["metrics"]), (
            f"{st['alert']} expr references none of {st['key']}'s metrics: {expr}"
        )


def test_coverage_helper_reports_full_coverage():
    report = slo.exceptional_state_coverage()
    assert report["ok"], [s for s in report["states"] if not s["covered"]]
    assert len(report["states"]) == len(_RFC_16_9_TITLES)
    assert all(s["covered"] for s in report["states"])


# ── Alerts are well-formed and reference real metrics ─────────────────────────

def test_alerts_are_well_formed():
    catalog = set(slo.METRIC_CATALOG)
    for name, a in slo.ALERTS.items():
        assert a["severity"] in _VALID_SEVERITIES, name
        assert isinstance(a["for"], str) and a["for"], name
        assert a["summary"].strip(), name
        assert a["runbook"], name
        hits = [m for m in catalog if m in a["expr"]]
        assert hits, f"alert {name} expr references no catalog metric: {a['expr']}"


def test_every_state_alert_is_paged_or_ticketed_consistently():
    # The three isolation-critical / shared-dependency states must page.
    must_page = {
        "BYODKmsDecryptErrors",
        "BYODGlobalCeilingReached",
        "BYODRoutingIntegrityViolation",
    }
    for name in must_page:
        assert slo.ALERTS[name]["severity"] == "page", name


# ── Alerts-as-code file matches the source (drift guard) ──────────────────────

def test_alert_rules_file_matches_render():
    assert _ALERTS_PATH.exists(), "run slo.render_prometheus_rules() -> byod_alerts.yml"
    on_disk = _load_yaml_or_json(_ALERTS_PATH)
    assert on_disk == slo.render_prometheus_rules(), (
        "byod_alerts.yml is stale; regenerate it from slo.render_prometheus_rules()"
    )


def test_alert_rules_file_is_complete_and_references_catalog():
    rules = _load_yaml_or_json(_ALERTS_PATH)["groups"][0]["rules"]
    rule_names = {r["alert"] for r in rules}
    assert rule_names == set(slo.ALERTS), "every ALERTS entry must be a Prometheus rule"
    catalog = set(slo.METRIC_CATALOG)
    for r in rules:
        assert any(m in r["expr"] for m in catalog), r["alert"]
        assert r["annotations"]["runbook_url"].startswith(slo.RUNBOOK_DOC + "#")


def _load_yaml_or_json(path: Path):
    """The alerts file is JSON-in-a-.yml (valid YAML). Parse with yaml if present,
    else strip leading comment lines and json.load — keeps the test dep-free."""
    try:
        import yaml  # type: ignore

        return yaml.safe_load(path.read_text())
    except ModuleNotFoundError:
        body = "\n".join(
            ln for ln in path.read_text().splitlines() if not ln.lstrip().startswith("#")
        )
        return json.loads(body)


# ── Runbook doc covers every state + the §11 operational runbooks ─────────────

def test_runbook_doc_exists_with_signoff():
    assert _RUNBOOK_PATH.exists(), "docs/runbooks/byod_runbook.md is missing"
    doc = _runbook_text()
    assert "On-call sign-off" in doc, "GA gate requires an on-call sign-off section"


def test_runbook_has_a_section_for_every_exceptional_state():
    doc = _runbook_text()
    for st in slo.EXCEPTIONAL_STATES:
        assert _doc_has_anchor(doc, st["runbook"]), (
            f"runbook missing anchor id=\"{st['runbook']}\" for state {st['key']}"
        )
        # The state's alert name must be referenced in its runbook (cross-link).
        assert st["alert"] in doc, f"runbook never mentions alert {st['alert']}"


def test_runbook_has_the_rfc_11_operational_runbooks():
    doc = _runbook_text()
    for label, anchor in slo.OPERATIONAL_RUNBOOKS.items():
        assert _doc_has_anchor(doc, anchor), (
            f"runbook missing RFC §11 operational runbook '{label}' (id=\"{anchor}\")"
        )


def test_every_alert_runbook_anchor_resolves_in_the_doc():
    doc = _runbook_text()
    for name, a in slo.ALERTS.items():
        assert _doc_has_anchor(doc, a["runbook"]), (
            f"alert {name} points at runbook anchor '{a['runbook']}' that is not in the doc"
        )
