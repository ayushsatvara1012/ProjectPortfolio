import psycopg2
import os
import json
from dotenv import load_dotenv

# Load database URL from .env
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")

def manual_sync(clerk_id, email, role='USER'):
    """
    Manually syncs your specific Clerk User ID to the SaPyBase database.
    Use this to bypass ngrok/webhooks for local testing.
    """
    if not DB_URL:
        print("❌ Error: NEON_DATABASE_URL not found in .env")
        return

    print(f"🔄 Syncing User: {clerk_id} as {role}...")

    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    try:
        # 1. Insert User
        cursor.execute(
            """
            INSERT INTO users (clerk_id, email, role, tier) 
            VALUES (%s, %s, %s, 'FREE')
            ON CONFLICT (clerk_id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email
            RETURNING id
            """,
            (clerk_id, email, role)
        )
        user_id = cursor.fetchone()[0]
        
        # 2. Initialize Usage Tracking
        from datetime import datetime, timedelta
        now = datetime.now()
        next_month = now + timedelta(days=30)
        
        cursor.execute(
            """
            INSERT INTO usage_tracking (user_id, period_start, period_end)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (user_id, now, next_month)
        )
        
        conn.commit()
        print(f"✅ SUCCESS: User {clerk_id} is now linked as {role} in your database!")
        print("💡 You can now go to the /dashboard page in your browser.")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error during manual sync: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    # FIND YOUR CLERK ID: Go to Clerk Dashboard > Users > Click your user 
    YOUR_CLERK_ID = "user_2g7np7Hrk0SN6kj5EDMLDaKNL0S" 
    YOUR_EMAIL = "john.doe@example.com"
    
    # Change 'USER' to 'ADMIN' to become a Super Admin!
    manual_sync(YOUR_CLERK_ID, YOUR_EMAIL, role='ADMIN')
