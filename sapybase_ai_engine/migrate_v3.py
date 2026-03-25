import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")

def migrate():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    try:
        print("Creating SaaS relational tables...")
        
        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clerk_id VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL,
            tier VARCHAR(20) NOT NULL DEFAULT 'FREE',
            polar_customer_id VARCHAR(255),
            billing_period_end TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Add user_id to companies (renaming to api_keys concept eventually)
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);")
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT FALSE;")

        # 3. Allowed Domains Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS allowed_domains (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            domain VARCHAR(255) NOT NULL
        );
        """)

        # 4. Usage Tracking Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usage_tracking (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            messages_used INTEGER NOT NULL DEFAULT 0,
            sources_used INTEGER NOT NULL DEFAULT 0,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL
        );
        """)

        conn.commit()
        print("Migration v3 successful!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
