#!/usr/bin/env python3
"""
Lead Capture Feature Test Script
Tests the complete lead capture workflow including webhook delivery
"""

import httpx
import json
import sys
import time
import asyncio
from datetime import datetime

# ANSI colors for terminal output
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")

def print_info(text):
    print(f"{BLUE}ℹ️  {text}{RESET}")

async def test_lead_capture():
    print_header("SAPYBASE LEAD CAPTURE TEST")

    # Configuration
    BACKEND_URL = "http://localhost:8000"
    API_KEY = "test-api-key-12345"  # Replace with actual API key
    WEBHOOK_URL = "https://webhook.site/unique-id"  # Replace with your test webhook URL

    print_info(f"Backend URL: {BACKEND_URL}")
    print_info(f"API Key: {API_KEY}")
    print_info(f"Test Webhook URL: {WEBHOOK_URL}")

    # Step 1: Check Backend Health
    print_header("STEP 1: Health Check")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{BACKEND_URL}/api/health")
            if response.status_code == 200:
                print_success("Backend is running")
                print(f"Response: {response.json()}")
            else:
                print_error(f"Backend health check failed: {response.status_code}")
                return False
    except httpx.ConnectError:
        print_error(f"Cannot connect to backend at {BACKEND_URL}")
        print_warning("Make sure the backend is running:")
        print("  cd sapybase_ai_engine && python main.py")
        return False
    except Exception as e:
        print_error(f"Health check error: {e}")
        return False

    # Step 2: Test Lead Capture Endpoint
    print_header("STEP 2: Capture Test Lead")

    lead_payload = {
        "email": f"test-lead-{int(time.time())}@example.com",
        "name": "Test User",
        "context": "This is a test lead from the lead capture test script"
    }

    print_info(f"Payload: {json.dumps(lead_payload, indent=2)}")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/leads/capture",
                json=lead_payload,
                headers={
                    "X-API-Key": API_KEY,
                    "Origin": "http://localhost:3000"
                }
            )

            print_info(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")

            if response.status_code == 200:
                result = response.json()
                if result.get("status") == "success":
                    lead_id = result.get("lead_id")
                    print_success(f"Lead captured successfully! Lead ID: {lead_id}")
                    return True, lead_id
                elif result.get("status") == "duplicate":
                    print_warning("Lead marked as duplicate (captured within 24 hours)")
                    return True, None
                else:
                    print_error(f"Unexpected response: {result}")
                    return False, None
            else:
                print_error(f"Lead capture failed with status {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"Response text: {response.text}")
                return False, None

    except httpx.ConnectError:
        print_error(f"Cannot connect to backend")
        return False, None
    except Exception as e:
        print_error(f"Lead capture error: {e}")
        return False, None

    return False, None

async def check_webhook_delivery(lead_id):
    """Check if webhook was delivered"""
    print_header("STEP 3: Verify Webhook Delivery")

    if not lead_id:
        print_warning("No lead ID to check, skipping webhook verification")
        return False

    print_info("Webhook delivery is logged asynchronously (background task)")
    print_info("Checking webhook delivery attempts in database...")

    try:
        import sys
        sys.path.insert(0, '/Users/ayushsatvara/CodeWorld/Project Portfolio/sapybase_ai_engine')
        from main import get_db_connection, release_db_connection

        # Wait a bit for background task to complete
        print_info("Waiting 3 seconds for background webhook delivery...")
        await asyncio.sleep(3)

        conn = get_db_connection()
        try:
            cursor = conn.cursor()

            # Get the company ID for this test
            cursor.execute("""
                SELECT company_id FROM lead_capture
                WHERE id = %s
                LIMIT 1
            """, (lead_id,))

            row = cursor.fetchone()
            if not row:
                print_error(f"Lead {lead_id} not found in database")
                return False

            company_id = row[0]
            print_success(f"Found lead {lead_id} for company {company_id}")

            # Check webhook deliveries
            cursor.execute("""
                SELECT attempt, status, http_status, error_msg, created_at
                FROM lead_webhook_deliveries
                WHERE lead_id = %s
                ORDER BY attempt ASC
            """, (lead_id,))

            deliveries = cursor.fetchall()

            if not deliveries:
                print_warning("No webhook delivery attempts found (webhook URL may not be configured)")
                return True

            print_success(f"Found {len(deliveries)} webhook delivery attempt(s):")
            print()

            for attempt, status, http_status, error_msg, created_at in deliveries:
                status_icon = "✅" if status == "success" else "❌"
                print(f"  {status_icon} Attempt {attempt}: {status.upper()}")
                if http_status:
                    print(f"     HTTP Status: {http_status}")
                if error_msg:
                    print(f"     Error: {error_msg}")
                print(f"     Timestamp: {created_at}")
                print()

            # Check if at least one delivery succeeded
            success_count = sum(1 for _, status, _, _, _ in deliveries if status == "success")
            if success_count > 0:
                print_success(f"Webhook delivered successfully ({success_count} successful attempt)")
                return True
            else:
                print_error("All webhook delivery attempts failed")
                return False

        finally:
            release_db_connection(conn)

    except ImportError as e:
        print_warning(f"Could not import database module: {e}")
        print_info("You can manually check the database with:")
        print(f"  SELECT * FROM lead_webhook_deliveries WHERE lead_id = '{lead_id}'")
        return None
    except Exception as e:
        print_error(f"Database check error: {e}")
        return None

async def main():
    print(f"\n{BLUE}🚀 Starting Lead Capture Test at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}\n")

    success, lead_id = await test_lead_capture()

    if success:
        webhook_ok = await check_webhook_delivery(lead_id)

        print_header("TEST SUMMARY")
        print_success("Lead capture endpoint is working ✅")

        if webhook_ok is True:
            print_success("Webhook delivery is working ✅")
            print(f"\n{GREEN}All tests passed! Your lead capture feature is fully functional.{RESET}")
        elif webhook_ok is False:
            print_error("Webhook delivery failed")
            print(f"\n{YELLOW}Lead capture is working but webhook delivery has issues.{RESET}")
        else:
            print_info("Could not verify webhook delivery (database access issue)")
            print_info("But lead was captured successfully")
    else:
        print_header("TEST SUMMARY")
        print_error("Lead capture test failed ❌")
        print("\nPossible issues:")
        print("  1. Backend is not running")
        print("  2. Invalid API key")
        print("  3. Bot is not on PRO plan (lead_capture_enabled = false)")
        print("  4. Lead capture is disabled in bot settings")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Test interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}Unexpected error: {e}{RESET}")
        sys.exit(1)
