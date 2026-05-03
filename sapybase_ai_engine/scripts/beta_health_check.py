"""Beta launch health monitor.

Runs a quick smoke-test against all critical endpoints before and during the
2-week trusted beta. Exits non-zero on any failure so it can be wired into CI
or a cron job.

Usage:
    ./venv/bin/python scripts/beta_health_check.py --base-url https://<render-url>
    ./venv/bin/python scripts/beta_health_check.py --base-url http://localhost:8000

Required env vars (loaded from .env / .env.local):
    SSE_TEST_API_KEY   — a valid company API key
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

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


CHECK_PASS = "PASS"
CHECK_FAIL = "FAIL"
CHECK_WARN = "WARN"


async def check_health(client: httpx.AsyncClient, base_url: str) -> tuple[str, str]:
    try:
        r = await client.get(f"{base_url}/health", timeout=10.0)
        if r.status_code == 200:
            return CHECK_PASS, f"HTTP 200 — {r.text[:80]}"
        return CHECK_FAIL, f"HTTP {r.status_code}"
    except Exception as exc:
        return CHECK_FAIL, str(exc)


async def check_chat_stream(client: httpx.AsyncClient, base_url: str, api_key: str) -> tuple[str, str]:
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "origin": os.getenv("SSE_TEST_ORIGIN", "https://Sapybase.com"),
    }
    payload = {
        "message": "ping",
        "session_id": f"beta-health-{int(time.time())}",
    }
    try:
        t0 = time.monotonic()
        ttft: float | None = None
        token_count = 0
        async with client.stream("POST", f"{base_url}/api/chat", json=payload, headers=headers, timeout=30.0) as resp:
            if resp.status_code == 429:
                return CHECK_WARN, "rate limited (429) — quota may be exhausted"
            if resp.status_code != 200:
                body = await resp.aread()
                return CHECK_FAIL, f"HTTP {resp.status_code}: {body[:100].decode(errors='replace')}"
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    payload_str = line[6:]
                    if payload_str == "[DONE]":
                        break
                    try:
                        data = json.loads(payload_str)
                        if "token" in data:
                            if ttft is None:
                                ttft = time.monotonic() - t0
                            token_count += 1
                    except json.JSONDecodeError:
                        pass
        ttft_str = f"TTFT={ttft:.3f}s" if ttft is not None else "TTFT=n/a"
        return CHECK_PASS, f"{ttft_str}, {token_count} tokens"
    except httpx.TimeoutException:
        return CHECK_FAIL, "timeout (30s)"
    except Exception as exc:
        return CHECK_FAIL, str(exc)


async def check_docs_endpoint(client: httpx.AsyncClient, base_url: str, api_key: str) -> tuple[str, str]:
    """Verify the document listing endpoint is reachable."""
    headers = {"x-api-key": api_key}
    try:
        r = await client.get(f"{base_url}/api/documents", headers=headers, timeout=10.0)
        if r.status_code in (200, 404):
            return CHECK_PASS, f"HTTP {r.status_code}"
        if r.status_code == 401:
            return CHECK_WARN, "401 — API key may be invalid for this check"
        return CHECK_FAIL, f"HTTP {r.status_code}"
    except Exception as exc:
        return CHECK_FAIL, str(exc)


async def main(base_url: str, api_key: str) -> None:
    print(f"\nSapybase Beta Health Check")
    print(f"  Target: {base_url}")
    print(f"  Time  : {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")

    async with httpx.AsyncClient() as client:
        checks = await asyncio.gather(
            check_health(client, base_url),
            check_chat_stream(client, base_url, api_key),
            check_docs_endpoint(client, base_url, api_key),
        )

    labels = [
        "GET  /health            ",
        "POST /api/chat (stream) ",
        "GET  /api/documents     ",
    ]

    failures = 0
    for label, (status, detail) in zip(labels, checks):
        icon = "✓" if status == CHECK_PASS else ("⚠" if status == CHECK_WARN else "✗")
        print(f"  [{icon}] {label}  {status}  —  {detail}")
        if status == CHECK_FAIL:
            failures += 1

    print()
    if failures:
        print(f"FAIL: {failures} check(s) failed.")
        sys.exit(1)
    else:
        print("PASS: all checks healthy.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Beta launch health check")
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()

    api_key = os.getenv("SSE_TEST_API_KEY")
    if not api_key:
        print("ERROR: Set SSE_TEST_API_KEY in your .env or environment.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(main(args.base_url, api_key))
