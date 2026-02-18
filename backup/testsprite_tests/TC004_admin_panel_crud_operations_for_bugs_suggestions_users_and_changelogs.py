import requests
import uuid

BASE_URL = "http://localhost:3000"
API_KEY = "Authorization"  # The authorization API key header name
API_KEY_VALUE = "Bearer test_admin_api_key"  # Example API key value; replace with valid key

HEADERS = {
    API_KEY: API_KEY_VALUE,
    "Content-Type": "application/json"
}
TIMEOUT = 30

def admin_panel_crud_operations_for_bugs_suggestions_users_and_changelogs():
    created_resources = {
        "bugs": [],
        "suggestions": [],
        "users": [],
        "changelogs": []
    }

    # Helper functions
    def create_bug():
        data = {
            "title": "Test Bug " + str(uuid.uuid4()),
            "description": "Bug description for test",
            "version": "1.0.0",
            "severity": "High",
            "status": "Open"
        }
        resp = requests.post(f"{BASE_URL}/api/bugs", json=data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Bug creation failed: {resp.text}"
        bug = resp.json()
        created_resources["bugs"].append(bug["id"])
        return bug

    def update_bug(bug_id):
        update_data = {
            "status": "Resolved",
            "severity": "Medium"
        }
        resp = requests.put(f"{BASE_URL}/api/bugs/{bug_id}", json=update_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Bug update failed: {resp.text}"
        updated_bug = resp.json()
        assert updated_bug["status"] == "Resolved"
        assert updated_bug["severity"] == "Medium"
        return updated_bug

    def get_bug(bug_id):
        resp = requests.get(f"{BASE_URL}/api/bugs/{bug_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Bug retrieval failed: {resp.text}"
        bug = resp.json()
        return bug

    def delete_bug(bug_id):
        resp = requests.delete(f"{BASE_URL}/api/bugs/{bug_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Bug deletion failed: {resp.text}"
        created_resources["bugs"].remove(bug_id)

    def create_suggestion():
        data = {
            "title": "Feature Suggestion " + str(uuid.uuid4()),
            "description": "Description of feature suggestion",
            "category": "UI",
            "priority": "High",
            "status": "Pending"
        }
        resp = requests.post(f"{BASE_URL}/api/suggestions", json=data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Suggestion creation failed: {resp.text}"
        suggestion = resp.json()
        created_resources["suggestions"].append(suggestion["id"])
        return suggestion

    def update_suggestion(suggestion_id):
        update_data = {
            "status": "Approved",
            "priority": "Medium"
        }
        resp = requests.put(f"{BASE_URL}/api/suggestions/{suggestion_id}", json=update_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Suggestion update failed: {resp.text}"
        updated_suggestion = resp.json()
        assert updated_suggestion["status"] == "Approved"
        assert updated_suggestion["priority"] == "Medium"
        return updated_suggestion

    def get_suggestion(suggestion_id):
        resp = requests.get(f"{BASE_URL}/api/suggestions/{suggestion_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Suggestion retrieval failed: {resp.text}"
        suggestion = resp.json()
        return suggestion

    def delete_suggestion(suggestion_id):
        resp = requests.delete(f"{BASE_URL}/api/suggestions/{suggestion_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Suggestion deletion failed: {resp.text}"
        created_resources["suggestions"].remove(suggestion_id)

    def create_user():
        unique_str = str(uuid.uuid4())
        data = {
            "username": f"testuser_{unique_str}",
            "email": f"test_{unique_str}@example.com",
            "password": "TestPassword123!",
            "role": "user"
        }
        resp = requests.post(f"{BASE_URL}/api/users", json=data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201, f"User creation failed: {resp.text}"
        user = resp.json()
        created_resources["users"].append(user["id"])
        return user

    def update_user(user_id):
        update_data = {
            "role": "admin"
        }
        resp = requests.put(f"{BASE_URL}/api/users/{user_id}", json=update_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"User update failed: {resp.text}"
        updated_user = resp.json()
        assert updated_user["role"] == "admin"
        return updated_user

    def get_user(user_id):
        resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"User retrieval failed: {resp.text}"
        user = resp.json()
        return user

    def delete_user(user_id):
        resp = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 204, f"User deletion failed: {resp.text}"
        created_resources["users"].remove(user_id)

    def create_changelog():
        data = {
            "version": "1.0." + str(uuid.uuid4())[:8],
            "content": "Initial changelog entry for testing",
            "date": "2025-12-10"
        }
        resp = requests.post(f"{BASE_URL}/api/changelogs", json=data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Changelog creation failed: {resp.text}"
        changelog = resp.json()
        created_resources["changelogs"].append(changelog["id"])
        return changelog

    def update_changelog(changelog_id):
        update_data = {
            "content": "Updated changelog content for test"
        }
        resp = requests.put(f"{BASE_URL}/api/changelogs/{changelog_id}", json=update_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Changelog update failed: {resp.text}"
        updated_changelog = resp.json()
        assert updated_changelog["content"] == "Updated changelog content for test"
        return updated_changelog

    def get_changelog(changelog_id):
        resp = requests.get(f"{BASE_URL}/api/changelogs/{changelog_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Changelog retrieval failed: {resp.text}"
        changelog = resp.json()
        return changelog

    def delete_changelog(changelog_id):
        resp = requests.delete(f"{BASE_URL}/api/changelogs/{changelog_id}", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 204, f"Changelog deletion failed: {resp.text}"
        created_resources["changelogs"].remove(changelog_id)

    # Test Bugs CRUD
    try:
        bug = create_bug()
        bug_id = bug["id"]
        bug_fetched = get_bug(bug_id)
        assert bug_fetched["title"] == bug["title"]
        updated_bug = update_bug(bug_id)
        bug_fetched_after_update = get_bug(bug_id)
        assert bug_fetched_after_update["status"] == "Resolved"
    except Exception as e:
        raise AssertionError(f"Bug CRUD operations failed: {e}")

    # Test Suggestions CRUD
    try:
        suggestion = create_suggestion()
        suggestion_id = suggestion["id"]
        suggestion_fetched = get_suggestion(suggestion_id)
        assert suggestion_fetched["title"] == suggestion["title"]
        updated_suggestion = update_suggestion(suggestion_id)
        suggestion_fetched_after_update = get_suggestion(suggestion_id)
        assert suggestion_fetched_after_update["status"] == "Approved"
    except Exception as e:
        raise AssertionError(f"Suggestion CRUD operations failed: {e}")

    # Test Users CRUD
    try:
        user = create_user()
        user_id = user["id"]
        user_fetched = get_user(user_id)
        assert user_fetched["username"] == user["username"]
        updated_user = update_user(user_id)
        user_fetched_after_update = get_user(user_id)
        assert user_fetched_after_update["role"] == "admin"
    except Exception as e:
        raise AssertionError(f"User CRUD operations failed: {e}")

    # Test Changelogs CRUD
    try:
        changelog = create_changelog()
        changelog_id = changelog["id"]
        changelog_fetched = get_changelog(changelog_id)
        assert changelog_fetched["version"] == changelog["version"]
        updated_changelog = update_changelog(changelog_id)
        changelog_fetched_after_update = get_changelog(changelog_id)
        assert changelog_fetched_after_update["content"] == "Updated changelog content for test"
    except Exception as e:
        raise AssertionError(f"Changelog CRUD operations failed: {e}")

    # Cleanup all created resources
    # Bugs
    for bug_id in created_resources["bugs"][:]:
        try:
            delete_bug(bug_id)
        except Exception:
            pass

    # Suggestions
    for suggestion_id in created_resources["suggestions"][:]:
        try:
            delete_suggestion(suggestion_id)
        except Exception:
            pass

    # Users
    for user_id in created_resources["users"][:]:
        try:
            delete_user(user_id)
        except Exception:
            pass

    # Changelogs
    for changelog_id in created_resources["changelogs"][:]:
        try:
            delete_changelog(changelog_id)
        except Exception:
            pass

admin_panel_crud_operations_for_bugs_suggestions_users_and_changelogs()
