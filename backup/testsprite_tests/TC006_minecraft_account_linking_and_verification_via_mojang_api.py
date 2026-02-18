import requests
import time

BASE_URL = "http://localhost:5173"

# Helper function to create test user (register)
def create_test_user():
    url = f"{BASE_URL}/api/auth/register"
    user_data = {
        "username": f"testuser_{int(time.time())}",
        "email": f"testuser_{int(time.time())}@example.com",
        "password": "TestPassword123!"
    }
    resp = requests.post(url, json=user_data, timeout=30)
    resp.raise_for_status()
    if resp.content:
        try:
            return resp.json()  # Expect JSON includes user id, token, etc.
        except Exception as e:
            raise AssertionError(f"Invalid JSON response on user registration: {e}")
    else:
        raise AssertionError("Empty response content on user registration")

# Helper function to login user and get auth token
def login_test_user(username, password):
    url = f"{BASE_URL}/api/auth/login"
    credentials = {
        "username": username,
        "password": password
    }
    resp = requests.post(url, json=credentials, timeout=30)
    resp.raise_for_status()
    if resp.content:
        try:
            data = resp.json()
        except Exception as e:
            raise AssertionError(f"Invalid JSON response on user login: {e}")
        token = None
        if isinstance(data, dict):
            token = data.get("token") or data.get("accessToken")
            if token is None and isinstance(data, str):
                token = data
        if token is None:
            raise AssertionError("Auth token not found in login response")
        return token
    else:
        raise AssertionError("Empty response content on user login")

# Helper function to delete user by id (if API supports)
def delete_test_user(user_id, token):
    url = f"{BASE_URL}/api/data/users/{user_id}"
    headers = {"Authorization": token}
    requests.delete(url, headers=headers, timeout=30)

# Helper function to link Minecraft account
def link_minecraft_account(token, minecraft_username):
    url = f"{BASE_URL}/api/auth/minecraft/link"
    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }
    payload = {
        "minecraftUsername": minecraft_username
    }
    return requests.post(url, json=payload, headers=headers, timeout=30)

# Helper function to get linked Minecraft account status
def get_linked_account_status(token):
    url = f"{BASE_URL}/api/auth/minecraft/link/status"
    headers = {
        "Authorization": token
    }
    return requests.get(url, headers=headers, timeout=30)

# Helper function to verify Minecraft account via Mojang API (mock the Mojang response or use a known username)
def validate_minecraft_username_via_mojang(username):
    url = f"https://api.mojang.com/users/profiles/minecraft/{username}"
    resp = requests.get(url, timeout=30)
    return resp

def test_minecraft_account_linking_and_verification_via_mojang_api():
    # Step 1: Create a test user
    user = None
    token = None
    user_id = None
    try:
        # Register a new user
        reg_resp = create_test_user()
        user_id = reg_resp.get("id") or reg_resp.get("_id")
        username = reg_resp.get("username")
        password = "TestPassword123!"  # The password used in registration helper

        assert user_id is not None, "User ID not returned on registration"
        assert username is not None, "Username not returned on registration"

        # Login the user to get token
        login_resp = login_test_user(username, password)
        token = login_resp if isinstance(login_resp, str) else (login_resp.get("accessToken") or login_resp.get("token"))
        assert token is not None, "Auth token not returned on login"

        # Step 2: Validate Minecraft username via Mojang API
        # Use a well-known username for testing validity
        valid_minecraft_username = "Notch"
        mojang_resp = validate_minecraft_username_via_mojang(valid_minecraft_username)
        assert mojang_resp.status_code == 200, f"Mojang API did not validate the username '{valid_minecraft_username}'"

        # Step 3: Link Minecraft account via backend API with valid username
        link_resp = link_minecraft_account(token, valid_minecraft_username)
        assert link_resp.status_code == 200, f"Failed to link Minecraft account. Status code: {link_resp.status_code}"
        link_data = link_resp.json()
        assert "linked" in link_data and link_data["linked"] is True, "Minecraft account link response missing confirmation"

        # Step 4: Attempt linking with invalid Minecraft username (expect error)
        invalid_username = "ThisUserDoesNotExist12345"
        mojang_resp_invalid = validate_minecraft_username_via_mojang(invalid_username)
        # Mojang returns 204 No Content or 404 for invalid username
        assert mojang_resp_invalid.status_code in [204, 404], "Mojang API unexpectedly validated invalid username"

        link_resp_invalid = link_minecraft_account(token, invalid_username)
        # Backend should reject linking invalid MC username
        assert link_resp_invalid.status_code in [400, 422], "Linking accepted invalid Minecraft username"

        # Step 5: Retrieve linked account status from the API
        status_resp = get_linked_account_status(token)
        assert status_resp.status_code == 200, "Failed to get linked Minecraft account status"
        status_data = status_resp.json()
        assert status_data.get("minecraftUsername") == valid_minecraft_username, "Linked Minecraft username mismatch in status response"
        assert status_data.get("linked") is True, "Linked account status not true"

    finally:
        # Cleanup: Delete test user if user_id and token exist
        if user_id and token:
            try:
                delete_test_user(user_id, token)
            except Exception:
                pass

test_minecraft_account_linking_and_verification_via_mojang_api()
