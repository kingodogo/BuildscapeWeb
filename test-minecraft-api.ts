/**
 * Test script for the secure Minecraft cosmetic API
 * Run with: npx ts-node test-minecraft-api.ts
 */

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8888/.netlify/functions';

// Test data (use valid Minecraft credentials for real tests)
const TEST_UUID = '550e8400e29b41d4a716446655440000'; // Example UUID
const TEST_ACCESS_TOKEN = 'your_access_token_here'; // Replace with valid token

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];
  console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

async function testEndpoint(
  name: string,
  endpoint: string,
  body: any,
  expectedStatus: number
): Promise<boolean> {
  log(`Testing ${name}...`, 'info');

  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.status === expectedStatus) {
      log(`${name}: PASSED (status ${response.status})`, 'success');
      if (process.env.DEBUG) {
        console.log('Response:', JSON.stringify(data, null, 2));
      }
      return true;
    } else {
      log(`${name}: FAILED (expected ${expectedStatus}, got ${response.status})`, 'error');
      console.log('Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error: any) {
    log(`${name}: ERROR - ${error.message}`, 'error');
    return false;
  }
}

async function runTests() {
  log('=================================', 'info');
  log('Minecraft Cosmetic API Test Suite', 'info');
  log('=================================', 'info');
  console.log();

  let passed = 0;
  let failed = 0;

  // Test 1: Authenticate - Missing UUID
  if (await testEndpoint(
    'Authenticate - Missing UUID',
    'api-minecraft',
    { action: 'authenticate', accessToken: TEST_ACCESS_TOKEN },
    400
  )) passed++; else failed++;

  // Test 2: Authenticate - Missing accessToken
  if (await testEndpoint(
    'Authenticate - Missing accessToken',
    'api-minecraft',
    { action: 'authenticate', uuid: TEST_UUID },
    400
  )) passed++; else failed++;

  // Test 3: Authenticate - Invalid UUID format
  if (await testEndpoint(
    'Authenticate - Invalid UUID format',
    'api-minecraft',
    { action: 'authenticate', uuid: 'invalid-uuid', accessToken: TEST_ACCESS_TOKEN },
    400
  )) passed++; else failed++;

  // Test 4: Authenticate - Invalid accessToken (will fail Mojang verification)
  if (await testEndpoint(
    'Authenticate - Invalid accessToken',
    'api-minecraft',
    { action: 'authenticate', uuid: TEST_UUID, accessToken: 'invalid_token' },
    401
  )) passed++; else failed++;

  // Test 5: Redeem - Missing code
  if (await testEndpoint(
    'Redeem - Missing code',
    'api-redeem',
    { action: 'redeemCode', uuid: TEST_UUID, accessToken: TEST_ACCESS_TOKEN },
    400
  )) passed++; else failed++;

  // Test 6: Redeem - Invalid code format
  if (await testEndpoint(
    'Redeem - Invalid code format',
    'api-redeem',
    { action: 'redeemCode', uuid: TEST_UUID, accessToken: TEST_ACCESS_TOKEN, code: 'ab' },
    400
  )) passed++; else failed++;

  // Test 7: Cosmetics - Missing cosmeticId
  if (await testEndpoint(
    'Cosmetics - Missing cosmeticId',
    'api-cosmetics',
    { action: 'selectCosmetic', uuid: TEST_UUID, accessToken: TEST_ACCESS_TOKEN, cosmeticType: 'cape' },
    400
  )) passed++; else failed++;

  // Test 8: Cosmetics - Invalid cosmetic type
  if (await testEndpoint(
    'Cosmetics - Invalid cosmetic type',
    'api-cosmetics',
    { action: 'selectCosmetic', uuid: TEST_UUID, accessToken: TEST_ACCESS_TOKEN, cosmeticId: 'test', cosmeticType: 'invalid' },
    400
  )) passed++; else failed++;

  // Test 9: Method not allowed (GET on api-minecraft)
  log('Testing Method Not Allowed...', 'info');
  try {
    const response = await fetch(`${API_BASE_URL}/api-minecraft`, {
      method: 'GET',
    });
    if (response.status === 405) {
      log('Method Not Allowed: PASSED', 'success');
      passed++;
    } else {
      log(`Method Not Allowed: FAILED (expected 405, got ${response.status})`, 'error');
      failed++;
    }
  } catch (error: any) {
    log(`Method Not Allowed: ERROR - ${error.message}`, 'error');
    failed++;
  }

  // Test 10: Invalid JSON
  log('Testing Invalid JSON...', 'info');
  try {
    const response = await fetch(`${API_BASE_URL}/api-minecraft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });
    if (response.status === 400) {
      log('Invalid JSON: PASSED', 'success');
      passed++;
    } else {
      log(`Invalid JSON: FAILED (expected 400, got ${response.status})`, 'error');
      failed++;
    }
  } catch (error: any) {
    log(`Invalid JSON: ERROR - ${error.message}`, 'error');
    failed++;
  }

  // Test 11: Invalid action
  if (await testEndpoint(
    'Invalid action',
    'api-minecraft',
    { action: 'invalidAction', uuid: TEST_UUID, accessToken: TEST_ACCESS_TOKEN },
    400
  )) passed++; else failed++;

  console.log();
  log('=================================', 'info');
  log(`Test Results: ${passed} passed, ${failed} failed`, failed === 0 ? 'success' : 'warning');
  log('=================================', 'info');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests };
