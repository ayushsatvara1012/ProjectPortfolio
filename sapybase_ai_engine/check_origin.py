import os
import psycopg2
from dotenv import load_dotenv

env_path = "/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine/.env"
load_dotenv(env_path)

DB_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT company_name, allowed_origin, domain FROM companies WHERE id = '3a216bf7-7cff-481f-8a9a-039809b76795'")
    row = cursor.fetchone()
    
    print(f"Company: {row[0]}, Allowed Origin: {row[1]}, Domain: {row[2]}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
