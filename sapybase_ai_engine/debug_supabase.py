import os
import psycopg2
from dotenv import load_dotenv

# Use absolute path for consistency
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def debug():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env")
        return
        
    print(f"Connecting to: {DATABASE_URL[:15]}...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 1. Check Users
        print("\n--- Users in DB ---")
        cursor.execute("SELECT clerk_id, email, tier FROM users LIMIT 5")
        users = cursor.fetchall()
        for u in users:
            print(f"Clerk ID: {u[0]} | Email: {u[1]} | Tier: {u[2]}")
            
        # 2. Check Companies
        print("\n--- Companies in DB ---")
        cursor.execute("SELECT id, company_name, api_key, allowed_origin FROM companies")
        companies = cursor.fetchall()
        for c in companies:
            print(f"ID: {c[0]} | Name: {c[1]} | API Key: {c[2]} | Origin: {c[3]}")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"\n❌ Error connecting: {e}")

if __name__ == "__main__":
    debug()
