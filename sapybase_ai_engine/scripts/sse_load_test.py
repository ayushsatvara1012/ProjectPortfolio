"""SSE concurrency load test for /api/chat.

Usage (from sapybase_ai_engine/ with venv activated):

    # Against local dev server (default 8 workers):
    ./venv/bin/python scripts/sse_load_test.py --base-url http://localhost:8000

    # Against Render at 5x expected scale (100 workers):
    ./venv/bin/python scripts/sse_load_test.py --base-url https://<your-render-url> --concurrency 100

    # With explicit TTFT threshold (default 2.0s):
    ./venv/bin/python scripts/sse_load_test.py --base-url ... --concurrency 100 --ttft-threshold 2.0

Required env vars (loaded from .env / .env.local):
    SSE_TEST_API_KEY   — a valid company API key
    SSE_TEST_BOT_ID    — a valid bot/company ID that key belongs to

These are read from env so they never appear in the script or git history.
Create a dedicated test key in your dashboard for this purpose.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env / .env.local so the user only needs to set vars once
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    ROOT = Path(__file__).resolve().parent.parent
    for env_file in (".env.local", ".env"):
        p = ROOT / env_file
        if p.exists():
            load_dotenv(p)
            break
except ImportError:
    pass

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: ./venv/bin/pip install httpx", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TEST_MESSAGE = "Hello, what can you help me with?"
SESSION_ID_PREFIX = "sse-load-test-"

RESULT_OK = "ok"
RESULT_ERROR = "error"
RESULT_TIMEOUT = "timeout"
RESULT_RATE_LIMITED = "rate_limited"


# ---------------------------------------------------------------------------
# Single stream worker
# ---------------------------------------------------------------------------
async def run_one_stream(
    client: httpx.AsyncClient,
    base_url: str,
    api_key: str,
    worker_id: int,
    results: list,
) -> None:
    url = f"{base_url}/api/chat"
    payload = {
        "message": TEST_MESSAGE,
        "session_id": f"{SESSION_ID_PREFIX}{worker_id}-{int(time.time())}",
    }
    origin = os.getenv("SSE_TEST_ORIGIN", "https://Sapybase.com")
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "origin": origin,
    }

    t_start = time.monotonic()
    t_first_token: float | None = None
    tokens_received = 0
    pings_received = 0
    done_received = False
    error_detail = None
    result_code = RESULT_ERROR

    try:
        async with client.stream("POST", url, json=payload, headers=headers, timeout=90.0) as resp:
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After", "?")
                result_code = RESULT_RATE_LIMITED
                error_detail = f"429 rate limited (Retry-After: {retry_after}s)"
            elif resp.status_code != 200:
                body = await resp.aread()
                result_code = RESULT_ERROR
                error_detail = f"HTTP {resp.status_code}: {body[:200].decode(errors='replace')}"
            else:
                async for line in resp.aiter_lines():
                    if line.startswith(": ping"):
                        pings_received += 1
                    elif line.startswith("data: "):
                        payload_str = line[6:]
                        if payload_str == "[DONE]":
                            done_received = True
                            break
                        try:
                            data = json.loads(payload_str)
                            if "token" in data:
                                if t_first_token is None:
                                    t_first_token = time.monotonic() - t_start
                                tokens_received += 1
                            elif "error" in data:
                                error_detail = f"stream error event: {data['error']}"
                                result_code = RESULT_ERROR
                                break
                        except json.JSONDecodeError:
                            pass

                if done_received:
                    result_code = RESULT_OK

    except httpx.TimeoutException:
        result_code = RESULT_TIMEOUT
        error_detail = "client-side timeout (90s)"
    except Exception as exc:
        result_code = RESULT_ERROR
        error_detail = f"{type(exc).__name__}: {exc}"

    elapsed = time.monotonic() - t_start
    results.append({
        "worker_id": worker_id,
        "result": result_code,
        "elapsed_s": round(elapsed, 2),
        "ttft_s": round(t_first_token, 3) if t_first_token is not None else None,
        "tokens": tokens_received,
        "pings": pings_received,
        "error": error_detail,
    })


# ---------------------------------------------------------------------------
# Percentile helper
# ---------------------------------------------------------------------------
def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    idx = (p / 100) * (len(sorted_v) - 1)
    lo, frac = int(idx), idx % 1
    if frac == 0 or lo + 1 >= len(sorted_v):
        return sorted_v[lo]
    return sorted_v[lo] + frac * (sorted_v[lo + 1] - sorted_v[lo])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main(base_url: str, concurrency: int, api_key: str, ttft_threshold: float) -> None:
    print(f"\nSapybase SSE Load Test")
    print(f"  Base URL      : {base_url}")
    print(f"  Concurrency   : {concurrency} simultaneous streams")
    print(f"  TTFT threshold: {ttft_threshold}s")
    print(f"  Message       : \"{TEST_MESSAGE}\"\n")

    results: list = []
    t_wall_start = time.monotonic()

    # All streams fire at the same instant
    async with httpx.AsyncClient() as client:
        tasks = [
            asyncio.create_task(
                run_one_stream(client, base_url, api_key, i, results)
            )
            for i in range(concurrency)
        ]
        await asyncio.gather(*tasks)

    t_wall = time.monotonic() - t_wall_start

    # ---------------------------------------------------------------------------
    # Report
    # ---------------------------------------------------------------------------
    ok       = [r for r in results if r["result"] == RESULT_OK]
    errors   = [r for r in results if r["result"] == RESULT_ERROR]
    timeouts = [r for r in results if r["result"] == RESULT_TIMEOUT]
    limited  = [r for r in results if r["result"] == RESULT_RATE_LIMITED]

    print("=" * 60)
    print(f"RESULTS  ({concurrency} streams, wall time {t_wall:.1f}s)")
    print("=" * 60)
    print(f"  Successful  : {len(ok)}/{concurrency}")
    print(f"  Rate limited: {len(limited)}/{concurrency}")
    print(f"  Timed out   : {len(timeouts)}/{concurrency}")
    print(f"  Errors      : {len(errors)}/{concurrency}")

    ttft_breach_count = 0

    if ok:
        elapsed_times = [r["elapsed_s"] for r in ok]
        ttft_values = [r["ttft_s"] for r in ok if r["ttft_s"] is not None]

        print(f"\n  Total latency (successful streams):")
        print(f"    min    {min(elapsed_times):.2f}s")
        print(f"    avg    {sum(elapsed_times)/len(elapsed_times):.2f}s")
        print(f"    p95    {percentile(elapsed_times, 95):.2f}s")
        print(f"    p99    {percentile(elapsed_times, 99):.2f}s")
        print(f"    max    {max(elapsed_times):.2f}s")

        if ttft_values:
            ttft_breach_count = sum(1 for t in ttft_values if t > ttft_threshold)
            print(f"\n  Time-to-First-Token (TTFT) — threshold {ttft_threshold}s:")
            print(f"    min    {min(ttft_values):.3f}s")
            print(f"    avg    {sum(ttft_values)/len(ttft_values):.3f}s")
            print(f"    p95    {percentile(ttft_values, 95):.3f}s")
            print(f"    p99    {percentile(ttft_values, 99):.3f}s")
            print(f"    max    {max(ttft_values):.3f}s")
            print(f"    breached threshold: {ttft_breach_count}/{len(ttft_values)} streams")
        else:
            print(f"\n  TTFT: no first-token events captured (check 'token' key in SSE payload)")

        avg_tokens = sum(r["tokens"] for r in ok) / len(ok)
        avg_pings  = sum(r["pings"]  for r in ok) / len(ok)
        print(f"\n  avg tokens/stream : {avg_tokens:.0f}")
        print(f"  avg pings/stream  : {avg_pings:.1f}")

    if limited:
        print(f"\n  Rate-limited details:")
        for r in limited:
            print(f"    worker {r['worker_id']:3d} — {r['error']}")

    if errors:
        print(f"\n  Error details:")
        for r in errors:
            print(f"    worker {r['worker_id']:3d} — {r['error']}")

    if timeouts:
        print(f"\n  Timeout details:")
        for r in timeouts:
            print(f"    worker {r['worker_id']:3d} — {r['error']}")

    # ---------------------------------------------------------------------------
    # Pass/fail determination
    # Hard failures = errors + timeouts exceeding half the concurrency
    # TTFT failures = p95 TTFT exceeding threshold
    # ---------------------------------------------------------------------------
    hard_failures = len(errors) + len(timeouts)
    ttft_ok = True

    if ok:
        ttft_values = [r["ttft_s"] for r in ok if r["ttft_s"] is not None]
        if ttft_values and percentile(ttft_values, 95) > ttft_threshold:
            ttft_ok = False
            p95_ttft = percentile(ttft_values, 95)
            print(f"\nFAIL: p95 TTFT {p95_ttft:.3f}s exceeds threshold {ttft_threshold}s.")

    if hard_failures > concurrency // 2:
        print(f"\nFAIL: {hard_failures} hard failures exceed threshold ({concurrency // 2}).")
        sys.exit(1)
    elif not ttft_ok:
        sys.exit(1)
    else:
        print(f"\nPASS: load test complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SSE concurrency load test")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--concurrency", type=int, default=8, help="Number of parallel streams")
    parser.add_argument(
        "--ttft-threshold",
        type=float,
        default=2.0,
        help="Max acceptable p95 Time-to-First-Token in seconds (default: 2.0)",
    )
    args = parser.parse_args()

    api_key = os.getenv("SSE_TEST_API_KEY")

    if not api_key:
        print(
            "ERROR: Set SSE_TEST_API_KEY in your .env or environment.\n"
            "  SSE_TEST_API_KEY  — a valid company API key from your dashboard",
            file=sys.stderr,
        )
        sys.exit(1)

    asyncio.run(main(args.base_url, args.concurrency, api_key, args.ttft_threshold))
