# Quick Test Start Guide

## 🚀 Fast Testing (3 Steps)

### Step 1: Start API Server
```bash
npm run dev:api
```
Wait for: `Ready! Available at http://localhost:3000`

### Step 2: Run Tests
In a **new terminal**, run:
```bash
npm run test:api
```

### Step 3: Check Results
Look for:
- ✅ Green checkmarks = Tests passed
- ❌ Red X = Tests failed
- Summary at the end

## 🎯 What Gets Tested

The test script automatically tests:
1. ✅ GET `/status/{uuid}` - Valid UUID (path parameter)
2. ✅ GET `/status/{uuid}` - Invalid UUID (should fail)
3. ✅ GET `/cosmetics/{uuid}` - Valid UUID
4. ✅ GET `/cosmetics/{uuid}` - Invalid UUID
5. ✅ GET `/tiers` - Public endpoint
6. ✅ POST `/connect/{uuid}` - Initiate connection
7. ✅ POST `/connect/{uuid}` - With verification code
8. ✅ Query parameter fallback
9. ✅ CORS headers
10. ✅ Rate limiting (15 rapid requests)

## 🌐 Browser Testing

1. Open `test-supporters-api.html` in your browser
2. Click test buttons
3. See results instantly

## 📝 Manual Testing

Quick cURL commands:
```bash
# Test status endpoint (exactly like your mod)
curl http://localhost:3000/api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000

# Test cosmetics
curl http://localhost:3000/api/v1/supporters/cosmetics/550e8400-e29b-41d4-a716-446655440000

# Test tiers
curl http://localhost:3000/api/v1/supporters/tiers
```

## ⚠️ Troubleshooting

**"Cannot find module tsx"**
- Run: `npm install -D tsx`
- Or use: `npx tsx test-supporters-api.ts`

**"API server not responding"**
- Make sure `npm run dev:api` is running
- Check port 3000 is available

**"All tests return 503"**
- MongoDB not configured (this is OK for testing)
- Endpoints will return default/empty data

## ✅ Success Criteria

All tests should show:
- ✅ Status endpoint returns 200
- ✅ Cosmetics endpoint returns 200
- ✅ Tiers endpoint returns 200
- ✅ Invalid UUID returns 400
- ✅ Rate limiting works (429 after 10+ requests)

If all tests pass, your API is ready for mod integration! 🎉

