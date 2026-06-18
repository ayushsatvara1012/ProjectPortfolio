#!/usr/bin/env python3
"""
seed_mock_data.py — Seed mock data for testuser@sapybase.com
============================================================
Sets the user role to SUPER_ADMIN, tier to PRO, and populates
mock leads, chat logs, and reports for dashboard evaluation.
"""

import os
import sys
import uuid
import random
import json
import psycopg2
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load Environment Variables from .env.local
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
dotenv_path = os.path.join(script_dir, "..", ".env.local")

if not os.path.exists(dotenv_path):
    # Try project root
    dotenv_path = os.path.join(project_root, ".env.local")

print(f"Loading env from: {dotenv_path}")
load_dotenv(dotenv_path)

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("❌ Error: DATABASE_URL not found in env.")
    sys.exit(1)

def seed_data():
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()
        print("✅ Database connection established.")

        # 1. Ensure testuser@sapybase.com exists and is upgraded
        email = "testuser@sapybase.com"
        clerk_id = "user_testuser123"

        cursor.execute("SELECT id, role, tier FROM users WHERE email = %s", (email,))
        user_row = cursor.fetchone()

        if user_row:
            user_id = user_row[0]
            cursor.execute(
                "UPDATE users SET role = 'SUPER_ADMIN', tier = 'PRO', subscription_status = 'active' WHERE id = %s",
                (user_id,)
            )
            print(f"✅ Upgraded existing user '{email}' to SUPER_ADMIN/PRO.")
        else:
            cursor.execute(
                """INSERT INTO users (clerk_id, email, role, tier, subscription_status)
                   VALUES (%s, %s, 'SUPER_ADMIN', 'PRO', 'active')
                   RETURNING id""",
                (clerk_id, email)
            )
            user_id = cursor.fetchone()[0]
            print(f"✅ Created and upgraded user '{email}' to SUPER_ADMIN/PRO.")

        # 2. Ensure a company exists for this user
        cursor.execute("SELECT id FROM companies WHERE user_id = %s LIMIT 1", (user_id,))
        company_row = cursor.fetchone()

        if company_row:
            company_id = company_row[0]
            print(f"✅ Found existing company (ID={company_id}) for user.")
        else:
            cursor.execute(
                """INSERT INTO companies
                   (user_id, company_name, bot_name, api_key, allowed_origin, theme_color, company_tone, initial_message)
                   VALUES (%s, 'Sapybase Corp', 'Vaayu Bot', 'sb_mock_api_key_testuser_123', '*', '#5730F5', 'Professional and helpful', 'Hi! How can I help you today?')
                   RETURNING id""",
                (user_id,)
            )
            company_id = cursor.fetchone()[0]
            print(f"✅ Created company '{company_id}' for user.")

        # 3. Seed ROI Benchmarks
        cursor.execute(
            """INSERT INTO roi_benchmarks (company_id, avg_human_cost_per_ticket, avg_lead_value, updated_at)
               VALUES (%s, 12.50, 75.00, NOW())
               ON CONFLICT (company_id) DO UPDATE
               SET avg_human_cost_per_ticket = EXCLUDED.avg_human_cost_per_ticket,
                   avg_lead_value = EXCLUDED.avg_lead_value,
                   updated_at = NOW()""",
            (company_id,)
        )
        print("✅ Seeded ROI benchmarks.")

        # 4. Seed Usage Tracking
        cursor.execute(
            """INSERT INTO usage_tracking (user_id, company_id, period_start, period_end)
               VALUES (%s, %s, NOW() - interval '15 days', NOW() + interval '15 days')
               ON CONFLICT DO NOTHING""",
            (user_id, company_id)
        )
        print("✅ Seeded usage tracking.")

        # 5. Seed Leads (lead_capture table)
        # Clear existing leads for a clean state
        cursor.execute("DELETE FROM lead_capture WHERE company_id = %s", (company_id,))
        print("🔄 Cleared old mock leads.")

        leads_data = [
            ("jane.smith@gmail.com", "Jane Smith", "Inquired about high-volume enterprise pricing and SLA agreements; clicked meeting booker link.", 94, "HOT", "Inquired about enterprise pricing; requested SLA contracts; clicked meeting booker.", "won", 1500.00, 2),
            ("jmiller@yahoo.com", "John Miller", "Asked about 14-day trial extensions and visited the pricing page twice.", 65, "WARM", "Asked about trial extensions; visited pricing page twice.", "contacted", None, 5),
            ("sarah@cyberdyne.co", "Sarah Connor", "Requested immediate sales callback regarding SOC2 compliance auditing.", 88, "HOT", "SOC2 compliance inquiry; requested immediate sales callback.", "won", 950.00, 3),
            ("bruce@waynecorp.com", "Bruce Wayne", "Asked brief question about database security.", 20, "COLD", "Brief query; inactive since.", "lost", None, 14),
            ("robert@techinnovators.io", "Robert Chen", "Inquired about Salesforce CRM integration and custom webhook payloads.", 91, "HOT", "CRM integration query; high sales intent detected.", "new", None, 1),
            ("elena.p@cloudsolutions.net", "Elena Petrova", "Asked about multitenant hosting models and self-hosting options.", 75, "WARM", "Multitenancy inquiry; asked about self-hosting.", "new", None, 4),
            ("dkim@nexus.org", "David Kim", "General product capability question.", 15, "COLD", "General question.", "new", None, 8),
            ("michael@dundermifflin.com", "Michael Scott", "Asked about white-label branding options and logo customize restrictions.", 87, "HOT", "Inquired about white-labeling; finalized subscription.", "won", 350.00, 10),
            ("dwight@dundermifflin.com", "Dwight Schrute", "Asked about server uptime SLA and hosting location latency.", 58, "WARM", "Uptime and latency query.", "contacted", None, 6),
            ("pam@dundermifflin.com", "Pam Beesly", "Demo call request, later cancelled.", 40, "COLD", "Demo request cancelled.", "lost", None, 12),
            ("jim@dundermifflin.com", "Jim Halpert", "Requested contract quote for 10 user seats.", 89, "HOT", "Requested contract quote for 10 seats.", "won", 750.00, 7),
            ("angela@dundermifflin.com", "Angela Martin", "Asked about accounting security controls and credit card handling.", 62, "WARM", "Security controls query.", "new", None, 9)
        ]

        now = datetime.now(timezone.utc)
        for email, name, context, score, band, reasons, status, val, days_ago in leads_data:
            lead_id = str(uuid.uuid4())
            created_at = now - timedelta(days=days_ago)
            updated_at = created_at + timedelta(hours=2) if status != "new" else None
            cursor.execute(
                """INSERT INTO lead_capture (id, company_id, email, name, context, score, score_band, score_reasons, status, value_usd, created_at, status_updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (lead_id, company_id, email, name, context, score, band, reasons, status, val, created_at, updated_at)
            )
        print(f"✅ Seeded {len(leads_data)} mock leads.")

        # 6. Seed Chat Logs (chat_logs table)
        # Clear existing logs
        cursor.execute("DELETE FROM chat_logs WHERE company_id = %s", (company_id,))
        print("🔄 Cleared old chat logs.")

        queries = [
            ("Do you have a free trial?", "Yes, we offer a 14-day free trial on all plans. No credit card required.", False, 0.90),
            ("What is your pricing?", "Our plans start at $19/month for Starter, $49/month for Pro, and $99/month for Business.", False, 0.95),
            ("How do I install the widget?", "Simply copy the script block from your dashboard settings and paste it into the HTML of your website.", False, 0.98),
            ("Can I pay with crypto?", "I'm sorry, currently we only support standard credit cards and subscription billing through Stripe.", True, 0.00),
            ("How do I import my database?", "I'm not sure how to answer that. Let me look up options or connect you to support.", True, 0.00),
            ("Does Vaayu support Slack?", "Currently, Slack handoff requires our Business plan or custom setup.", True, 0.00),
            ("Can I customize the chatbot logo?", "Yes! Custom branding and logo options are available on the Pro and Business plans.", False, 0.98),
            ("Is there an API?", "Yes, our Developer API and webhook integrations are available on the Pro/Business tiers.", False, 0.96),
            ("Is my data secure?", "Yes, we isolate each tenant's company database and encrypt all logs in transit and at rest.", False, 0.94),
            ("How does human handoff work?", "When the bot fails to answer or confidence drops, it notifies you and redirects the user.", False, 0.92)
        ]

        # Generate chat logs for the past 30 days
        log_count = 0
        for d in range(30):
            day = now - timedelta(days=d)
            # Random number of queries per day (between 1 and 6)
            daily_logs = random.randint(1, 6)
            session_id = str(uuid.uuid4())
            for _ in range(daily_logs):
                q_text, ans_text, is_unanswered, conf = random.choice(queries)
                created_at = day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                
                # Make sure the session ID changes sometimes
                if random.random() > 0.7:
                    session_id = str(uuid.uuid4())

                cursor.execute(
                    """INSERT INTO chat_logs (company_id, user_query, bot_response, was_cache_hit, is_unanswered, session_id, confidence, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (company_id, q_text, ans_text, False, is_unanswered, session_id, conf, created_at)
                )
                log_count += 1

        print(f"✅ Seeded {log_count} chat logs across the last 30 days.")

        # 7. Seed Insight Report (insight_reports table)
        cursor.execute("DELETE FROM insight_reports WHERE company_id = %s", (company_id,))
        report_json = {
            "top_trends": [
                "Pricing & Billing questions (Starter vs Pro features)",
                "Database integration requirements (Supabase & local Postgres DSNs)",
                "White-label branding and custom logo capabilities",
                "Slack alerts for hot leads & manual sales handoff",
                "General bot security and query isolation compliance"
            ],
            "high_value_gaps": [
                "Can I pay with crypto?",
                "How do I import my database?",
                "Does Vaayu support Slack?"
            ],
            "actionable_advice": "Upload a PDF document detailing database import/migration steps and billing options. 35% of customer queries this week were about those missing topics, triggering unanswered status.",
            "roi_metrics": {
                "support_savings": "$345.50",
                "potential_revenue": "$2,250.00"
            }
        }

        cursor.execute(
            "INSERT INTO insight_reports (company_id, report_json, created_at) VALUES (%s, %s, NOW())",
            (company_id, json.dumps(report_json))
        )
        print("✅ Seeded insight report.")

        conn.commit()
        cursor.close()
        conn.close()
        print("\n🎉 SUCCESS: All mock data has been successfully seeded!")
        print(f"💡 You can now log into clerk using testuser@sapybase.com and open http://localhost:3000/dashboard/insights to view the live analytics dashboard!")
        
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        sys.exit(1)

if __name__ == "__main__":
    seed_data()
