# PowerShell script to test Supporters API endpoints
# Usage: .\test-api.ps1

$baseUrl = "http://localhost:3000/api/v1/supporters"
$testUuid = "550e8400-e29b-41d4-a716-446655440000"

Write-Host "`n=== Testing Supporters API ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host "Test UUID: $testUuid`n" -ForegroundColor Gray

# Test 1: GET /status/{uuid}
Write-Host "1. Testing GET /status/{uuid}..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/status/$testUuid" -Method GET -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    if ($response.Content -match '^\{') {
        Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Response is HTML, not JSON!" -ForegroundColor Red
        Write-Host "   First 200 chars: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: GET /cosmetics/{uuid}
Write-Host "2. Testing GET /cosmetics/{uuid}..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/cosmetics/$testUuid" -Method GET -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    if ($response.Content -match '^\{') {
        Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Response is HTML, not JSON!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: GET /tiers
Write-Host "3. Testing GET /tiers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/tiers" -Method GET -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    if ($response.Content -match '^\{') {
        Write-Host "   ✅ Response is JSON" -ForegroundColor Green
        Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Response is HTML, not JSON!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: POST /connect/{uuid}
Write-Host "4. Testing POST /connect/{uuid}..." -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "BuildScape-Mod/1.0"
    }
    $response = Invoke-WebRequest -Uri "$baseUrl/connect/$testUuid" -Method POST -Headers $headers -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content -match '^\{') {
        Write-Host "   ✅ Response is JSON" -ForegroundColor Green
        Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Response is HTML, not JSON!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Tests Complete ===`n" -ForegroundColor Cyan

