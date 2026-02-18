import requests
import uuid
import time

BASE_URL = "http://localhost:3000"
API_KEY = "test_api_key_minecraft_mod"  # Use a test API key or environment variable
TIMEOUT = 30
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json"
}

def create_test_user():
    # Register a new user to link Minecraft account and test mod rewards flow
    user_payload = {
        "username": f"testuser_{uuid.uuid4().hex[:8]}",
        "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
        "password": "TestPassword123!"
    }
    response = requests.post(f"{BASE_URL}/api/auth/register", json=user_payload, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    assert "id" in data, "User registration response missing user id"
    return data

def login_user(username, password):
    login_payload = {
        "username": username,
        "password": password
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    token = data.get("token")
    assert token is not None, "Login token missing"
    return token

def link_minecraft_account(auth_token, minecraft_username):
    # Link Minecraft username to user profile to synchronize rewards
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "minecraftUsername": minecraft_username
    }
    response = requests.post(f"{BASE_URL}/api/user/minecraft/link", json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    assert data.get("linked") is True, "Minecraft account linking failed"
    return data

def simulate_subscription_and_manual_rewards_setup(auth_token, user_id):
    # Admin-like function: create subscription tiers and manual rewards, assign to user
    # For test purposes, if endpoints exist for admin CRUD, create a tier and a manual reward
    headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    # Create subscription tier
    tier_payload = {
        "name": "Test Tier",
        "description": "Test subscription tier for rewards",
        "price": 5.0,
        "rewards": [
            {"item": "Diamond Sword", "quantity": 1},
            {"item": "Golden Apple", "quantity": 5}
        ]
    }
    tier_resp = requests.post(f"{BASE_URL}/api/kofi-rewards/tiers", json=tier_payload, headers=headers, timeout=TIMEOUT)
    tier_resp.raise_for_status()
    tier_data = tier_resp.json()
    tier_id = tier_data.get("id")
    assert tier_id is not None

    # Assign subscription tier to user through webhook simulating payment (if needed)
    webhook_payload = {
        "event": "subscription_created",
        "userId": user_id,
        "tierId": tier_id,
        "subscriptionStatus": "active",
        "timestamp": int(time.time())
    }
    webhook_resp = requests.post(f"{BASE_URL}/api/kofi-webhook", json=webhook_payload, headers=headers, timeout=TIMEOUT)
    webhook_resp.raise_for_status()

    # Create manual reward
    manual_reward_payload = {
        "userId": user_id,
        "reward": {"item": "Emerald", "quantity": 10},
        "reason": "Test manual reward grant"
    }
    manual_rewards_resp = requests.post(f"{BASE_URL}/api/kofi-rewards/manual", json=manual_reward_payload, headers=headers, timeout=TIMEOUT)
    manual_rewards_resp.raise_for_status()
    manual_reward_data = manual_rewards_resp.json()
    manual_reward_id = manual_reward_data.get("id")
    assert manual_reward_id is not None

    return tier_id, manual_reward_id

def get_mod_subscription_rewards(minecraft_username):
    # Minecraft mod calls this endpoint on player login to get subscription tier rewards
    params = {"username": minecraft_username}
    resp = requests.get(f"{BASE_URL}/api/minecraft/mod/subscription-rewards", headers=HEADERS, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def get_mod_manual_rewards(minecraft_username):
    # Minecraft mod calls this endpoint to get manual rewards for player
    params = {"username": minecraft_username}
    resp = requests.get(f"{BASE_URL}/api/minecraft/mod/manual-rewards", headers=HEADERS, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def grant_mod_rewards(minecraft_username, rewards_type, reward_ids):
    # Minecraft mod notifies API that rewards were granted, which updates status accordingly
    payload = {
        "username": minecraft_username,
        "rewardsType": rewards_type,  # "subscription" or "manual"
        "rewardIds": reward_ids
    }
    resp = requests.post(f"{BASE_URL}/api/minecraft/mod/grant-rewards", headers=HEADERS, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def delete_manual_reward(auth_token, manual_reward_id):
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.delete(f"{BASE_URL}/api/kofi-rewards/manual/{manual_reward_id}", headers=headers, timeout=TIMEOUT)
    if resp.status_code not in [200, 204]:
        print(f"Warning: Failed to delete manual reward {manual_reward_id}")

def delete_subscription_tier(auth_token, tier_id):
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.delete(f"{BASE_URL}/api/kofi-rewards/tiers/{tier_id}", headers=headers, timeout=TIMEOUT)
    if resp.status_code not in [200, 204]:
        print(f"Warning: Failed to delete subscription tier {tier_id}")

def test_minecraft_mod_subscription_reward_retrieval_and_granting():
    # Full end-to-end test of mod integration for subscription and manual rewards
    # 1) Register and login test user
    user_info = create_test_user()
    username = user_info["username"]
    password = "TestPassword123!"
    user_id = user_info["id"]
    auth_token = login_user(username, password)

    # 2) Link Minecraft account
    minecraft_username = f"minecraftUser_{uuid.uuid4().hex[:6]}"
    link_response = link_minecraft_account(auth_token, minecraft_username)

    # 3) Setup subscription tier and manual reward for user
    tier_id, manual_reward_id = simulate_subscription_and_manual_rewards_setup(auth_token, user_id)

    try:
        # 4) Retrieve subscription tier rewards via mod endpoint
        sub_rewards = get_mod_subscription_rewards(minecraft_username)
        assert "rewards" in sub_rewards, "Subscription rewards missing in response"
        assert isinstance(sub_rewards["rewards"], list), "Subscription rewards should be a list"
        assert any(r.get("item") == "Diamond Sword" for r in sub_rewards["rewards"]), "Expected reward item missing"

        # 5) Retrieve manual rewards via mod endpoint
        manual_rewards = get_mod_manual_rewards(minecraft_username)
        assert "rewards" in manual_rewards, "Manual rewards missing in response"
        assert isinstance(manual_rewards["rewards"], list), "Manual rewards should be a list"
        assert any(r.get("item") == "Emerald" for r in manual_rewards["rewards"]), "Expected manual reward item missing"

        # 6) Grant subscription rewards - simulate mod notifying API that rewards were delivered
        sub_reward_ids = [r.get("id") for r in sub_rewards["rewards"] if r.get("id")]
        grant_sub_resp = grant_mod_rewards(minecraft_username, "subscription", sub_reward_ids)
        assert grant_sub_resp.get("success") is True, "Granting subscription rewards failed"

        # 7) Grant manual rewards similarly
        manual_reward_ids = [r.get("id") for r in manual_rewards["rewards"] if r.get("id")]
        grant_manual_resp = grant_mod_rewards(minecraft_username, "manual", manual_reward_ids)
        assert grant_manual_resp.get("success") is True, "Granting manual rewards failed"

        # 8) Validate manual rewards are marked granted by fetching manual rewards again - expect none or empty list
        manual_rewards_after = get_mod_manual_rewards(minecraft_username)
        assert all(r.get("granted", False) for r in manual_rewards_after.get("rewards", [])), "Not all manual rewards marked granted"

    finally:
        # Cleanup: delete manual reward and subscription tier
        delete_manual_reward(auth_token, manual_reward_id)
        delete_subscription_tier(auth_token, tier_id)

test_minecraft_mod_subscription_reward_retrieval_and_granting()
