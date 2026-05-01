import os
import psycopg2
from dotenv import load_dotenv
import sys

# Load Environment Variables
# Using absolute path for consistency
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

DB_URL = os.getenv("DATABASE_URL")

def promote_user(id_or_email, role="SUPER_ADMIN"):
    if not DB_URL:
        print("Error: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Check if user exists by email or clerk_id
        cur.execute("SELECT clerk_id, email, role FROM users WHERE email = %s OR clerk_id = %s", (id_or_email, id_or_email))
        user = cur.fetchone()
        
        if not user:
            print(f"User '{id_or_email}' not found in database.")
            print("Make sure you have signed up in the app at least once!")
            return

        print(f"Current User: {user[1]} ({user[0]}) | Role: {user[2]}")
        
        # Update Role
        cur.execute("UPDATE users SET role = %s WHERE clerk_id = %s", (role, user[0]))
        conn.commit()
        
        print(f"SUCCESS: User '{user[1]}' has been promoted to '{role}'!")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to promote user: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 promote_admin.py <clerk_id_or_email> [role]")
        sys.exit(1)
    
    target = sys.argv[1]
    role = sys.argv[2] if len(sys.argv) > 2 else "SUPER_ADMIN"
    promote_user(target, role)
