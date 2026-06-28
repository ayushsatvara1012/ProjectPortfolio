"""config.py ↔ entitlements.ts mirror snapshot (RFC docs/rfc-byod.md Phase 1.1, Rule R18).

`config.py` (PLAN_LIMITS / CUSTOM_PLAN_FEATURE_KEYS) and
`src/lib/auth/entitlements.ts` are mirrored sources of truth. The TS layer only
drives UI gating — every capability is ALSO enforced server-side via
has_entitlement — but if the two drift, the dashboard can show a feature the
backend denies (or hide one it allows). This test fails loudly on drift so the
mirror can never silently rot, with special attention to the new `byo_database`
flag added in Phase 1.1.

It parses the TS file as text (no Node toolchain needed in the Python CI job),
asserting the structural facts the mirror guarantees.
"""
import re
from pathlib import Path

import pytest

from core.config import CUSTOM_PLAN_FEATURE_KEYS, PLAN_LIMITS

# repo_root/sapybase_ai_engine/tests/<this file>  →  parents[2] == repo root
ENTITLEMENTS_TS = (
    Path(__file__).resolve().parents[2] / "src" / "lib" / "auth" / "entitlements.ts"
)


@pytest.fixture(scope="module")
def ts_source() -> str:
    if not ENTITLEMENTS_TS.exists():
        pytest.skip(f"entitlements.ts not found at {ENTITLEMENTS_TS} (checkout layout)")
    return ENTITLEMENTS_TS.read_text(encoding="utf-8")


def _resolved_feature_keys(ts: str) -> set[str]:
    """The snake_case feature keys the TS resolver reads, e.g. resolve('canX', 'x')."""
    return set(re.findall(r"resolve\(\s*'[^']+'\s*,\s*'([^']+)'\s*\)", ts))


def test_feature_key_set_matches_backend(ts_source):
    # The exact set of feature flags entitlements.ts resolves MUST equal the backend's
    # canonical CUSTOM_PLAN_FEATURE_KEYS — no extra, none missing.
    ts_keys = _resolved_feature_keys(ts_source)
    assert ts_keys == set(CUSTOM_PLAN_FEATURE_KEYS), (
        f"entitlements.ts feature keys {ts_keys} != config.py "
        f"CUSTOM_PLAN_FEATURE_KEYS {set(CUSTOM_PLAN_FEATURE_KEYS)} "
        f"(symmetric diff: {ts_keys ^ set(CUSTOM_PLAN_FEATURE_KEYS)})"
    )


def test_byo_database_is_mirrored(ts_source):
    # The Phase 1.1 addition specifically.
    assert "byo_database" in CUSTOM_PLAN_FEATURE_KEYS
    assert "byo_database" in _resolved_feature_keys(ts_source)
    assert "canUseByoDatabase" in ts_source, "Entitlements type must expose canUseByoDatabase"


def test_byod_tier_defaults_grant_all_capabilities(ts_source):
    # PLAN_LIMITS["BYOD"] is all-features-on; the TS TIER_DEFAULTS.BYOD block must
    # mirror that (every capability true, including canUseByoDatabase). RFC §3.2.
    m = re.search(r"\bBYOD:\s*\{(.*?)\}", ts_source, re.DOTALL)
    assert m, "TIER_DEFAULTS must contain a BYOD block mirroring PLAN_LIMITS['BYOD']"
    block = m.group(1)
    granted = dict(re.findall(r"(can[A-Za-z]+)\s*:\s*(true|false)", block))
    assert granted, "BYOD block has no capability flags"
    # Every capability listed in the BYOD block must be granted (true).
    for cap, val in granted.items():
        assert val == "true", f"BYOD.{cap} should be true (all features on)"
    assert granted.get("canUseByoDatabase") == "true"
    # And BYOD must enable the full feature surface, matching the all-on backend row.
    assert PLAN_LIMITS["BYOD"]["byo_database"] is True
    for feat in ("white_label", "analytics", "webhook", "human_handoff", "lead_capture", "custom_logo"):
        assert PLAN_LIMITS["BYOD"][feat] is True
