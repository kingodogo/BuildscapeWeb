# Buildscape Supporters API Setup Guide

This document explains how to set up and use the Supporters API endpoints for the Buildscape mod integration.

## API Endpoints

All endpoints are available under: `https://buildscape.online/api/v1/supporters`

### 1. GET `/api/v1/supporters/status/{uuid}`

Get supporter status for a player UUID.

**Example:**
```
GET /api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "connected": true,
  "username": "PlayerName",
  "tier": "Gold",
  "tierLevel": 3,
  "cosmetics": ["item:minecraft:diamond_sword", "block:minecraft:gold_block"]
}
```

### 2. GET `/api/v1/supporters/cosmetics/{uuid}`

Get cosmetics data (unlocked, locked, equipped) for a player UUID.

**Example:**
```
GET /api/v1/supporters/cosmetics/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "unlocked": [
    "item:minecraft:diamond_sword",
    "item:minecraft:golden_apple",
    "block:minecraft:gold_block"
  ],
  "locked": [],
  "equipped": [
    "item:minecraft:diamond_sword"
  ]
}
```

### 3. POST `/api/v1/supporters/connect/{uuid}`

Initiate account connection process.

**Example:**
```
POST /api/v1/supporters/connect/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "verificationCode": "ABC123" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection initiated. Please complete the process on the website."
}
```

### 4. GET `/api/v1/supporters/tiers`

Get all available membership tiers.

**Example:**
```
GET /api/v1/supporters/tiers
```

**Response:**
```json
{
  "tiers": [
    {
      "id": "bronze",
      "name": "Bronze Supporter",
      "level": 1,
      "description": "Basic supporter tier with access to bronze cosmetics"
    },
    {
      "id": "silver",
      "name": "Silver Supporter",
      "level": 2,
      "description": "Silver supporter tier with access to silver and bronze cosmetics"
    },
    {
      "id": "gold",
      "name": "Gold Supporter",
      "level": 3,
      "description": "Gold supporter tier with access to all cosmetics"
    }
  ]
}
```

## Database Setup

The API uses MongoDB collections in the `buildscape_tracker` database. You need to create the following collections:

### 1. `supporters` Collection

Stores supporter account information.

**Schema:**
```javascript
{
  uuid: String,           // Primary key, player UUID
  username: String,       // Optional, player username
  connected_at: Date,     // When account was connected
  tier: String,          // Tier ID (e.g., "bronze", "silver", "gold")
  tier_level: Number,    // Tier level (1, 2, 3)
  created_at: Date,
  updated_at: Date
}
```

**Index:**
```javascript
db.supporters.createIndex({ uuid: 1 }, { unique: true });
```

### 2. `cosmetic_unlocks` Collection

Stores unlocked cosmetics for each supporter.

**Schema:**
```javascript
{
  uuid: String,           // Player UUID
  cosmetic_id: String,    // Cosmetic ID (e.g., "item:minecraft:diamond_sword")
  unlocked_at: Date,
  source: String          // 'ko-fi', 'admin', 'tier', etc.
}
```

**Indexes:**
```javascript
db.cosmetic_unlocks.createIndex({ uuid: 1 });
db.cosmetic_unlocks.createIndex({ cosmetic_id: 1 });
db.cosmetic_unlocks.createIndex({ uuid: 1, cosmetic_id: 1 }, { unique: true });
```

### 3. `equipped_cosmetics` Collection

Stores currently equipped cosmetics for each supporter.

**Schema:**
```javascript
{
  uuid: String,           // Player UUID
  cosmetic_id: String,    // Cosmetic ID
  slot: String,          // Optional: 'head', 'chest', 'legs', 'feet', 'main_hand', etc.
  equipped_at: Date
}
```

**Indexes:**
```javascript
db.equipped_cosmetics.createIndex({ uuid: 1 });
db.equipped_cosmetics.createIndex({ uuid: 1, cosmetic_id: 1 }, { unique: true });
```

### 4. `support_tiers` Collection (Optional)

Stores custom tier definitions. If empty, default tiers are returned.

**Schema:**
```javascript
{
  id: String,            // Tier ID (e.g., "bronze")
  name: String,          // Display name
  level: Number,         // Tier level (1, 2, 3)
  description: String    // Tier description
}
```

**Index:**
```javascript
db.support_tiers.createIndex({ level: 1 });
```

### 5. `connection_codes` Collection

Stores temporary verification codes for account connection.

**Schema:**
```javascript
{
  uuid: String,          // Player UUID
  code: String,          // Verification code
  created_at: Date,
  expires_at: Date,      // Code expiration time
  used: Boolean,         // Whether code has been used
  used_at: Date          // When code was used
}
```

**Indexes:**
```javascript
db.connection_codes.createIndex({ uuid: 1, code: 1 });
db.connection_codes.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index
```

## MongoDB Setup Script

You can run this script in MongoDB shell or MongoDB Compass to set up the collections and indexes:

```javascript
// Connect to your database
use buildscape_tracker;

// Create indexes for supporters
db.supporters.createIndex({ uuid: 1 }, { unique: true });

// Create indexes for cosmetic_unlocks
db.cosmetic_unlocks.createIndex({ uuid: 1 });
db.cosmetic_unlocks.createIndex({ cosmetic_id: 1 });
db.cosmetic_unlocks.createIndex({ uuid: 1, cosmetic_id: 1 }, { unique: true });

// Create indexes for equipped_cosmetics
db.equipped_cosmetics.createIndex({ uuid: 1 });
db.equipped_cosmetics.createIndex({ uuid: 1, cosmetic_id: 1 }, { unique: true });

// Create indexes for support_tiers
db.support_tiers.createIndex({ level: 1 });

// Create indexes for connection_codes
db.connection_codes.createIndex({ uuid: 1, code: 1 });
db.connection_codes.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Insert default tiers (optional)
db.support_tiers.insertMany([
  {
    id: "bronze",
    name: "Bronze Supporter",
    level: 1,
    description: "Basic supporter tier with access to bronze cosmetics"
  },
  {
    id: "silver",
    name: "Silver Supporter",
    level: 2,
    description: "Silver supporter tier with access to silver and bronze cosmetics"
  },
  {
    id: "gold",
    name: "Gold Supporter",
    level: 3,
    description: "Gold supporter tier with access to all cosmetics"
  }
]);
```

## Rate Limiting

The API implements rate limiting:

- **Per UUID**: 10 requests per minute
- **Per IP**: 100 requests per minute
- **Global**: 1000 requests per minute

When rate limit is exceeded, the API returns:
- Status: `429 Too Many Requests`
- Header: `Retry-After: <seconds>`

## CORS Configuration

The API allows requests from:
- All origins (`Access-Control-Allow-Origin: *`)
- User-Agent: `BuildScape-Mod/1.0` (checked server-side if needed)

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_UUID` - Invalid UUID format
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `DATABASE_NOT_CONFIGURED` - MongoDB URI not set
- `METHOD_NOT_ALLOWED` - HTTP method not allowed
- `INTERNAL_ERROR` - Server error

## Testing

### Test with cURL

```bash
# Get supporter status
curl https://buildscape.online/api/v1/supporters/status/550e8400-e29b-41d4-a716-446655440000

# Get cosmetics
curl https://buildscape.online/api/v1/supporters/cosmetics/550e8400-e29b-41d4-a716-446655440000

# Get tiers
curl https://buildscape.online/api/v1/supporters/tiers

# Initiate connection
curl -X POST https://buildscape.online/api/v1/supporters/connect/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json"
```

### Test with Minecraft Mod

The mod should make requests to these endpoints using the player's UUID. The mod handles:
- UUID extraction from Minecraft player
- Request formatting
- Response parsing
- Error handling

## Security Notes

1. **No Authentication Required**: All endpoints are public (authentication handled server-side via UUID)
2. **Rate Limiting**: Prevents abuse
3. **UUID Validation**: All UUIDs are validated before processing
4. **HTTPS Only**: All endpoints should use HTTPS in production
5. **Input Sanitization**: All inputs are validated and sanitized

## Environment Variables

Make sure these are set in your Vercel project:

- `MONGODB_URI` or `BuildScape_MONGODB_URI` - MongoDB connection string

## Deployment

The API endpoints are automatically deployed with your Vercel project. Make sure:

1. MongoDB URI is configured in Vercel environment variables
2. Database collections and indexes are created
3. Default tiers are inserted (optional)

## Support

For issues or questions, contact the Buildscape mod developer.

