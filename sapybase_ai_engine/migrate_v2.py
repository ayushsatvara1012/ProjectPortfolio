import os
import psycopg2
from dotenv import load_dotenv

# Load database URL from search path
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")

def migrate():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    try:
        print("Adding new columns to 'companies' table...")
        
        # 1. Add columns
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS bot_name VARCHAR(255);")
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;")
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS initial_message TEXT;")
        cursor.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS quick_questions JSONB;")
        
        # 2. Update existing test company with default data
        # Assuming we have at least one company with the test API key
        test_api_key = "sb_test_987654321"
        
        default_questions = [
            {"label": "🚀 Custom Web App", "prompt": "Can you build a custom web app for my business?", "emoji": "🚀"},
            {"label": "📈 SEO Optimization", "prompt": "Do you offer SEO and GEO optimization services?", "emoji": "📈"},
            {"label": "🤖 AI Integration", "prompt": "How can AI solutions improve my workflow?", "emoji": "🤖"}
        ]
        
        import json
        
        cursor.execute("""
            UPDATE companies 
            SET bot_name = 'SapyBase Assistant',
                logo_url = '/SB_loading_clean.svg',
                initial_message = 'Hi! I am the SaPyBase AI Assistant. How can I help you today?',
                quick_questions = %s
            WHERE api_key = %s OR company_name = 'SaPyBase'
        """, (json.dumps(default_questions), test_api_key))

        conn.commit()
        print("Migration v2 successful!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
