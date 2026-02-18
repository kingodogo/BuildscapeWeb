import requests
import uuid

BASE_URL = "http://localhost:3000"
API_KEY = "Authorization"  # From credentials in instruction, actual key should be set here

HEADERS = {
    "Authorization": "",  # to be filled with actual API key token after registration/login
    "Content-Type": "application/json"
}

TIMEOUT = 30

def test_user_authentication_and_role_based_access_control():
    # Helper functions
    def register_user(email, password, role=None):
        payload = {
            "email": email,
            "password": password
        }
        # Remove role from registration payload as it's not accepted during registration
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Registration failed: {resp.text}"
        data = resp.json()
        assert "id" in data and data["email"] == email, "Invalid registration response"
        return data

    def login_user(email, password):
        payload = {"email": email, "password": password}
        resp = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "token" in data, "Login response missing token"
        return data["token"]

    def get_profile(token):
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/auth/profile", headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Get profile failed: {resp.text}"
        data = resp.json()
        assert "email" in data, "Profile response missing email"
        return data

    def update_profile(token, update_data):
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.put(f"{BASE_URL}/auth/profile", json=update_data, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Update profile failed: {resp.text}"
        data = resp.json()
        for key in update_data:
            assert data.get(key) == update_data[key], f"Profile update mismatch for {key}"
        return data

    def access_restricted_endpoint(token, endpoint="/admin/secure-data"):
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=TIMEOUT)
        return resp

    # Generate unique emails for test users
    user_email = f"user_{uuid.uuid4().hex[:8]}@test.com"
    admin_email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
    password = "TestPass123!"

    # Register normal user (role omitted)
    user = register_user(user_email, password)

    # Register admin user (role omitted)
    admin = register_user(admin_email, password)

    # Login users
    user_token = login_user(user_email, password)
    admin_token = login_user(admin_email, password)

    # Validate tokens are different and present
    assert user_token != admin_token, "Tokens for different users should differ"
    assert user_token and admin_token, "Tokens must not be empty"

    # Get profile and validate role and email for user
    user_profile = get_profile(user_token)
    assert user_profile.get("email") == user_email, "User profile email mismatch"
    # Role may or may not be exposed; if role is in profile:
    if "role" in user_profile:
        assert user_profile["role"] == "user", "User role mismatch in profile"

    # Get profile and validate role and email for admin
    admin_profile = get_profile(admin_token)
    assert admin_profile.get("email") == admin_email, "Admin profile email mismatch"
    if "role" in admin_profile:
        assert admin_profile["role"] == "admin", "Admin role mismatch in profile"

    # Update user profile fields
    updated_fields = {"displayName": "New UserName", "bio": "Testing bio update"}
    updated_user_profile = update_profile(user_token, updated_fields)
    for k, v in updated_fields.items():
        assert updated_user_profile.get(k) == v, f"Profile field {k} not updated correctly"

    # Role-based access control tests
    # 1) User trying to access admin-only endpoint
    user_resp = access_restricted_endpoint(user_token, "/admin/secure-data")
    assert user_resp.status_code in (401, 403), f"User should not access admin endpoint, got {user_resp.status_code}"

    # 2) Admin access to admin endpoint
    admin_resp = access_restricted_endpoint(admin_token, "/admin/secure-data")
    assert admin_resp.status_code == 200, "Admin should have access to admin endpoint"
    data = admin_resp.json()
    assert isinstance(data, dict), "Admin endpoint expected JSON object response"

    # Test invalid login
    invalid_login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": user_email, "password": "wrongpass"}, timeout=TIMEOUT)
    assert invalid_login_resp.status_code == 401, "Invalid login should return 401 Unauthorized"

    # Test registration with existing email
    duplicate_reg_resp = requests.post(f"{BASE_URL}/auth/register", json={"email": user_email, "password": password}, timeout=TIMEOUT)
    assert duplicate_reg_resp.status_code in (400,409), "Duplicate registration should fail with 4xx error"

    # Test profile access without token
    no_auth_resp = requests.get(f"{BASE_URL}/auth/profile", timeout=TIMEOUT)
    assert no_auth_resp.status_code == 401, "Profile access without token should be unauthorized"

test_user_authentication_and_role_based_access_control()