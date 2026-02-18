import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_curseforge_api_mod_information_fetching():
    headers = {
        "Accept": "application/json"
    }
    try:
        # Use a fixed valid mod ID for testing
        valid_mod_id = "12345"

        # Step 1: Fetch detailed mod info for a specific mod
        mod_info_resp = requests.get(f"{BASE_URL}/api/curseforge/mod/{valid_mod_id}", headers=headers, timeout=TIMEOUT)
        assert mod_info_resp.status_code == 200, f"Expected 200 OK for mod info, got {mod_info_resp.status_code}"
        try:
            mod_info = mod_info_resp.json()
        except Exception as e:
            assert False, f"Response JSON decode error for valid mod: {e}"

        # Validate important fields presence and types
        expected_fields = ["id", "name", "author", "version", "description", "downloadCount", "lastUpdated", "files", "links"]
        for field in expected_fields:
            assert field in mod_info, f"'{field}' missing in mod info response"

        # Assert key properties have reasonable values
        assert str(mod_info["id"]) == valid_mod_id, "Mod ID mismatch in details response"
        assert isinstance(mod_info["name"], str) and len(mod_info["name"]) > 0, "Invalid mod name"
        assert isinstance(mod_info["author"], str) and len(mod_info["author"]) > 0, "Invalid mod author"
        assert isinstance(mod_info["version"], str) and len(mod_info["version"]) > 0, "Invalid mod version"
        assert isinstance(mod_info["description"], str), "Description must be a string"
        assert isinstance(mod_info["downloadCount"], int) and mod_info["downloadCount"] >= 0, "Invalid downloadCount"
        assert isinstance(mod_info["lastUpdated"], str) and len(mod_info["lastUpdated"]) > 0, "Invalid lastUpdated"

        # Files should be list of file info dicts
        assert isinstance(mod_info["files"], list), "Mod files should be a list"
        for f in mod_info["files"]:
            assert "fileName" in f and isinstance(f["fileName"], str), "File entry invalid"
            assert "fileSize" in f and isinstance(f["fileSize"], int), "File size invalid"

        # Links should be dict with URLs like project page, curseforge page etc.
        assert isinstance(mod_info["links"], dict), "Mod links should be a dict"
        assert any(isinstance(url, str) and url.startswith("http") for url in mod_info["links"].values()), "Mod links do not contain valid URLs"

        # Step 2: Test error handling - request a mod with invalid ID
        invalid_mod_id = "nonexistent-mod-id-xyz"
        error_resp = requests.get(f"{BASE_URL}/api/curseforge/mod/{invalid_mod_id}", headers=headers, timeout=TIMEOUT)
        assert error_resp.status_code in {400, 404}, f"Expected 400 or 404 for invalid mod ID, got {error_resp.status_code}"
        try:
            # Check json only if content is present
            if error_resp.content and len(error_resp.content) > 0:
                error_json = error_resp.json()
            else:
                error_json = {}
        except Exception:
            error_json = {}
        assert "error" in error_json or "message" in error_json, "Error response missing message"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"


test_curseforge_api_mod_information_fetching()
