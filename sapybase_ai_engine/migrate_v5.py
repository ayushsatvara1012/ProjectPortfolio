import os
import psycopg2
from dotenv import load_dotenv

# 1. Load Environment Variables
# Using absolute path for consistency as per assistant's usual behavior
dotenv_path = '/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine/.env'
load_dotenv(dotenv_path)
DB_URL = os.getenv("NEON_DATABASE_URL")

def migrate_v5():
    """Adds subscription tiers and status to the users table."""
    print("Migrating Database to v5: Adding Subscription Tiers...")
    
    if not DB_URL:
        print("Error: NEON_DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Add columns if they don't exist
        cur.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Migration v5 successful!")
    except Exception as e:
        print(f"Migration v5 failed: {e}")

if __name__ == "__main__":
    migrate_v5()
