#!/usr/bin/env python3
"""
local_dev_setup.py — SaPyBase Local Development Setup Checker
=============================================================
Run this ONCE before starting your local dev environment.
It validates your config, checks DB connectivity, and prints a
step-by-step startup guide.

Usage:
    cd sapybase_ai_engine
    python local_dev_setup.py
"""

import os
import sys
import socket
import subprocess
from dotenv import load_dotenv

# ── Load env (local overrides prod) ───────────────────────────────────────────
load_dotenv(".env.local")
load_dotenv(".env")

REQUIRED_BACKEND_VARS = [
    "DATABASE_URL",
    "GEMINI_API_KEY",
    "CLERK_SECRET_KEY",
    "CLERK_JWT_ISSUER",
    "CLERK_WEBHOOK_SECRET",
    "ADMIN_EMAIL",
]

OPTIONAL_BACKEND_VARS = [
    "POLAR_ACCESS_TOKEN",
    "POLAR_WEBHOOK_SECRET",
    "REDIS_URL",
]

# ─────────────────────────────────────────────────────────────────────────────

def check_mark(ok: bool) -> str:
    return "✅" if ok else "❌"

def warn_mark(ok: bool) -> str:
    return "✅" if ok else "⚠️ "

def section(title: str):
    print(f"\n{'─' * 55}")
    print(f"  {title}")
    print(f"{'─' * 55}")

def check_env_vars():
    section("1. Environment Variables")
    all_ok = True
    for var in REQUIRED_BACKEND_VARS:
        val = os.getenv(var)
        ok = bool(val and val != "CHANGE_ME" and "XXXX" not in val)
        status = check_mark(ok)
        masked = (val[:10] + "…") if val and len(val) > 10 else val
        print(f"  {status}  {var:<35} {masked or '(not set)'}")
        if not ok:
            all_ok = False

    print()
    for var in OPTIONAL_BACKEND_VARS:
        val = os.getenv(var)
        ok = bool(val and "XXXX" not in val)
        status = warn_mark(ok)
        masked = (val[:10] + "…") if val and len(val) > 10 else val
        print(f"  {status}  {var:<35} {masked or '(not set — optional)'}")

    if not all_ok:
        print("\n  ⛔  Fix missing required vars in sapybase_ai_engine/.env.local")
    return all_ok

def check_db():
    section("2. Database Connectivity")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("  ❌  DATABASE_URL not set — skipping DB check")
        return False
    try:
        import psycopg2
        from pgvector.psycopg2 import register_vector
        conn = psycopg2.connect(db_url)
        register_vector(conn)
        cur = conn.cursor()
        cur.execute("SELECT current_database(), version()")
        db_name, version = cur.fetchone()
        print(f"  ✅  Connected to: {db_name}")
        print(f"      {version[:60]}…")

        # Check required tables
        tables = ["users", "companies", "usage_tracking", "company_knowledge",
                  "exact_query_cache", "chat_logs", "processed_webhooks"]
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        existing = {row[0] for row in cur.fetchall()}
        print()
        for t in tables:
            ok = t in existing
            print(f"  {check_mark(ok)}  table: {t}")

        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"  ❌  DB connection failed: {e}")
        return False

def check_gemini():
    section("3. Gemini API Key")
    key = os.getenv("GEMINI_API_KEY")
    if not key or "XXXX" in key:
        print("  ❌  GEMINI_API_KEY not configured")
        return False
    try:
        import requests
        resp = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=8
        )
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])[:3]]
            print(f"  ✅  API key valid. Sample models: {models}")
            return True
        else:
            print(f"  ❌  API key rejected (HTTP {resp.status_code})")
            return False
    except Exception as e:
        print(f"  ⚠️   Could not reach Gemini API: {e}")
        return False

def check_ports():
    section("4. Port Availability")
    ports = {8000: "FastAPI backend", 5173: "Vite frontend"}
    for port, name in ports.items():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            in_use = s.connect_ex(("localhost", port)) == 0
        if in_use:
            print(f"  ⚠️   Port {port} ({name}) is ALREADY IN USE — process may be running")
        else:
            print(f"  ✅  Port {port} ({name}) is free")

def check_ngrok():
    section("5. ngrok (Webhook Tunnel)")
    try:
        result = subprocess.run(["ngrok", "version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"  ✅  ngrok installed: {result.stdout.strip()}")
            # Check if ngrok is currently running
            try:
                import urllib.request, json
                with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2) as r:
                    tunnels = json.loads(r.read())["tunnels"]
                    if tunnels:
                        for t in tunnels:
                            print(f"  🌐  Active tunnel: {t['public_url']} → {t['config']['addr']}")
                    else:
                        print("  ⚠️   ngrok installed but NOT running. Start it for webhook testing.")
            except:
                print("  ⚠️   ngrok NOT running. Webhooks won't work until you start it.")
                print("       Run: ngrok http 8000")
        else:
            print("  ⚠️   ngrok not found")
    except FileNotFoundError:
        print("  ⚠️   ngrok not installed. Install from https://ngrok.com/download")
        print("       Webhooks (Clerk/Polar) won't work without it locally.")

def check_venv():
    section("6. Python Virtual Environment")
    venv_path = os.path.join(os.path.dirname(__file__), "venv")
    if os.path.exists(venv_path):
        print(f"  ✅  venv found at: {venv_path}")
    else:
        print("  ⚠️   No venv found. Create one:")
        print("       python3 -m venv venv && source venv/bin/activate")
        print("       pip install -r requirements.txt --break-system-packages")

def print_startup_guide():
    section("🚀 LOCAL STARTUP GUIDE")
    env = os.getenv("ENV", "production")
    ngrok_url = "<your-ngrok-url>"

    # Try to get live ngrok URL
    try:
        import urllib.request, json
        with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2) as r:
            tunnels = json.loads(r.read())["tunnels"]
            https = [t for t in tunnels if t["public_url"].startswith("https")]
            if https:
                ngrok_url = https[0]["public_url"]
    except:
        pass

    print("""
  STEP 1 — Start the backend (Terminal 1):
  ─────────────────────────────────────────
  cd sapybase_ai_engine
  source venv/bin/activate
  uvicorn main:app --reload --port 8000

  STEP 2 — Start ngrok (Terminal 2):
  ─────────────────────────────────────────
  ngrok http 8000

  STEP 3 — Update webhook URLs in dashboards:
  ─────────────────────────────────────────""")
    print(f"  Clerk webhook:  {ngrok_url}/api/webhooks/clerk")
    print(f"  Polar webhook:  {ngrok_url}/api/webhooks/polar")
    print("""
  STEP 4 — Start the frontend (Terminal 3):
  ─────────────────────────────────────────
  cd <project-root>
  npm run dev

  STEP 5 — Open in browser:
  ─────────────────────────────────────────
  http://localhost:5173

  TIPS:
  • Sign up with your ADMIN_EMAIL first → auto-promoted to SUPER_ADMIN
  • Use Polar sandbox cards: 4242 4242 4242 4242 (any future date/CVV)
  • Clerk sandbox: real emails work, verification codes sent to actual inbox
  • Check backend logs in Terminal 1 for webhook events
  • Run python local_dev_setup.py anytime to re-validate your setup
""")

def main():
    print("\n" + "═" * 55)
    print("  SaPyBase Local Dev Environment Checker")
    print("═" * 55)

    env_mode = os.getenv("ENV", "production")
    print(f"\n  ENV mode: {'✅ development' if env_mode == 'development' else '⚠️  ' + env_mode + ' (set ENV=development in .env.local!)'}")

    env_ok = check_env_vars()
    db_ok = check_db()
    gemini_ok = check_gemini()
    check_ports()
    check_ngrok()
    check_venv()
    print_startup_guide()

    # Summary
    section("SUMMARY")
    print(f"  {check_mark(env_ok)}  Environment variables")
    print(f"  {check_mark(db_ok)}  Database connection")
    print(f"  {check_mark(gemini_ok)}  Gemini API")
    print()

    if env_ok and db_ok and gemini_ok:
        print("  🎉  All critical checks passed! You're ready to run locally.\n")
    else:
        print("  ⛔  Fix the issues above before starting the dev server.\n")

if __name__ == "__main__":
    main()