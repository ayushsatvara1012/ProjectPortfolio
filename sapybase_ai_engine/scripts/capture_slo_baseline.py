"""Capture / verify the BYOD SLO baseline (RFC Phase 0.3).

The baseline records the shared-plane error-rate & latency *before* any BYOD
traffic exists, so every later phase can prove it did not regress the shared
fleet (RFC §13: "Baseline captured so later phases can prove no regression.").

Two modes:

  Generate (default) — write observability/baseline.json from the current SLO
  contract (observability/slo.py) plus measurements. Measurements come from a
  metrics export if given, else default to the SLO ceilings (clearly labeled
  "source": "slo_ceilings"), which act as the initial regression budget until a
  real metrics pipeline feeds them.

      python scripts/capture_slo_baseline.py
      python scripts/capture_slo_baseline.py --from metrics_export.json

  Check — compare a current measurements file against the committed baseline and
  exit non-zero on regression. This is what later phases / CI invoke.

      python scripts/capture_slo_baseline.py --check current_measurements.json

A measurements file is JSON like:
    {"shared": {"error_rate": 0.003, "latency_p95_ms": 900, "latency_p99_ms": 1800}}
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys

# Make the engine root importable when run as a script.
_ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ENGINE_ROOT not in sys.path:
    sys.path.insert(0, _ENGINE_ROOT)

from observability import slo  # noqa: E402

BASELINE_PATH = os.path.join(_ENGINE_ROOT, "observability", "baseline.json")


def _git_commit() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=_ENGINE_ROOT, stderr=subprocess.DEVNULL)
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def _ceiling_measurements(plane: str) -> dict[str, float]:
    """Fallback measurements = the SLO ceilings for that plane."""
    s = slo.SLOS.get(plane, {})
    out: dict[str, float] = {}
    if "error_rate_max" in s:
        out["error_rate"] = s["error_rate_max"]
    if "latency_p95_ms_max" in s:
        out["latency_p95_ms"] = s["latency_p95_ms_max"]
    if "latency_p99_ms_max" in s:
        out["latency_p99_ms"] = s["latency_p99_ms_max"]
    return out


def generate(measurements_path: str | None) -> dict:
    if measurements_path:
        with open(measurements_path) as fh:
            measured = json.load(fh)
        source = os.path.basename(measurements_path)
    else:
        measured = {plane: _ceiling_measurements(plane) for plane in slo.SLOS}
        source = "slo_ceilings"

    baseline = {
        "phase": "0.3",
        "slo_version": slo.SLO_VERSION,
        "captured_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "git_commit": _git_commit(),
        "measurements_source": source,
        "slo": slo.as_dict(),
        "measurements": measured,
    }
    return baseline


def write_baseline(baseline: dict) -> None:
    os.makedirs(os.path.dirname(BASELINE_PATH), exist_ok=True)
    with open(BASELINE_PATH, "w") as fh:
        json.dump(baseline, fh, indent=2, sort_keys=True)
        fh.write("\n")


def check(current_path: str) -> int:
    with open(BASELINE_PATH) as fh:
        baseline = json.load(fh)
    with open(current_path) as fh:
        current = json.load(fh)

    if baseline.get("slo_version") != slo.SLO_VERSION:
        print(
            f"WARNING: baseline slo_version {baseline.get('slo_version')} != code {slo.SLO_VERSION}; "
            "regenerate the baseline.",
            file=sys.stderr,
        )

    base_m = baseline.get("measurements", {})
    exit_code = 0
    for plane in current:
        report = slo.evaluate_regression(base_m.get(plane, {}), current[plane], plane=plane)
        status = "OK" if report["ok"] else "REGRESSION"
        print(f"[{plane}] {status}")
        for v in report["violations"]:
            print(
                f"    {v['metric']}: current={v['current']} > budget={v['budget']:.4f} "
                f"(baseline={v['baseline']}, slo_ceiling={v['slo_ceiling']})"
            )
        if not report["ok"]:
            exit_code = 1
    return exit_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Capture or verify the BYOD SLO baseline.")
    parser.add_argument("--from", dest="measurements", help="metrics export JSON to record as the baseline")
    parser.add_argument("--check", dest="check_file", help="compare a current measurements JSON against the baseline")
    args = parser.parse_args(argv)

    if args.check_file:
        return check(args.check_file)

    baseline = generate(args.measurements)
    write_baseline(baseline)
    print(f"Wrote baseline -> {BASELINE_PATH} (source={baseline['measurements_source']}, commit={baseline['git_commit'][:8]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
