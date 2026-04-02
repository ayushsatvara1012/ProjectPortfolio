import os
import psycopg2
from dotenv import load_dotenv

def purge_database():
    """
    Safely and completely wipes the database clean for production launch.
    Uses TRUNCATE ... CASCADE on all core tables.
    """
    # 1. Load environment variables
    # Look for .env in current, parent, or backend directories
    env_paths = [
        '.env',
        '../.env',
        'sapybase_ai_engine/.env',
        '../sapybase_ai_engine/.env'
    ]
    
    loaded = False
    for path in env_paths:
        if os.path.exists(path):
            load_dotenv(path)
            loaded = True
            print(f"[*] Loaded environment from: {path}")
            break
            
    if not loaded:
        print("[!] Error: No .env file found. Please ensure DATABASE_URL is defined.")
        return

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[!] Error: DATABASE_URL not found in environment variables.")
        return

    # 2. Safety Gate
    print("-" * 50)
    print("🚨 WARNING: This script will PERMANENTLY ERASE ALL DATA.")
    print("Tables targeted: users, companies, usage_tracking, company_knowledge, admin_audit_log, processed_webhooks, allowed_domains")
    print("-" * 50)
    
    confirmation = input("To proceed, type 'PURGE PRODUCTION' (exactly as written): ").strip()
    
    if confirmation != "PURGE PRODUCTION":
        print("[x] Safety check failed. Exiting without changes.")
        return

    # 3. Connection and Execution
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # List of tables to wipe
        # CASCADE handles foreign key dependencies automatically
        # RESTART IDENTITY resets any SERIAL/IDENTITY primary key counters
        tables = [
            "users",
            "companies",
            "usage_tracking",
            "company_knowledge",
            "admin_audit_log",
            "processed_webhooks",
            "allowed_domains"
        ]
        
        truncate_query = f"TRUNCATE TABLE {', '.join(tables)} RESTART IDENTITY CASCADE;"
        
        print(f"[*] Executing truncation on {len(tables)} tables...")
        cur.execute(truncate_query)
        
        conn.commit()
        print("[+] SUCCESS: Database has been wiped clean.")
        print("-" * 50)
        print("💡 PRO-TIP FOR ADMIN:")
        print("1. Go to your live website/application.")
        print("2. Sign up with your Admin Email to auto-provision the new Super Admin account.")
        print("3. Your production webhooks are now ready to start with a pristine state.")
        print("-" * 50)
        
    except Exception as e:
        print(f"[!] Database Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    purge_database()
