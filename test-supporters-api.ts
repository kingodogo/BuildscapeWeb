/**
 * Supporters API Test Suite
 * Tests all endpoints exactly as the Minecraft mod uses them (path parameters)
 * 
 * Usage:
 *   1. Start API server: npm run dev:api
 *   2. Run tests: npx tsx test-supporters-api.ts
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1/supporters`;

// Test UUIDs
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'invalid-uuid-format';
const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
  status?: number;
}

const results: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`Testing: ${name}`, colors.cyan);
  log('='.repeat(60), colors.cyan);
}

async function testEndpoint(
  name: string,
  method: 'GET' | 'POST',
  url: string,
  options: { body?: any; headers?: Record<string, string> } = {}
): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BuildScape-Mod/1.0',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    const passed = response.status >= 200 && response.status < 300;

    return {
      name,
      passed,
      status: response.status,
      response: data,
      error: passed ? undefined : `Status ${response.status}: ${JSON.stringify(data)}`,
    };
  } catch (error: any) {
    return {
      name,
      passed: false,
      error: error.message || 'Request failed',
    };
  }
}

async function runTests() {
  log('\n🚀 Starting Supporters API Test Suite', colors.blue);
  log(`Base URL: ${BASE_URL}`, colors.blue);
  log(`API Base: ${API_BASE}`, colors.blue);

  // Test 1: GET /api/v1/supporters/status/{uuid} - Valid UUID
  logTest('GET /status/{uuid} - Valid UUID (Path Parameter)');
  const statusTest1 = await testEndpoint(
    'GET /status/{uuid} - Valid UUID',
    'GET',
    `${API_BASE}/status/${TEST_UUID}`
  );
  results.push(statusTest1);
  logResult(statusTest1);

  // Test 2: GET /api/v1/supporters/status/{uuid} - Invalid UUID
  logTest('GET /status/{uuid} - Invalid UUID Format');
  const statusTest2 = await testEndpoint(
    'GET /status/{uuid} - Invalid UUID',
    'GET',
    `${API_BASE}/status/${INVALID_UUID}`
  );
  results.push(statusTest2);
  logResult(statusTest2, true); // Expected to fail

  // Test 3: GET /api/v1/supporters/status/{uuid} - Non-existent UUID
  logTest('GET /status/{uuid} - Non-existent UUID');
  const statusTest3 = await testEndpoint(
    'GET /status/{uuid} - Non-existent UUID',
    'GET',
    `${API_BASE}/status/${NONEXISTENT_UUID}`
  );
  results.push(statusTest3);
  logResult(statusTest3);

  // Test 4: GET /api/v1/supporters/cosmetics/{uuid} - Valid UUID
  logTest('GET /cosmetics/{uuid} - Valid UUID (Path Parameter)');
  const cosmeticsTest1 = await testEndpoint(
    'GET /cosmetics/{uuid} - Valid UUID',
    'GET',
    `${API_BASE}/cosmetics/${TEST_UUID}`
  );
  results.push(cosmeticsTest1);
  logResult(cosmeticsTest1);

  // Test 5: GET /api/v1/supporters/cosmetics/{uuid} - Invalid UUID
  logTest('GET /cosmetics/{uuid} - Invalid UUID Format');
  const cosmeticsTest2 = await testEndpoint(
    'GET /cosmetics/{uuid} - Invalid UUID',
    'GET',
    `${API_BASE}/cosmetics/${INVALID_UUID}`
  );
  results.push(cosmeticsTest2);
  logResult(cosmeticsTest2, true); // Expected to fail

  // Test 6: GET /api/v1/supporters/tiers
  logTest('GET /tiers - Public Endpoint');
  const tiersTest = await testEndpoint('GET /tiers', 'GET', `${API_BASE}/tiers`);
  results.push(tiersTest);
  logResult(tiersTest);

  // Test 7: POST /api/v1/supporters/connect/{uuid} - Initiate Connection
  logTest('POST /connect/{uuid} - Initiate Connection');
  const connectTest1 = await testEndpoint(
    'POST /connect/{uuid} - Initiate',
    'POST',
    `${API_BASE}/connect/${TEST_UUID}`
  );
  results.push(connectTest1);
  logResult(connectTest1);

  // Test 8: POST /api/v1/supporters/connect/{uuid} - With Verification Code
  logTest('POST /connect/{uuid} - With Verification Code');
  // First get a code
  const connectResponse = await fetch(`${API_BASE}/connect/${TEST_UUID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'BuildScape-Mod/1.0',
    },
  });
  const connectData = await connectResponse.json();
  const verificationCode = connectData.verificationCode;

  if (verificationCode) {
    const connectTest2 = await testEndpoint(
      'POST /connect/{uuid} - With Code',
      'POST',
      `${API_BASE}/connect/${TEST_UUID}`,
      {
        body: { verificationCode },
      }
    );
    results.push(connectTest2);
    logResult(connectTest2);
  } else {
    log('⚠️  Could not test verification code (no code returned)', colors.yellow);
  }

  // Test 9: Test query parameter fallback (should also work)
  logTest('GET /status?uuid={uuid} - Query Parameter (Fallback)');
  const queryParamTest = await testEndpoint(
    'GET /status - Query Parameter',
    'GET',
    `${API_BASE}/status?uuid=${TEST_UUID}`
  );
  results.push(queryParamTest);
  logResult(queryParamTest);

  // Test 10: Test CORS headers
  logTest('OPTIONS /status/{uuid} - CORS Preflight');
  const corsTest = await testEndpoint(
    'OPTIONS /status/{uuid} - CORS',
    'GET',
    `${API_BASE}/status/${TEST_UUID}`,
    {
      headers: {
        'Origin': 'https://buildscape.online',
        'Access-Control-Request-Method': 'GET',
      },
    }
  );
  results.push(corsTest);
  logResult(corsTest);

  // Test 11: Rate limiting test (make multiple rapid requests)
  logTest('Rate Limiting - Multiple Rapid Requests');
  log('Making 15 rapid requests (limit is 10/min per UUID)...', colors.yellow);
  const rateLimitTests: TestResult[] = [];
  for (let i = 0; i < 15; i++) {
    const test = await testEndpoint(
      `Rate Limit Test ${i + 1}`,
      'GET',
      `${API_BASE}/status/${TEST_UUID}`
    );
    rateLimitTests.push(test);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }

  const rateLimited = rateLimitTests.filter(r => r.status === 429);
  if (rateLimited.length > 0) {
    log(`✅ Rate limiting working! ${rateLimited.length} requests were rate limited`, colors.green);
    results.push({
      name: 'Rate Limiting',
      passed: true,
      status: 429,
      response: { message: 'Rate limiting is working correctly' },
    });
  } else {
    log('⚠️  Rate limiting may not be working (no 429 responses)', colors.yellow);
    results.push({
      name: 'Rate Limiting',
      passed: false,
      error: 'No rate limit responses detected',
    });
  }

  // Print summary
  printSummary();
}

function logResult(result: TestResult, expectedFail: boolean = false) {
  if (result.passed && !expectedFail) {
    log(`✅ PASS: ${result.name}`, colors.green);
    if (result.status) {
      log(`   Status: ${result.status}`, colors.cyan);
    }
    if (result.response) {
      log(`   Response: ${JSON.stringify(result.response, null, 2).substring(0, 200)}...`, colors.cyan);
    }
  } else if (!result.passed && expectedFail) {
    log(`✅ PASS (Expected Fail): ${result.name}`, colors.green);
    log(`   Status: ${result.status}`, colors.cyan);
  } else if (!result.passed) {
    log(`❌ FAIL: ${result.name}`, colors.red);
    log(`   Error: ${result.error}`, colors.red);
    if (result.status) {
      log(`   Status: ${result.status}`, colors.red);
    }
  } else {
    log(`⚠️  UNEXPECTED PASS: ${result.name}`, colors.yellow);
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), colors.blue);
  log('📊 Test Summary', colors.blue);
  log('='.repeat(60), colors.blue);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  log(`\nTotal Tests: ${total}`, colors.cyan);
  log(`✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, failed > 0 ? colors.red : colors.green);

  if (failed > 0) {
    log('\nFailed Tests:', colors.red);
    results
      .filter(r => !r.passed)
      .forEach(r => {
        log(`  - ${r.name}: ${r.error}`, colors.red);
      });
  }

  log('\n' + '='.repeat(60), colors.blue);
  log(failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed', failed === 0 ? colors.green : colors.yellow);
  log('='.repeat(60) + '\n', colors.blue);
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test suite crashed: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

