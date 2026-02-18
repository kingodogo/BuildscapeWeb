import requests
import uuid
import time

BASE_URL = "http://localhost:5173"
API_KEY = "your_api_key_here"  # Replace with your actual API key
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
TIMEOUT = 30

def test_ai_bug_report_analysis_and_tagging():
    # Create a new bug report to trigger AI analysis
    bug_report_payload = {
        "title": "Test AI Analysis Bug " + str(uuid.uuid4()),
        "description": "This bug is submitted to test the AI automated classification and prioritization using Google Gemini AI.",
        "version": "1.0.0",
        "severity": "High",
        "status": "New",
        "steps_to_reproduce": "1. Launch the app\n2. Click on test AI button\n3. Observe the AI processing",
        "expected_result": "The AI should classify and prioritize this bug report automatically.",
        "actual_result": "N/A",
        "reported_by": "test_ai_user",
        "metadata": {
            "environment": "test",
            "platform": "web"
        }
    }

    # Endpoint to submit bug report
    submit_bug_endpoint = f"{BASE_URL}/api/bugs"
    timeout_seconds = TIMEOUT

    bug_id = None

    try:
        # Submit bug report
        response = requests.post(submit_bug_endpoint, headers=HEADERS, json=bug_report_payload, timeout=timeout_seconds)
        assert response.status_code in (200, 201), f"Bug report creation failed with status code {response.status_code}"
        try:
            bug_data = response.json() if response.content else {}
        except Exception as e:
            assert False, f"Failed to parse JSON from bug creation response: {e}"

        bug_id = bug_data.get("_id") or bug_data.get("id")
        assert bug_id is not None, "Bug ID not returned after creation"

        # The AI processing might be asynchronous. Poll the bug detail endpoint until AI tags appear or timeout.
        bug_detail_endpoint = f"{BASE_URL}/api/bugs/{bug_id}"

        max_wait = 20  # seconds to wait for AI processing
        interval = 2
        elapsed = 0
        ai_analysis_present = False
        ai_tags = None
        ai_priority = None
        ai_classification = None

        while elapsed < max_wait:
            resp = requests.get(bug_detail_endpoint, headers=HEADERS, timeout=timeout_seconds)
            assert resp.status_code == 200, f"Fetching bug details failed with status code {resp.status_code}"
            try:
                bug_detail = resp.json() if resp.content else {}
            except Exception as e:
                assert False, f"Failed to parse JSON from bug detail response: {e}"

            # Expect AI to add fields such as aiTags, aiClassification, and aiPriority
            ai_tags = bug_detail.get("aiTags")
            ai_priority = bug_detail.get("aiPriority")
            ai_classification = bug_detail.get("aiClassification")

            if ai_tags and ai_priority and ai_classification:
                ai_analysis_present = True
                break

            time.sleep(interval)
            elapsed += interval

        assert ai_analysis_present, "AI analysis data (tags, priority, classification) not found on bug report after waiting"

        # Validate aiTags is a non-empty list of strings
        assert isinstance(ai_tags, list) and all(isinstance(tag, str) and tag for tag in ai_tags), "AI tags are invalid"
        # Validate aiPriority is one of expected priorities
        assert ai_priority in ["Low", "Medium", "High", "Critical"], f"AI priority '{ai_priority}' is not expected"
        # Validate aiClassification is a non-empty string
        assert isinstance(ai_classification, str) and ai_classification.strip(), "AI classification is invalid"

    finally:
        # Cleanup: Delete the bug report created for testing
        if bug_id is not None:
            try:
                delete_endpoint = f"{BASE_URL}/api/bugs/{bug_id}"
                del_resp = requests.delete(delete_endpoint, headers=HEADERS, timeout=timeout_seconds)
                assert del_resp.status_code in (200, 204), f"Failed to delete bug report with id {bug_id}"
            except Exception as e:
                print(f"Cleanup failed for bug report id {bug_id}: {e}")


test_ai_bug_report_analysis_and_tagging()
