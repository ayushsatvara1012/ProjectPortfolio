import os
import psycopg2
from dotenv import load_dotenv

# Load Environment Variables
dotenv_path = '/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine/.env'
load_dotenv(dotenv_path)
DB_URL = os.getenv("NEON_DATABASE_URL")

def migrate_v6():
    """Adds trial expiration and company status tracking."""
    print("Migrating Database to v6: Adding Trial & Status tracking...")
    
    if not DB_URL:
        print("Error: NEON_DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Add trial_end_date to users
        cur.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP DEFAULT NULL;
        """)
        
        # Add status to companies
        cur.execute("""
            ALTER TABLE companies 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Migration v6 successful!")
    except Exception as e:
        print(f"Migration v6 failed: {e}")

if __name__ == "__main__":
    migrate_v6()
