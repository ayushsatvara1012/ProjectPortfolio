import os
import psycopg2
from dotenv import load_dotenv

env_path = "/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine/.env"
load_dotenv(env_path)

DB_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, api_key, company_name FROM companies LIMIT 5")
    rows = cursor.fetchall()
    
    print("--- COMPANIES TABLE DUMP ---")
    for r in rows:
        print(f"Company ID: {r[0]}, User ID: {r[1]}, API Key Hash: {r[2]}, Name: {r[3]}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
