# Supporters API Testing Guide

This guide explains how to test the Supporters API endpoints to ensure they work correctly with your Minecraft mod.

## Prerequisites

1. **Start the API server:**
   ```bash
   npm run dev:api
   ```
   This starts Vercel dev server on `http://localhost:3000`

2. **Optional: Set up MongoDB** (for full functionality)
   - If MongoDB is not set up, endpoints will still work but return default/empty data
   - See `SUPPORTERS_API_SETUP.md` for database setup

## Testing Methods

### Method 1: Automated Test Script (Recommended)

Run the comprehensive test suite:

```bash
npm run test:api
```

Or directly:
```bash
npx tsx test-supporters-api.ts
```

**What it tests:**
- ✅ All 4 endpoints with valid UUIDs
- ✅ Invalid UUID format handling
- ✅ Non-existent UUID handling
- ✅ Rate limiting
- ✅ CORS headers
- ✅ Query parameter fallback
- ✅ Verification code flow

**Expected output:**
- Green ✅ for passed tests
- Red ❌ for failed tests
- Summary with pass/fail counts

### Method 2: Browser Test Page

1. Open `test-supporters-api.html` in your browser
2. Configure the API URL (default: `http://localhost:3000/api/v1/supporters`)
3. Enter a test UUID (default: `550e8400-e29b-41d4-a716-446655440000`)
4. Click test buttons for each endpoint
5. View results with full request/response details

**Features:**
- Visual interface
- Real-time results
- Full request/response inspection
- Quick test suite button

### Method 3: Manual cURL Testing

Test each endpoint individually:

#### 1. GET /status/{uuid}
```bash
# Valid UUID
curl http://localhost:3000/api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000

# Invalid UUID (should return 400)
curl http://localhost:3000/api/v1/supporters/status/invalid-uuid
```

#### 2. GET /cosmetics/{uuid}
```bash
curl http://localhost:3000/api/v1/supporters/cosmetics/550e8400-e29b-41d4-a716-446655440000
```

#### 3. GET /tiers
```bash
curl http://localhost:3000/api/v1/supporters/tiers
```

#### 4. POST /connect/{uuid}
```bash
# Initiate connection
curl -X POST http://localhost:3000/api/v1/supporters/connect/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "User-Agent: BuildScape-Mod/1.0"

# With verification code (use code from previous response)
curl -X POST http://localhost:3000/api/v1/supporters/connect/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "User-Agent: BuildScape-Mod/1.0" \
  -d '{"verificationCode": "ABC123"}'
```

## Testing Path Parameters (Mod's Implementation)

Your mod uses **path parameters** like:
```
GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000
```

All test methods above test this exact format. The API also supports query parameters as a fallback:
```
GET /api/v1/supporters/status?uuid=550e8400-e29b-41d4-a716-446655440000
```

## Expected Responses

### Success Response (200 OK)
```json
{
  "connected": true,
  "username": "PlayerName",
  "tier": "Gold",
  "tierLevel": 3,
  "cosmetics": ["item:minecraft:diamond_sword"]
}
```

### Error Response (400 Bad Request)
```json
{
  "error": "Invalid UUID format",
  "code": "INVALID_UUID"
}
```

### Rate Limit Response (429 Too Many Requests)
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED"
}
```
With header: `Retry-After: 60`

## Testing Checklist

### ✅ Basic Functionality
- [ ] GET /status/{uuid} returns 200 with valid UUID
- [ ] GET /status/{uuid} returns 400 with invalid UUID
- [ ] GET /cosmetics/{uuid} returns 200 with valid UUID
- [ ] GET /tiers returns 200 (no UUID needed)
- [ ] POST /connect/{uuid} returns 200 and generates verification code

### ✅ Error Handling
- [ ] Invalid UUID format returns 400
- [ ] Non-existent UUID returns 200 with default data (not 404)
- [ ] Missing UUID returns 400
- [ ] Invalid HTTP method returns 405

### ✅ Rate Limiting
- [ ] Making 15 rapid requests triggers rate limit (429)
- [ ] Retry-After header is present
- [ ] Rate limit resets after 1 minute

### ✅ CORS
- [ ] OPTIONS request returns 200
- [ ] CORS headers are present in responses
- [ ] Requests from browser work without CORS errors

### ✅ UUID Format
- [ ] UUID with dashes works: `550e8400-e29b-41d4-a716-446655440000`
- [ ] UUID without dashes fails: `550e8400e29b41d4a716446655440000`
- [ ] Case insensitive: `550E8400-E29B-41D4-A716-446655440000` works

### ✅ Path vs Query Parameters
- [ ] Path parameter works: `/status/550e8400-e29b-41d4-a716-446655440000`
- [ ] Query parameter works: `/status?uuid=550e8400-e29b-41d4-a716-446655440000`
- [ ] Both return same results

## Testing with Real Minecraft UUIDs

To test with actual player UUIDs:

1. **Get a real UUID:**
   - Use a Minecraft UUID lookup tool
   - Or use your own UUID from the game

2. **Test with that UUID:**
   ```bash
   curl http://localhost:3000/api/v1/supporters/status/YOUR-REAL-UUID-HERE
   ```

3. **Add test data to MongoDB:**
   ```javascript
   use buildscape_tracker;
   
   db.supporters.insertOne({
     uuid: "YOUR-REAL-UUID-HERE",
     username: "YourUsername",
     tier: "gold",
     tier_level: 3,
     connected_at: new Date(),
     created_at: new Date(),
     updated_at: new Date()
   });
   
   db.cosmetic_unlocks.insertOne({
     uuid: "YOUR-REAL-UUID-HERE",
     cosmetic_id: "item:minecraft:diamond_sword",
     unlocked_at: new Date(),
     source: "tier"
   });
   ```

## Troubleshooting

### API server not responding
- Check if `npm run dev:api` is running
- Verify port 3000 is not in use
- Check console for errors

### All requests return 503
- MongoDB URI not configured
- Set `MONGODB_URI` environment variable
- Or endpoints will work but return default data

### Rate limiting not working
- Rate limiter uses in-memory storage
- Restart API server to reset limits
- In production, consider Redis for distributed rate limiting

### UUID not found in path
- Check URL format matches: `/api/v1/supporters/status/{uuid}`
- Verify UUID has dashes: `550e8400-e29b-41d4-a716-446655440000`
- Check browser network tab for actual request URL

### CORS errors in browser
- Verify CORS headers in response
- Check `Access-Control-Allow-Origin` header
- Ensure User-Agent header is set

## Integration Testing with Mod

Once API tests pass, test with your mod:

1. **Start API server:**
   ```bash
   npm run dev:api
   ```

2. **Use ngrok or similar to expose localhost:**
   ```bash
   npx ngrok http 3000
   ```
   Update mod's base URL to ngrok URL

3. **Or deploy to Vercel:**
   - Push to GitHub
   - Vercel auto-deploys
   - Use production URL: `https://buildscape.online/api/v1`

4. **Test in-game:**
   - Open Supporters-Only tab
   - Check mod logs for API requests
   - Verify cosmetics load correctly

## Next Steps

After testing:
1. ✅ All tests pass
2. ✅ Database collections created
3. ✅ Test data added (optional)
4. ✅ Deploy to production
5. ✅ Update mod with production URL
6. ✅ Test in-game

## Support

If tests fail:
1. Check API server logs
2. Verify MongoDB connection
3. Review error responses
4. Check UUID format
5. Verify rate limits aren't blocking

For issues, check:
- `SUPPORTERS_API_SETUP.md` - Setup instructions
- `UUID_ROUTING_EXPLANATION.md` - How routing works
- `SUPPORTERS_API_IMPLEMENTATION.md` - Implementation details

