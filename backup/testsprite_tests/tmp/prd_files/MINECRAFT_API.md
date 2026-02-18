# Minecraft Account Integration API

This document explains how to use the Minecraft account verification API from your Minecraft server to control player access based on linked accounts.

## Overview

Players can link their Minecraft accounts to their website accounts through the Profile page. Once linked, your Minecraft server can verify if a player's UUID is associated with any user account, allowing you to grant access only to specific players.

## API Endpoints

### Verify Player Access

Check if a Minecraft player UUID is linked to a user account.

**Endpoint:** `GET /api/auth?action=verifyPlayer&uuid=<minecraft-uuid>`

**Parameters:**
- `uuid` (required): Minecraft player UUID (with or without dashes)
  - Example with dashes: `550e8400-e29b-41d4-a716-446655440000`
  - Example without dashes: `550e8400e29b41d4a716446655440000`

**Response (Player Found):**
```json
{
  "verified": true,
  "user": {
    "id": "user-id",
    "username": "website-username",
    "role": "user",
    "minecraftUsername": "MinecraftPlayer",
    "minecraftUuid": "550e8400e29b41d4a716446655440000"
  }
}
```

**Response (Player Not Found):**
```json
{
  "verified": false,
  "error": "Player not found"
}
```

### Get All Linked Players

Get a list of all players who have linked their Minecraft accounts.

**Endpoint:** `GET /api/auth?action=getLinkedPlayers`

**Response:**
```json
{
  "players": [
    {
      "userId": "user-id-1",
      "websiteUsername": "player1",
      "minecraftUsername": "MinecraftPlayer1",
      "minecraftUuid": "550e8400e29b41d4a716446655440000",
      "role": "user"
    },
    {
      "userId": "user-id-2",
      "websiteUsername": "player2",
      "minecraftUsername": "MinecraftPlayer2",
      "minecraftUuid": "660e8400e29b41d4a716446655440001",
      "role": "admin"
    }
  ]
}
```

## Minecraft Server Integration Examples

### Bukkit/Spigot Plugin Example (Java)

```java
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;

public class AccountVerifier {
    private static final String API_BASE_URL = "https://your-domain.com/api/auth";
    
    public boolean verifyPlayer(UUID playerUuid) {
        try {
            // Normalize UUID (remove dashes)
            String uuidString = playerUuid.toString().replace("-", "");
            
            URL url = new URL(API_BASE_URL + "?action=verifyPlayer&uuid=" + uuidString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Content-Type", "application/json");
            
            int responseCode = conn.getResponseCode();
            
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                
                while ((line = in.readLine()) != null) {
                    response.append(line);
                }
                in.close();
                
                // Parse JSON response
                // You can use Gson, Jackson, or similar library
                // Check if "verified": true
                return parseResponse(response.toString());
            }
            
            return false;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}
```

### Plugin Usage Example

```java
@EventHandler
public void onPlayerJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    UUID uuid = player.getUniqueId();
    
    AccountVerifier verifier = new AccountVerifier();
    if (!verifier.verifyPlayer(uuid)) {
        player.kickPlayer("You must link your Minecraft account on the website first!");
        return;
    }
    
    // Player is verified, grant access
    // ... your code here ...
}
```

### Node.js/JavaScript Example

```javascript
const https = require('https');

async function verifyPlayer(uuid) {
    // Normalize UUID (remove dashes)
    const normalizedUuid = uuid.replace(/-/g, '');
    
    return new Promise((resolve, reject) => {
        const url = `https://your-domain.com/api/auth?action=verifyPlayer&uuid=${normalizedUuid}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.verified === true);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Usage
const playerUuid = '550e8400-e29b-41d4-a716-446655440000';
verifyPlayer(playerUuid)
    .then(verified => {
        if (verified) {
            console.log('Player is verified!');
        } else {
            console.log('Player not found or not linked');
        }
    })
    .catch(error => {
        console.error('Error verifying player:', error);
    });
```

### Python Example

```python
import requests
import uuid

def verify_player(minecraft_uuid):
    # Normalize UUID (remove dashes)
    normalized_uuid = str(minecraft_uuid).replace('-', '')
    
    url = f'https://your-domain.com/api/auth?action=verifyPlayer&uuid={normalized_uuid}'
    
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('verified', False)
        return False
    except Exception as e:
        print(f'Error verifying player: {e}')
        return False

# Usage
player_uuid = '550e8400-e29b-41d4-a716-446655440000'
if verify_player(player_uuid):
    print('Player is verified!')
else:
    print('Player not found or not linked')
```

## User Account Linking

Users link their accounts through the website:

1. Log in to the website
2. Navigate to Profile settings
3. Enter their Minecraft username in the "Minecraft Account" section
4. Click "Link Minecraft Account"
5. The system verifies the username via Mojang API and links the UUID

Once linked, the server can verify the player's access using the API endpoints above.

## Error Handling

- **404 Not Found**: Player UUID is not linked to any account
- **400 Bad Request**: Invalid UUID format
- **500 Internal Server Error**: Server error, retry later
- **503 Service Unavailable**: Database not configured

Always handle these cases gracefully in your server plugin/script.

## Security Considerations

- The verification endpoint is public and does not require authentication
- Consider implementing rate limiting on your server side
- Consider caching verification results to reduce API calls
- Use HTTPS to protect player data in transit

## Notes

- UUIDs are stored and compared without dashes internally
- The API accepts UUIDs with or without dashes
- Minecraft usernames are resolved to UUIDs via Mojang API when linking
- If a Minecraft username changes, the UUID remains the same and the link persists
- Only one website account can be linked to each Minecraft UUID

## Subscription Checking

In addition to verifying player access, you can also check if a player has an active Ko-fi subscription:

**Endpoint:** `GET /api/auth?action=checkSubscription&uuid=<minecraft-uuid>`

See `KOFI_SETUP.md` for detailed information about Ko-fi integration and subscription checking.

