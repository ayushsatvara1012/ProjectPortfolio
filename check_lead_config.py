#!/usr/bin/env python3
"""
Check lead capture configuration in the database
Works with psycopg2 only (minimal dependencies)
"""

import psycopg2
import os
import sys
from datetime import datetime

def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'sapybase'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ Cannot connect to database: {e}")
        print("\nMake sure these env vars are set:")
        print("  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
        sys.exit(1)

def check_config():
    """Check lead capture configuration"""
    conn = get_db_connection()
    cursor = conn.cursor()

    print("\n" + "="*80)
    print("  SAPYBASE LEAD CAPTURE CONFIGURATION CHECK")
    print("="*80 + "\n")

    # Get companies with webhook config
    cursor.execute("""
        SELECT
            c.id,
            c.bot_name,
            c.api_key,
            u.tier,
            c.webhook_url,
            c.webhook_secret IS NOT NULL as has_secret,
            COUNT(l.id) as lead_count,
            MAX(l.created_at) as last_lead_date
        FROM companies c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN lead_capture l ON c.id = l.company_id
        GROUP BY c.id, c.bot_name, c.api_key, u.tier, c.webhook_url, c.webhook_secret
        ORDER BY c.created_at DESC
        LIMIT 10
    """)

    rows = cursor.fetchall()

    if not rows:
        print("❌ No companies found in database\n")
        conn.close()
        return False

    print(f"📋 Found {len(rows)} bot(s):\n")

    for bot_id, bot_name, api_key, tier, webhook_url, has_secret, lead_count, last_lead_date in rows:
        print(f"🤖 {bot_name}")
        print(f"   ID: {bot_id}")
        print(f"   Tier: {tier}")
        print(f"   API Key: {api_key[:20]}...{api_key[-10:]}")

        if webhook_url:
            print(f"   Webhook URL: ✅ {webhook_url}")
            if has_secret:
                print(f"   Webhook Secret: ✅ Configured")
            else:
                print(f"   Webhook Secret: ❌ Not set (unsigned)")
        else:
            print(f"   Webhook URL: ❌ Not configured")

        print(f"   Leads Captured: {lead_count}")
        if last_lead_date:
            print(f"   Last Lead: {last_lead_date}")

        # Check recent webhook deliveries
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM lead_webhook_deliveries
            WHERE company_id = %s
              AND created_at > NOW() - INTERVAL '24 hours'
        """, (bot_id,))

        delivery_row = cursor.fetchone()
        if delivery_row:
            total, successful, failed = delivery_row
            if total and total > 0:
                success_rate = (successful / total * 100) if total > 0 else 0
                print(f"   Webhooks (24h): {successful}✅ / {failed}❌ ({success_rate:.0f}% success)")
        print()

    # Summary check
    print("="*80)
    print("  CONFIGURATION CHECKLIST\n")

    # Check for at least one PRO/CUSTOM bot
    cursor.execute("""
        SELECT COUNT(*) FROM companies c
        JOIN users u ON c.user_id = u.id
        WHERE u.tier IN ('PRO', 'CUSTOM')
    """)
    pro_count = cursor.fetchone()[0]
    print(f"{'✅' if pro_count > 0 else '❌'} Pro/Custom bots: {pro_count}")

    # Check for configured webhooks
    cursor.execute("SELECT COUNT(*) FROM companies WHERE webhook_url IS NOT NULL AND webhook_url != ''")
    webhook_count = cursor.fetchone()[0]
    print(f"{'✅' if webhook_count > 0 else '❌'} Bots with webhook URL: {webhook_count}")

    # Check for recent leads
    cursor.execute("""
        SELECT COUNT(*) FROM lead_capture
        WHERE created_at > NOW() - INTERVAL '24 hours'
    """)
    recent_leads = cursor.fetchone()[0]
    print(f"{'✅' if recent_leads > 0 else '⚠️ '} Leads in last 24h: {recent_leads}")

    # Check webhook delivery success rate (last 24h)
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
        FROM lead_webhook_deliveries
        WHERE created_at > NOW() - INTERVAL '24 hours'
    """)
    total, successful = cursor.fetchone()
    if total and total > 0:
        success_rate = (successful / total * 100)
        status = "✅" if success_rate >= 80 else ("⚠️ " if success_rate >= 50 else "❌")
        print(f"{status} Webhook success rate (24h): {success_rate:.0f}% ({successful}/{total})")
    else:
        print(f"⚠️  Webhook deliveries (24h): None yet")

    print("\n" + "="*80 + "\n")

    conn.close()
    return True

if __name__ == "__main__":
    try:
        check_config()
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
