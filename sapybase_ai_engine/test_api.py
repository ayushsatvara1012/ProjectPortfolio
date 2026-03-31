import os
import psycopg2
from datetime import datetime

# Connection details from .env
DB_URL = "postgresql://postgres.tticllabbbqwnhsmggfo:sapybase%401012ayush@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"

def main():
    conn = psycopg2.connect(DB_URL)
    try:
        cursor = conn.cursor()
        
        # We will use the user ID for Ayush found in the DB
        user_id = '89f31edb-a16f-4091-ba2d-670a5053f99e'
        
        cursor.execute(
            """SELECT c.id, c.company_name, c.allowed_origin, c.bot_name, c.theme_color,
                      c.logo_url, c.initial_message, c.display_order, c.is_active,
                      c.created_at,
                      COALESCE(ut.messages_used, 0) as messages_used,
                      COALESCE(ut.period_end, now() + interval '30 days') as period_end
               FROM companies c
               LEFT JOIN usage_tracking ut ON ut.company_id = c.id
               WHERE c.user_id = %s AND c.is_active = true
               ORDER BY c.display_order ASC""",
            (user_id,)
        )
        
        rows = cursor.fetchall()
        print(f"Number of rows fetched: {len(rows)}")
        for r in rows:
            print(f"Bot name: {r[3]}, Created at: {r[9].isoformat() if r[9] else None}, Messages used: {r[10]}, Period end: {r[11].isoformat() if r[11] else None}")
            
    except Exception as e:
        print(f"Error executing query: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
