# UUID Extraction and Routing Explanation

## Overview

The API supports multiple ways to pass the UUID to endpoints, making it flexible for different client implementations. Here's how it all works:

## How Vercel Routing Works

Vercel uses **file-based routing** for serverless functions. The file structure determines the URL path:

```
api/v1/supporters/status.ts          → /api/v1/supporters/status
api/v1/supporters/status/[...uuid].ts → /api/v1/supporters/status/{uuid}
```

The `[...uuid].ts` is a **catch-all route** that captures any path segments after `/status/`.

## Three Ways to Pass UUID

### 1. **Query Parameter** (Easiest)
```
GET /api/v1/supporters/status?uuid=550e8400-e29b-41d4-a716-446655440000
```
- UUID is in `req.query.uuid`
- Works with the main handler directly

### 2. **Path Parameter** (RESTful)
```
GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000
```
- UUID is in the URL path
- Vercel puts it in `req.query.uuid` as an array for catch-all routes
- The `[...uuid].ts` handler extracts it and forwards to main handler

### 3. **URL Path Parsing** (Fallback)
```
GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000
```
- If other methods fail, we parse `req.url` directly
- Uses regex to find UUID pattern in the path

## The UUID Extraction Process

Here's the step-by-step process in `extractUUID()`:

```typescript
export function extractUUID(req: any): string | undefined {
  // STEP 1: Try query parameter first (most common)
  if (req.query?.uuid) {
    const uuidParam = Array.isArray(req.query.uuid) ? req.query.uuid[0] : req.query.uuid;
    if (uuidParam && isValidUUID(uuidParam)) {
      return uuidParam; // ✅ Found it!
    }
  }
  
  // STEP 2: Try catch-all route parameters
  // Vercel might put path segments in query with different keys
  const catchAllKeys = Object.keys(req.query || {}).filter(key => 
    key.includes('uuid') || key.includes('slug') || key.includes('param')
  );
  for (const key of catchAllKeys) {
    const value = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
    if (value && isValidUUID(value)) {
      return value; // ✅ Found it!
    }
  }
  
  // STEP 3: Parse URL path directly (fallback)
  if (req.url) {
    // Try to parse as URL object
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Look for UUID pattern in each path segment
    for (const part of pathParts) {
      if (isValidUUID(part)) {
        return part; // ✅ Found it!
      }
    }
    
    // If URL parsing failed, use regex fallback
    const pathMatch = req.url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1]; // ✅ Found it!
    }
  }
  
  return undefined; // ❌ Not found
}
```

## UUID Validation

Before using the UUID, we validate it:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_REGEX.test(uuid.trim());
}
```

**Valid UUID format:**
- `550e8400-e29b-41d4-a716-446655440000` ✅
- `550E8400-E29B-41D4-A716-446655440000` ✅ (case insensitive)
- `550e8400e29b41d4a716446655440000` ❌ (missing hyphens)
- `550e8400-e29b-41d4-a716` ❌ (too short)

## How Catch-All Routes Work

### File Structure
```
api/v1/supporters/
  ├── status.ts              ← Main handler
  └── status/
      └── [...uuid].ts       ← Catch-all route handler
```

### Request Flow

**Request:** `GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000`

1. **Vercel routes to:** `api/v1/supporters/status/[...uuid].ts`
2. **Vercel puts path segments in:** `req.query.uuid = ['550e8400-e29b-41d4-a716-446655440000']`
3. **Catch-all handler extracts UUID:**
   ```typescript
   const uuidParam = req.query?.uuid;
   const uuid = Array.isArray(uuidParam) ? uuidParam[0] : uuidParam;
   ```
4. **Forwards to main handler:**
   ```typescript
   req.query = { ...req.query, uuid: uuid as string };
   const mainHandler = (await import('../status.js')).default;
   return mainHandler(req, res);
   ```
5. **Main handler uses `extractUUID(req)`** which finds it in `req.query.uuid`

## Complete Request Flow Example

### Example 1: Query Parameter
```
Request: GET /api/v1/supporters/status?uuid=550e8400-e29b-41d4-a716-446655440000

1. Vercel routes to: api/v1/supporters/status.ts
2. extractUUID(req) finds: req.query.uuid = "550e8400-e29b-41d4-a716-446655440000"
3. validateUUID() checks format ✅
4. Rate limiting checks UUID-based limit
5. Database query: db.supporters.findOne({ uuid: "550e8400-e29b-41d4-a716-446655440000" })
6. Returns JSON response
```

### Example 2: Path Parameter
```
Request: GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000

1. Vercel routes to: api/v1/supporters/status/[...uuid].ts (catch-all)
2. Catch-all handler extracts: req.query.uuid[0] = "550e8400-e29b-41d4-a716-446655440000"
3. Forwards to: api/v1/supporters/status.ts
4. extractUUID(req) finds: req.query.uuid = "550e8400-e29b-41d4-a716-446655440000"
5. validateUUID() checks format ✅
6. Rate limiting checks UUID-based limit
7. Database query: db.supporters.findOne({ uuid: "550e8400-e29b-41d4-a716-446655440000" })
8. Returns JSON response
```

## Rate Limiting with UUID

The rate limiter uses the UUID to track requests per player:

```typescript
const uuid = extractUUID(req);
const uuidRateLimit = checkRateLimit(getIdentifier(req, 'uuid'), {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
});
```

**Rate limit identifier:**
- Format: `uuid:550e8400-e29b-41d4-a716-446655440000`
- Tracks: 10 requests per minute per UUID
- Prevents: Individual players from spamming the API

## Error Handling

If UUID is missing or invalid:

```typescript
const uuid = extractUUID(req);
const uuidValidation = validateUUID(uuid);

if (!uuidValidation.valid) {
  return res.status(400).json({
    error: uuidValidation.error || 'Invalid UUID format',
    code: 'INVALID_UUID',
  });
}
```

**Possible errors:**
- `UUID is required` - No UUID found in request
- `Invalid UUID format` - UUID doesn't match regex pattern

## Why This Design?

1. **Flexibility** - Supports both query params and path params
2. **Compatibility** - Works with different client implementations
3. **Robustness** - Multiple fallback methods ensure UUID is found
4. **RESTful** - Path parameters look cleaner in URLs
5. **Backwards Compatible** - Query params still work

## Testing Different Methods

```bash
# Method 1: Query parameter
curl "http://localhost:3000/api/v1/supporters/status?uuid=550e8400-e29b-41d4-a716-446655440000"

# Method 2: Path parameter (RESTful)
curl "http://localhost:3000/api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000"

# Both work! ✅
```

## Summary

- **UUID can come from:** Query param, path param, or URL parsing
- **Validation:** Regex pattern ensures correct format
- **Routing:** Catch-all routes handle path parameters
- **Rate limiting:** Uses UUID to track per-player limits
- **Error handling:** Clear error messages for invalid UUIDs

The system is designed to be flexible and robust, working with whatever method the Minecraft mod uses to send the UUID!

