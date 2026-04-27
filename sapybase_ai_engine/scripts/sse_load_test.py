"""SSE concurrency load test for /api/chat.

Usage (from Sapybase_ai_engine/ with venv activated):

    # Against local dev server:
    ./venv/bin/python scripts/sse_load_test.py --base-url http://localhost:8000

    # Against Render:
    ./venv/bin/python scripts/sse_load_test.py --base-url https://<your-render-url>

    # Adjust concurrency (default 8):
    ./venv/bin/python scripts/sse_load_test.py --base-url ... --concurrency 20

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
        "tokens": tokens_received,
        "pings": pings_received,
        "error": error_detail,
    })


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main(base_url: str, concurrency: int, api_key: str) -> None:
    print(f"\nSapybase SSE Load Test")
    print(f"  Base URL    : {base_url}")
    print(f"  Concurrency : {concurrency} simultaneous streams")
    print(f"  Message     : \"{TEST_MESSAGE}\"\n")

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

    if ok:
        times = [r["elapsed_s"] for r in ok]
        print(f"\n  Latency (successful streams):")
        print(f"    min  {min(times):.1f}s")
        print(f"    avg  {sum(times)/len(times):.1f}s")
        print(f"    max  {max(times):.1f}s")
        avg_tokens = sum(r["tokens"] for r in ok) / len(ok)
        avg_pings  = sum(r["pings"]  for r in ok) / len(ok)
        print(f"    avg tokens/stream : {avg_tokens:.0f}")
        print(f"    avg pings/stream  : {avg_pings:.1f}")

    if limited:
        print(f"\n  Rate-limited details:")
        for r in limited:
            print(f"    worker {r['worker_id']:2d} — {r['error']}")

    if errors:
        print(f"\n  Error details:")
        for r in errors:
            print(f"    worker {r['worker_id']:2d} — {r['error']}")

    if timeouts:
        print(f"\n  Timeout details:")
        for r in timeouts:
            print(f"    worker {r['worker_id']:2d} — {r['error']}")

    # Exit non-zero if more than half failed (ignoring rate limits — those are expected)
    hard_failures = len(errors) + len(timeouts)
    if hard_failures > concurrency // 2:
        print(f"\nFAIL: {hard_failures} hard failures exceed threshold.")
        sys.exit(1)
    else:
        print(f"\nPASS: load test complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SSE concurrency load test")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--concurrency", type=int, default=8, help="Number of parallel streams")
    args = parser.parse_args()

    api_key = os.getenv("SSE_TEST_API_KEY")

    if not api_key:
        print(
            "ERROR: Set SSE_TEST_API_KEY in your .env or environment.\n"
            "  SSE_TEST_API_KEY  — a valid company API key from your dashboard",
            file=sys.stderr,
        )
        sys.exit(1)

    asyncio.run(main(args.base_url, args.concurrency, api_key))
