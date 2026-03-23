import requests
import json
import time

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== SaPyBase API Automated Tests ===")
    
    # Wait a moment for server to start if running script immediately
    time.sleep(2)
    
    # 1. Register a Company
    print("\n1. Testing /api/register...")
    register_payload = {
        "company_name": "Automated Test Corp",
        "allowed_origin": "https://autotest.com",
        "theme_color": "#123456",
        "company_tone": "Friendly and helpful"
    }
    
    response = requests.post(f"{BASE_URL}/api/register", json=register_payload)
    if response.status_code != 200:
        print(f"FAILED (Register): {response.status_code} - {response.text}")
        return
        
    data = response.json()
    api_key = data.get("api_key")
    print(f"SUCCESS: Registered company and received API Key: {api_key}")
    
    headers_admin = {
        "x-api-key": api_key,
        "origin": "http://localhost:5173" # Bypasses check
    }
    
    headers_client = {
        "x-api-key": api_key,
        "origin": "https://autotest.com" # Authorized origin
    }
    
    headers_hacker = {
        "x-api-key": api_key,
        "origin": "https://evil.com" # Unauthorized origin
    }

    # 2. Test Get Config
    print("\n2. Testing /api/config with Admin Origin...")
    config_resp = requests.get(f"{BASE_URL}/api/config", headers=headers_admin)
    if config_resp.status_code == 200:
        print(f"SUCCESS: Retrieved config: {config_resp.json()['company_name']}")
    else:
        print(f"FAILED (Config): {config_resp.status_code} - {config_resp.text}")

    # 3. Train Website
    print("\n3. Testing /api/train...")
    train_payload = {
        "url": "https://example.com" 
    }
    print(f"Training on {train_payload['url']} (this will take a few seconds)...")
    train_resp = requests.post(f"{BASE_URL}/api/train", json=train_payload, headers=headers_admin)
    if train_resp.status_code == 200:
        print(f"SUCCESS: Training complete. Extracted knowledge.")
    else:
        print(f"FAILED (Train): {train_resp.status_code} - {train_resp.text}")

    # 4. Chat with Admin Origin
    print("\n4. Testing /api/chat with Admin Origin...")
    chat_payload = {"message": "What domain are you based on in this example?"}
    chat_resp = requests.post(f"{BASE_URL}/api/chat", json=chat_payload, headers=headers_admin)
    if chat_resp.status_code == 200:
        print(f"SUCCESS: Admin Chat Reply: {chat_resp.json().get('reply')[:100]}...")
    else:
        print(f"FAILED (Admin Chat): {chat_resp.status_code} - {chat_resp.text}")
        
    # 5. Chat with Authorized Origin
    print("\n5. Testing /api/chat with Authorized Client Origin...")
    chat_resp2 = requests.post(f"{BASE_URL}/api/chat", json=chat_payload, headers=headers_client)
    if chat_resp2.status_code == 200:
        print(f"SUCCESS: Client Chat Reply: {chat_resp2.json().get('reply')[:100]}...")
    else:
        print(f"FAILED (Client Chat): {chat_resp2.status_code} - {chat_resp2.text}")
        
    # 6. Chat with Unauthorized Origin (Should Fail)
    print("\n6. Testing /api/chat with Unauthorized Hacker Origin (Expecting 403)...")
    chat_resp3 = requests.post(f"{BASE_URL}/api/chat", json=chat_payload, headers=headers_hacker)
    if chat_resp3.status_code == 403:
        print(f"SUCCESS: Blocked Hacker Origin correctly: {chat_resp3.json()}")
    else:
        print(f"FAILED (Hacker Chat - Should have blocked!): {chat_resp3.status_code} - {chat_resp3.text}")

if __name__ == "__main__":
    run_tests()
