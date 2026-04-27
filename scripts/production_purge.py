import os
import sys
import psycopg2
from dotenv import load_dotenv

def purge_database():
    """
    Safely and completely wipes the database clean for production launch.
    Uses TRUNCATE ... CASCADE on all core tables.
    """
    # 1. Load environment variables
    # Priority: Sapybase_ai_engine/.env (where the real DB_URL lives)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(current_dir)
    backend_env = os.path.join(root_dir, 'Sapybase_ai_engine', '.env')
    local_env = os.path.join(current_dir, '.env')
    root_env = os.path.join(root_dir, '.env')

    env_paths = [backend_env, local_env, root_env]
    
    loaded = False
    for path in env_paths:
        if os.path.exists(path):
            load_dotenv(path)
            loaded = True
            print(f"[*] Loaded environment from: {path}")
            break
            
    if not loaded:
        print("[!] Error: No .env file found with DATABASE_URL.")
        print("Expected location: Sapybase_ai_engine/.env")
        return

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[!] Error: DATABASE_URL not found in loaded environment.")
        return

    # 2. Safety Gate
    print("-" * 50)
    print("🚨 WARNING: This script will PERMANENTLY ERASE ALL DATA.")
    print("Tables targeted: users, companies, usage_tracking, company_knowledge, admin_audit_log, processed_webhooks, allowed_domains")
    print("-" * 50)
    
    try:
        confirmation = input("To proceed, type 'PURGE PRODUCTION' (exactly as written): ").strip()
    except EOFError:
        print("\n[x] Input interrupted. Exiting.")
        return
    
    if confirmation != "PURGE PRODUCTION":
        print("[x] Safety check failed. Exiting without changes.")
        return

    # 3. Connection and Execution
    try:
        print(f"[*] Connecting to database...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
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
        
    except psycopg2.Error as e:
        print(f"[!] Database Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    except Exception as e:
        print(f"[!] Unexpected Error: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    purge_database()
