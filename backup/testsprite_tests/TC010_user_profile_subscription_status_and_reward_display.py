import requests
import time

BASE_ENDPOINT = "http://localhost:5173"
API_SERVER = "http://localhost:3000"
HEADERS = {
    "Authorization": "Bearer test_api_key_for_TC010"
}
TIMEOUT = 30

def test_user_profile_subscription_status_and_reward_display():
    # Test flow:
    # 1. Register a new user
    # 2. Login user
    # 3. Link Minecraft account
    # 4. Link Ko-fi username / simulate subscription
    # 5. Trigger Ko-fi webhook to simulate payment verification & subscription activation
    # 6. Verify user profile endpoint on API server displays correct subscription status and rewards
    # 7. Query Minecraft mod endpoint on API server for subscription tier and manual rewards
    # 8. Verify frontend user profile on web server renders subscription statuses and rewarded items correctly
    # 9. Cleanup - delete created user and any test data
    
    user_data = {
        "username": "test_user_tc010",
        "email": "test_user_tc010@example.com",
        "password": "SecurePass123!"
    }
    minecraft_username = "TestMCUserTC010"
    kofi_username = "TestKofiUserTC010"
    created_user_id = None
    
    try:
        # 1. Register new user (API server auth endpoint)
        resp = requests.post(
            f"{API_SERVER}/auth/register",
            json=user_data,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201, f"User registration failed: {resp.text}"
        user = resp.json()
        created_user_id = user.get("id")
        assert created_user_id, "No user ID returned on registration"

        # 2. Login user to get auth token
        login_resp = requests.post(
            f"{API_SERVER}/auth/login",
            json={"username": user_data["username"], "password": user_data["password"]},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"User login failed: {login_resp.text}"
        login_data = login_resp.json()
        token = login_data.get("token")
        assert token, "No auth token returned on login"
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 3. Link Minecraft account (POST /auth/link-minecraft)
        link_minecraft_resp = requests.post(
            f"{API_SERVER}/auth/link-minecraft",
            json={"minecraftUsername": minecraft_username},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert link_minecraft_resp.status_code == 200, f"Minecraft linking failed: {link_minecraft_resp.text}"

        # 4. Link Ko-fi username (PUT /user/profile to update profile)
        profile_update_resp = requests.put(
            f"{API_SERVER}/user/profile",
            json={"kofiUsername": kofi_username},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert profile_update_resp.status_code == 200, f"Update profile with Ko-fi username failed: {profile_update_resp.text}"

        # 5. Simulate Ko-fi webhook payment event to activate subscription (POST /api/kofi-webhook)
        # Payload with kofiUsername, payment info, subscription tier
        webhook_payload = {
            "event": "payment_received",
            "data": {
                "kofiUsername": kofi_username,
                "tier": "Gold",
                "amount": 10.0,
                "currency": "USD",
                "paymentId": "test_payment_12345",
                "timestamp": int(time.time())
            }
        }
        webhook_resp = requests.post(
            f"{API_SERVER}/api/kofi-webhook",
            json=webhook_payload,
            headers={"Authorization": HEADERS["Authorization"]},
            timeout=TIMEOUT,
        )
        assert webhook_resp.status_code == 200, f"Ko-fi webhook processing failed: {webhook_resp.text}"

        # Allow some time for webhook processing and DB update
        time.sleep(2)

        # 6. Verify user profile subscription status and rewards on API server (GET /user/profile)
        profile_resp = requests.get(
            f"{API_SERVER}/user/profile",
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert profile_resp.status_code == 200, f"Failed to fetch user profile: {profile_resp.text}"
        profile_data = profile_resp.json()
        subscription = profile_data.get("subscription")
        rewards = profile_data.get("rewards")
        assert subscription, "Subscription status missing in profile"
        assert subscription.get("tier") == "Gold", f"Incorrect subscription tier: {subscription.get('tier')}"
        assert subscription.get("active") is True, "Subscription should be active"
        assert isinstance(rewards, list), "Rewards should be a list"
        assert any(r.get("type") == "tier_reward" for r in rewards), "No tier_reward found in rewards"

        # 7. Query Minecraft mod endpoints to verify subscription rewards and manual rewards (GET /api/kofi-rewards/{minecraftUsername})
        kofi_rewards_resp = requests.get(
            f"{API_SERVER}/api/kofi-rewards/{minecraft_username}",
            headers={"Authorization": HEADERS["Authorization"]},
            timeout=TIMEOUT,
        )
        assert kofi_rewards_resp.status_code == 200, f"Failed to get Minecraft rewards: {kofi_rewards_resp.text}"
        rewards_payload = kofi_rewards_resp.json()
        assert "subscriptionRewards" in rewards_payload, "subscriptionRewards missing in Minecraft rewards"
        assert any(r.get("tier") == "Gold" for r in rewards_payload["subscriptionRewards"]), "Gold tier subscription reward missing"
        assert "manualRewards" in rewards_payload, "manualRewards missing in Minecraft rewards"

        # 8. Verify frontend user profile page renders subscription and rewards correctly (GET user profile page)
        frontend_resp = requests.get(
            f"{BASE_ENDPOINT}/api/user/profile",
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        # Frontend endpoint should proxy or provide user profile showing subscription and rewards
        assert frontend_resp.status_code == 200, f"Frontend profile fetch failed: {frontend_resp.text}"
        frontend_profile = frontend_resp.json()
        assert "subscription" in frontend_profile, "No subscription info in frontend profile"
        assert frontend_profile["subscription"].get("tier") == "Gold", "Frontend subscription tier mismatch"
        assert "rewards" in frontend_profile and len(frontend_profile["rewards"]) > 0, "Frontend rewards missing or empty"

    finally:
        # Cleanup: delete created test user if exists
        if created_user_id:
            try:
                del_resp = requests.delete(
                    f"{API_SERVER}/admin/users/{created_user_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT,
                )
                # Accept 200 or 204 or 404 (already deleted)
                assert del_resp.status_code in (200, 204, 404), f"Failed to delete test user: {del_resp.text}"
            except Exception as e:
                print(f"Cleanup user delete error: {e}")

test_user_profile_subscription_status_and_reward_display()
