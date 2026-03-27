import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def check_db():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT clerk_id, email, tier, polar_customer_id FROM users")
        rows = cursor.fetchall()
        print("Users in DB:")
        for row in rows:
            print(f"Clerk ID: {row[0]}, Email: {row[1]}, Tier: {row[2]}, Polar Cust ID: {row[3]}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    check_db()
