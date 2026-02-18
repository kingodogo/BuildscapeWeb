import requests

BASE_URL = "http://localhost:5173"
API_KEY = "Authorization"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": API_KEY,
}
TIMEOUT = 30

def test_validate_feature_suggestion_submission_and_priority_tracking():
    suggestion_endpoint = f"{BASE_URL}/api/suggestions"
    # Prepare a feature suggestion payload with categorization and priority
    new_suggestion = {
        "title": "Add customizable Minecraft mod integration settings",
        "description": "Allow users to configure mod integration options from the admin panel with priority based on user feedback.",
        "category": "mod-integration",  # Corrected category value
        "priority": "high",             # Priority level: low, medium, high, critical
        "submitter": "test_user_api",  # Assuming submitter user ID or name (for test)
        "tags": ["minecraft", "mod", "integration"]
    }
    suggestion_id = None

    try:
        # Submit a new feature suggestion
        response_post = requests.post(
            suggestion_endpoint, json=new_suggestion, headers=HEADERS, timeout=TIMEOUT
        )
        assert response_post.status_code in [200, 201], f"Expected 201 Created or 200 OK, got {response_post.status_code}"
        # Verify response content-type is JSON
        assert "application/json" in response_post.headers.get("Content-Type", ""), "Response is not JSON"
        created_suggestion = response_post.json()
        # The PRD likely uses MongoDB _id field
        assert "_id" in created_suggestion, "Response must contain '_id'"
        suggestion_id = created_suggestion["_id"]

        # Verify returned fields match submitted values
        assert created_suggestion["title"] == new_suggestion["title"], "Title mismatch"
        assert created_suggestion["category"] == new_suggestion["category"], "Category mismatch"
        assert created_suggestion["priority"] == new_suggestion["priority"], "Priority mismatch"

        # Retrieve the suggestion by ID and verify persistence and accuracy
        response_get = requests.get(
            f"{suggestion_endpoint}/{suggestion_id}",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert response_get.status_code == 200, f"Expected 200 OK on GET, got {response_get.status_code}"
        assert "application/json" in response_get.headers.get("Content-Type", ""), "GET response is not JSON"
        suggestion_data = response_get.json()
        assert suggestion_data["_id"] == suggestion_id, "Suggestion ID mismatch on GET"
        assert suggestion_data["title"] == new_suggestion["title"], "Title mismatch on GET"
        assert suggestion_data["category"] == new_suggestion["category"], "Category mismatch on GET"
        assert suggestion_data["priority"] == new_suggestion["priority"], "Priority mismatch on GET"
        assert suggestion_data.get("status") in [None, "pending", "open"], "Unexpected status value"

    finally:
        # Clean up: delete the created suggestion to maintain test idempotency
        if suggestion_id:
            del_response = requests.delete(
                f"{suggestion_endpoint}/{suggestion_id}", headers=HEADERS, timeout=TIMEOUT
            )
            assert del_response.status_code in [200, 204, 404], f"Failed to delete suggestion with id {suggestion_id}"

test_validate_feature_suggestion_submission_and_priority_tracking()
