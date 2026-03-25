import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")

def migrate():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    try:
        print("Adding role-based access control (RBAC)...")
        
        # 1. Add role column to users
        # Values: 'USER', 'ADMIN'
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'USER';")
        
        # 2. Add description/note to companies (for admin view)
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_notes TEXT;")

        conn.commit()
        print("Migration v4 successful!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
