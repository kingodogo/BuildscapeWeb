# Ko-fi Admin Panel Setup

## Overview

The Ko-fi Admin Panel provides comprehensive management for subscription tiers, subscriber tracking, and manual reward distribution.

## Features

### 1. Tiers Management
- Create and edit subscription tiers
- Configure rewards for each tier (items, commands, permissions, custom)
- Set priority levels
- Configure duration (permanent or subscription-based)
- Match tiers to Ko-fi tier names

### 2. Subscribers View
- View all users with active subscriptions
- See Minecraft link status (✓ or ✗)
- View tier information and payment dates
- Refresh subscriber list

### 3. Manual Rewards
- Grant rewards to specific players
- Add reasons for manual rewards
- Track granted status
- Support for items, commands, permissions, and custom rewards

## API Endpoints Needed

### GET /api/kofi-rewards
Returns all manual rewards

### POST /api/kofi-rewards
Save a new manual reward
Body: { reward: ManualReward }

### GET /api/kofi-rewards?userId=<userId>
Get manual rewards for a specific user

### GET /api/auth?action=getTierRewards&uuid=<minecraft-uuid>
**For Minecraft Mod Integration**
Returns the rewards a player should receive based on their subscription tier

Response:
```json
{
  "hasSubscription": true,
  "tier": {
    "id": "tier-id",
    "name": "Gold",
    "rewards": [
      {
        "type": "item",
        "itemId": "minecraft:diamond",
        "itemCount": 10,
        "displayName": "10 Diamonds"
      }
    ]
  },
  "manualRewards": [
    {
      "id": "reward-id",
      "rewards": [...]
    }
  ]
}
```

## Mod Integration

The Minecraft mod should:
1. Call `GET /api/auth?action=getTierRewards&uuid=<uuid>` on player join
2. Process tier rewards if player has active subscription
3. Process manual rewards that haven't been granted yet
4. Mark manual rewards as granted after processing

