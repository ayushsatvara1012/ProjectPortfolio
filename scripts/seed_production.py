import os
import hashlib
import psycopg2
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

def seed_production():
    """
    Seeds the database with the initial Admin user and company.
    Restores the existing API key to fix 401 Unauthorized errors on the frontend.
    """
    # 1. Load environment variables from the backend
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(current_dir)
    backend_env = os.path.join(root_dir, 'sapybase_ai_engine', '.env')
    
    if os.path.exists(backend_env):
        load_dotenv(backend_env)
        print(f"[*] Loaded environment from: {backend_env}")
    else:
        print(f"[!] Error: Backend .env not found at {backend_env}")
        return

    db_url = os.getenv("DATABASE_URL")
    admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("SUPER_ADMIN_EMAIL")
    
    # Hardcoded API Key from your .env
    api_key = "sb_EqAYDTVfGVzqegCE9sbVMOC0niRuEcDptvDJ_n_ISPQ"
    
    if not all([db_url, admin_email]):
        print("[!] Error: Missing required environment variables (DATABASE_URL, ADMIN_EMAIL)")
        return

    # 2. Connection and Seeding
    try:
        print("[*] Connecting to database...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # A. Create the Admin User
        print(f"[*] Seeding Admin User: {admin_email}")
        cur.execute("SELECT id FROM users WHERE clerk_id = %s", ('pending_admin',))
        user_row = cur.fetchone()
        
        if user_row:
            user_uuid = user_row[0]
            print(f"[*] Admin user already exists (ID: {user_uuid})")
            cur.execute(
                "UPDATE users SET email = %s, role = %s, tier = %s WHERE id = %s",
                (admin_email, 'SUPER_ADMIN', 'PRO', user_uuid)
            )
        else:
            cur.execute(
                """
                INSERT INTO users (clerk_id, email, role, tier, subscription_status)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                ('pending_admin', admin_email, 'SUPER_ADMIN', 'PRO', 'active')
            )
            user_uuid = cur.fetchone()[0]
        
        # B. Hash the API Key for storage
        hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
        
        # C. Create the SaPyBase Company
        print(f"[*] Seeding Company: SaPyBase (API Key Hashed: {hashed_key[:10]}...)")
        cur.execute("SELECT id FROM companies WHERE api_key = %s", (hashed_key,))
        company_row = cur.fetchone()
        
        if company_row:
            company_uuid = company_row[0]
            print(f"[*] Company already exists (ID: {company_uuid})")
            cur.execute(
                "UPDATE companies SET user_id = %s, company_name = %s WHERE id = %s",
                (user_uuid, "SaPyBase", company_uuid)
            )
        else:
            cur.execute(
                """
                INSERT INTO companies (
                    user_id, company_name, api_key, allowed_origin, 
                    bot_name, theme_color, initial_message, company_tone, status, system_prompt
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    user_uuid, 
                    "SaPyBase", 
                    hashed_key, 
                    "https://www.sapybase.com", 
                    "SapyBase Assistant", 
                    "#5730F5", 
                    "Hi! I am the SaPyBase AI Assistant. How can I help you today?", 
                    "Professional and helpful", 
                    "active",
                    "You are the official AI assistant for SaPyBase, the platform for custom website & web app development."
                )
            )
            company_uuid = cur.fetchone()[0]

        # D. Seed Initial Usage Tracking (Required by /api/chat check)
        print("[*] Seeding Usage Tracking period...")
        start_date = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = (start_date + timedelta(days=32)).replace(day=1) # Approximately start of next month
        
        cur.execute(
            """
            INSERT INTO usage_tracking (user_id, company_id, period_start, period_end, messages_used)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (user_uuid, company_uuid, start_date, end_date, 0)
        )
        
        # E. Seed Allowed Domains for security
        print("[*] Seeding Allowed Domains...")
        domains = ["sapybase.com", "www.sapybase.com", "localhost"]
        for domain in domains:
            cur.execute(
                "INSERT INTO allowed_domains (user_id, domain) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user_uuid, domain)
            )

        conn.commit()
        print("-" * 50)
        print("[+] SUCCESS: Production data seeded.")
        print(f"[*] API Key '{api_key}' is now ACTIVE.")
        print("[*] Admin email '{admin_email}' is now SUPER_ADMIN.")
        print("-" * 50)
        print("💡 NEXT STEPS:")
        print("1. Go to https://www.sapybase.com and refresh.")
        print("2. The 'Or.shouldRetry' and 401 errors should now be GONE.")
        print("3. Sign in to your admin account to finalize reconciliation.")
        print("-" * 50)
        
    except Exception as e:
        print(f"[!] Seeding Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    seed_production()
