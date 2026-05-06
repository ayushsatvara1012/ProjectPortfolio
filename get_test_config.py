#!/usr/bin/env python3
"""
Get test configuration for lead capture testing
Finds an API key and bot ID from the database
"""

import sys
import os

def get_test_config():
    try:
        sys.path.insert(0, '/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine')
        from main import get_db_connection, release_db_connection

        conn = get_db_connection()
        try:
            cursor = conn.cursor()

            # Get companies with API keys and check if lead capture is enabled
            cursor.execute("""
                SELECT
                    c.id,
                    c.bot_name,
                    c.api_key,
                    u.tier,
                    c.webhook_url,
                    CASE WHEN p.lead_capture = true THEN 'YES' ELSE 'NO' END as lead_capture_enabled
                FROM companies c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN subscription_plans p ON u.tier = p.tier
                LIMIT 5
            """)

            rows = cursor.fetchall()

            if not rows:
                print("❌ No companies found in database")
                return None

            print("📋 Available Bots for Testing:\n")
            print(f"{'Bot Name':<20} {'Bot ID':<20} {'Tier':<10} {'Lead Capture':<15} {'Has Webhook':<12}")
            print("-" * 80)

            selected_bot = None
            for i, row in enumerate(rows):
                bot_id, bot_name, api_key, tier, webhook_url, lead_capture = row
                has_webhook = "✅ Yes" if webhook_url else "❌ No"
                print(f"{bot_name:<20} {bot_id:<20} {tier:<10} {lead_capture:<15} {has_webhook:<12}")

                if not selected_bot and tier in ['PRO', 'CUSTOM']:
                    selected_bot = (bot_id, api_key, bot_name, webhook_url)

            if not selected_bot:
                # Get the first one
                bot_id, bot_name, api_key, tier, webhook_url, lead_capture = rows[0]
                selected_bot = (bot_id, api_key, bot_name, webhook_url)

            bot_id, api_key, bot_name, webhook_url = selected_bot

            print("\n" + "="*80)
            print("🔧 RECOMMENDED TEST CONFIGURATION:\n")
            print(f"API_KEY = \"{api_key}\"")
            print(f"BOT_ID = \"{bot_id}\"")
            print(f"BOT_NAME = \"{bot_name}\"")
            if webhook_url:
                print(f"WEBHOOK_URL = \"{webhook_url}\"")
            else:
                print(f"WEBHOOK_URL = \"https://webhook.site/unique-id\"  # Update with your test webhook")

            print("\n📝 Steps to run the test:\n")
            print("1. Start the backend server:")
            print("   cd sapybase_ai_engine")
            print("   python main.py")
            print("\n2. In another terminal, update test_lead_capture.py with:")
            print(f"   API_KEY = \"{api_key}\"")
            if webhook_url:
                print(f"   WEBHOOK_URL = \"{webhook_url}\"")
            else:
                print("   WEBHOOK_URL = \"https://webhook.site/YOUR_UNIQUE_ID\"")
                print("   (Get a free test webhook at https://webhook.site)")
            print("\n3. Run the test:")
            print("   python test_lead_capture.py")

            return selected_bot

        finally:
            release_db_connection(conn)

    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure the database is running and environment variables are set:")
        print("  DATABASE_URL, DB_USER, DB_PASSWORD, etc.")
        return None

if __name__ == "__main__":
    config = get_test_config()
    sys.exit(0 if config else 1)
