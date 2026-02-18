import requests
import time

BASE_URL = "http://localhost:5173"
API_KEY = "test-admin-api-key"
TIMEOUT = 30

def test_kofi_webhook_processing_and_subscription_status_update():
    """
    Comprehensive test for Ko-fi webhook API including:
    1) Payment verification via webhook simulation
    2) Subscription status update on user profile
    3) Proper logging of webhook events
    4) Validation of user subscription status retrieval
    """

    # Helper to create a test user (simulate user registration)
    def create_test_user():
        payload = {
            "username": f"testuser_{int(time.time())}",
            "email": f"test_{int(time.time())}@example.com",
            "password": "TestPass123!"
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()  # Expected to include user id and token in response

    # Helper to link Ko-fi username to the user profile (simulate linking before webhook)
    def link_kofi_username(user_id, kofi_username, token):
        payload = {"kofiUsername": kofi_username}
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.put(f"{BASE_URL}/api/auth/users/{user_id}/link-kofi", json=payload, headers=headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()

    # Helper to get user profile to verify subscription status
    def get_user_profile(user_id, token):
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()

    # Helper to delete test user
    def delete_user(user_id, token):
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.delete(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, timeout=TIMEOUT)
        if r.status_code not in [200, 204]:
            raise Exception(f"Failed to delete user {user_id}, status code: {r.status_code}")

    # Step 1: Create a test user
    user = create_test_user()
    user_id = user.get("id")
    token = user.get("token")
    assert user_id, "User ID must be returned when creating a user."
    assert token, "Token must be returned when creating a user."

    # Link Ko-fi username for this user
    kofi_username = f"test_kofi_{int(time.time())}"
    link_response = link_kofi_username(user_id, kofi_username, token)
    assert link_response.get("kofiUsername") == kofi_username, "Ko-fi username linking failed."

    try:
        # Step 2: Simulate incoming Ko-fi payment webhook event
        # Webhook payload example (simulate a verified payment notification)
        webhook_payload = {
            "type": "Payment",
            "data": {
                "order_id": f"order_{int(time.time())}",
                "from_name": kofi_username,
                "amount": 5,
                "currency": "USD",
                "message": "Thank you!",
                "subscription": {
                    "tier_id": "tier_pro",
                    "tier_name": "Pro",
                    "is_active": True,
                    "start_date": int(time.time()),
                    "end_date": int(time.time()) + 30*24*3600
                },
                "verified": True
            }
        }
        webhook_headers = {
            "Authorization": API_KEY,
            "Content-Type": "application/json",
            "Kofi-Verification-Token": "test-verification-token"
        }
        webhook_response = requests.post(f"{BASE_URL}/api/kofi-webhook", json=webhook_payload, headers=webhook_headers, timeout=TIMEOUT)
        assert webhook_response.status_code == 200, f"Webhook POST failed with status {webhook_response.status_code}"
        webhook_resp_json = webhook_response.json()
        assert webhook_resp_json.get("status") == "success", "Webhook processing failed."

        # Step 3: Check that user subscription status updated
        profile_after_webhook = get_user_profile(user_id, token)
        subscription = profile_after_webhook.get("subscription")
        assert subscription, "Subscription info missing from user profile after webhook."
        assert subscription.get("isActive") is True, "Subscription status not updated to active."
        assert subscription.get("tierName") == "Pro", "Subscription tier name mismatch."

        # Step 4: Verify webhook event is logged
        # Assuming an endpoint exists to retrieve webhook logs for testing/debugging
        logs_response = requests.get(f"{BASE_URL}/api/kofi-webhook/logs", headers={"Authorization": API_KEY}, timeout=TIMEOUT)
        assert logs_response.status_code == 200, "Failed to fetch webhook logs."
        logs = logs_response.json()
        # Find if the order_id from webhook_payload is logged
        logged_event = next((log for log in logs if log.get("order_id") == webhook_payload["data"]["order_id"]), None)
        assert logged_event is not None, "Webhook event not found in logs."
        assert logged_event.get("processed") is True, "Webhook event not marked as processed."

    finally:
        # Clean up: delete the test user
        delete_user(user_id, token)

test_kofi_webhook_processing_and_subscription_status_update()
