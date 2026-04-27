import os
import sys
import argparse
import psycopg2
import httpx
from dotenv import load_dotenv

# 1. Configuration & Constants
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BACKEND_DIR, 'Sapybase_ai_engine', '.env')

def load_environment():
    """Load the production/development environment variables."""
    if not os.path.exists(ENV_PATH):
        print(f"Error: .env file not found at {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)
    return {
        "DB_URL": os.getenv("DATABASE_URL"),
        "CLERK_SK": os.getenv("CLERK_SECRET_KEY"),
    }

def delete_from_clerk(clerk_id, secret_key):
    """Safely delete a user from the Clerk Dashboard."""
    url = f"https://api.clerk.com/v1/users/{clerk_id}"
    headers = {"Authorization": f"Bearer {secret_key}"}
    try:
        with httpx.Client() as client:
            resp = client.delete(url, headers=headers)
            if resp.status_code == 200:
                print(f"  [Clerk] Successfully deleted user {clerk_id}")
                return True
            else:
                print(f"  [Clerk] Warning: Failed to delete user {clerk_id} (Status: {resp.status_code})")
                return False
    except Exception as e:
        print(f"  [Clerk] Error deleting user {clerk_id}: {e}")
        return False

def cleanup(pattern, dry_run=True, delete_clerk=False):
    """Main cleanup logic with cascading support."""
    config = load_environment()
    db_url = config["DB_URL"]
    clerk_sk = config["CLERK_SK"]

    if not db_url:
        print("Error: DATABASE_URL not found in .env")
        sys.exit(1)

    print(f"--- Cleanup Tool Version 1.0 ---")
    print(f"Target Pattern: {pattern}")
    print(f"Mode: {'DRY RUN (Safety Mode)' if dry_run else 'DESTRUCTIVE (Live Deletion)'}")
    print(f"Sync: {'Clerk deletion enabled' if delete_clerk else 'Database only'}")
    print("-" * 30)

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # 1. Identify users to delete
        cur.execute("SELECT id, clerk_id, email FROM users WHERE email LIKE %s", (pattern,))
        users_to_delete = cur.fetchall()

        if not users_to_delete:
            print("No users found matching the specified pattern.")
            return

        print(f"Found {len(users_to_delete)} users matching '{pattern}':")
        user_ids = [u[0] for u in users_to_delete]
        clerk_ids = [u[1] for u in users_to_delete]

        for _, cid, email in users_to_delete:
            print(f" - {email} (Clerk ID: {cid})")

        # 2. Count/Identify dependencies
        # usage_tracking
        cur.execute("SELECT COUNT(*) FROM usage_tracking WHERE user_id = ANY(%s)", (user_ids,))
        usage_count = cur.fetchone()[0]

        # companies
        cur.execute("SELECT id FROM companies WHERE user_id = ANY(%s)", (user_ids,))
        company_rows = cur.fetchall()
        company_ids = [c[0] for c in company_rows]

        # allowed_domains
        cur.execute("SELECT COUNT(*) FROM allowed_domains WHERE user_id = ANY(%s)", (user_ids,))
        domains_count = cur.fetchone()[0]

        # company_knowledge
        knowledge_count = 0
        if company_ids:
            cur.execute("SELECT COUNT(*) FROM company_knowledge WHERE company_id = ANY(%s)", (company_ids,))
            knowledge_count = cur.fetchone()[0]

        print("-" * 30)
        print(f"Records to be removed across tables:")
        print(f" - Users: {len(users_to_delete)}")
        print(f" - Companies: {len(company_ids)}")
        print(f" - Knowledge Chunks: {knowledge_count}")
        print(f" - Usage Records: {usage_count}")
        print(f" - Allowed Domains: {domains_count}")
        print("-" * 30)

        if dry_run:
            print("DRY RUN COMPLETE. No data has been modified.")
            print("Use --confirm and provide a valid pattern to execute.")
            return

        # 3. ACTUAL DELETION - Start transaction
        print("Executing live deletion...")
        
        # a. usage_tracking
        cur.execute("DELETE FROM usage_tracking WHERE user_id = ANY(%s)", (user_ids,))
        
        # b. allowed_domains
        cur.execute("DELETE FROM allowed_domains WHERE user_id = ANY(%s)", (user_ids,))
        
        # c. company_knowledge
        if company_ids:
            cur.execute("DELETE FROM company_knowledge WHERE company_id = ANY(%s)", (company_ids,))
            
        # d. companies
        cur.execute("DELETE FROM companies WHERE user_id = ANY(%s)", (user_ids,))
        
        # e. users
        cur.execute("DELETE FROM users WHERE id = ANY(%s)", (user_ids,))

        # f. Clerk Deletion
        clerk_success = 0
        if delete_clerk and clerk_sk:
            print("Syncing with Clerk Dashboard...")
            for cid in clerk_ids:
                if delete_from_clerk(cid, clerk_sk):
                    clerk_success += 1

        conn.commit()
        print("-" * 30)
        print(f"SUCCESS: Successfully purged {len(users_to_delete)} test accounts.")
        if delete_clerk:
            print(f"Clerk Cleanup: {clerk_success}/{len(clerk_ids)} users removed from Clerk.")
        print("-" * 30)

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        print(f"CRITICAL ERROR during cleanup: {e}")
        sys.exit(1)
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean up test user data from Sapybase production/dev database.")
    parser.add_argument("--pattern", type=str, help="Email pattern to match (e.g. '%%@test.com')", required=True)
    parser.add_argument("--confirm", action="store_true", help="Run in live mode (destructive!)")
    parser.add_argument("--clerk", action="store_true", help="Also delete users from Clerk Dashboard")

    args = parser.parse_args()

    # Safety check: Prevent accidental wildcards that delete everything
    if args.pattern in ["%", "*", "@", "%%"]:
        print("Refusing to run with dangerous wildcard pattern. Please be more specific (e.g. '%%@test.com').")
        sys.exit(1)

    cleanup(args.pattern, dry_run=not args.confirm, delete_clerk=args.clerk)
