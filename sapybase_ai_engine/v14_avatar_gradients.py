import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    try:
        print("Adding avatar_bg_style column to companies table...")
        cursor.execute("""
            ALTER TABLE companies 
            ADD COLUMN IF NOT EXISTS avatar_bg_style VARCHAR(50);
        """)
        
        # Backfill NULL to 'none' if required, or let it be handled by coalesce in python code
        cursor.execute("""
            UPDATE companies
            SET avatar_bg_style = 'none'
            WHERE avatar_bg_style IS NULL;
        """)

        conn.commit()
        print("Migration successful: added avatar_bg_style to companies.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
