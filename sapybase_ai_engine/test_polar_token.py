import os
import httpx
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("POLAR_ACCESS_TOKEN")

def test_token():
    print(f"Testing token: {TOKEN[:10]}...")
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Test getting organizations (simplest check for token validity)
    try:
        response = httpx.get("https://api.polar.sh/api/v1/organizations", headers=headers, follow_redirects=True)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Token is VALID")
            print(f"Orgs: {response.json()}")
        else:
            print(f"Token is INVALID or error: {response.text}")
    except Exception as e:
        print(f"Error connecting: {e}")

if __name__ == "__main__":
    test_token()
