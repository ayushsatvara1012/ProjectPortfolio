#!/usr/bin/env python3
"""
Debug script to test /api/config endpoint directly
"""

import os
import sys
from pathlib import Path
import json

# Load env
env_file = Path("sapybase_ai_engine/.env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

# Add the sapybase path
sys.path.insert(0, '/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine')

print("\n" + "="*80)
print("  DEBUGGING /api/config ENDPOINT")
print("="*80 + "\n")

try:
    # Import after setting path
    from main import get_db_connection, release_db_connection
    import hashlib

    print("✅ Successfully imported main module\n")

    # Get a test API key from the database
    conn = get_db_connection()
    cursor = conn.cursor()

    print("🔍 Fetching test API keys from database...\n")
    cursor.execute("SELECT api_key, bot_name FROM companies LIMIT 3")
    rows = cursor.fetchall()

    if not rows:
        print("❌ No companies found in database")
        cursor.close()
        release_db_connection(conn)
        sys.exit(1)

    for api_key, bot_name in rows:
        print(f"🤖 {bot_name}")
        print(f"   Raw API Key: {api_key[:30]}...{api_key[-10:]}")

        # This is already hashed in the DB, so we don't need to hash it again
        hashed_key = api_key

        # Now try to query what verify_api_key_and_origin would get
        cursor.execute(
            """
            SELECT c.id, c.company_name, c.company_tone, c.theme_color, c.allowed_origin,
                   c.system_prompt, c.bot_name, c.logo_url, c.initial_message, c.quick_questions,
                   c.logo_shape, c.custom_logo_url, c.avatar_bg_style, u.tier, u.role, c.webhook_url,
                   u.email, c.handoff_redirect_url, c.hide_branding,
                   u.id, u.subscription_status, u.billing_period_end
            FROM companies c
            JOIN users u ON c.user_id = u.id
            WHERE c.api_key = %s
            """,
            (hashed_key,)
        )

        company_data = cursor.fetchone()

        if not company_data:
            print(f"   ❌ Company data not found!")
        else:
            print(f"   ✅ Company data retrieved")

            # Try to build the response dict
            print(f"\n   Testing response construction...")

            try:
                from main import normalize_quick_questions, PLAN_LIMITS

                tier = (company_data[13] or "FREE").upper()
                role = company_data[14]

                company = {
                    "id": company_data[0],
                    "company_name": company_data[1] or "our company",
                    "company_tone": company_data[2] or "Professional and helpful",
                    "theme_color": company_data[3] or "#5730F5",
                    "allowed_origin": company_data[4],
                    "system_prompt": company_data[5] or "You are a helpful AI assistant.",
                    "bot_name": company_data[6] or "Sapy AI",
                    "logo_url": company_data[7] or "https://www.sapybase.com/SB_loading.svg",
                    "initial_message": company_data[8] or "Hi! How can I help you today?",
                    "quick_questions": normalize_quick_questions(company_data[9]),
                    "logo_shape": company_data[10] or "circle",
                    "custom_logo_url": company_data[11] or None,
                    "avatar_bg_style": company_data[12] or "none",
                }

                print(f"   ✅ Response dict constructed successfully")
                print(f"\n   Response preview:")
                print(json.dumps(company, indent=2, default=str))

            except Exception as e:
                print(f"   ❌ Error constructing response dict:")
                print(f"      {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()

        print()

    cursor.close()
    release_db_connection(conn)

except Exception as e:
    print(f"❌ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("="*80 + "\n")
