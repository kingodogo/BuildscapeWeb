# Ko-fi Integration Setup Guide

This guide explains how to set up Ko-fi webhooks to enable in-game rewards for subscribers.

## Overview

When players purchase a Ko-fi subscription, Ko-fi automatically sends a webhook notification to your server. The system matches the subscription to the user's website account using their Ko-fi username. The Minecraft mod can then check if a player has an active subscription and grant rewards accordingly.

## Setup Steps

### 1. Configure Environment Variables

Add the following environment variable to your Vercel project:

- `KOFI_VERIFICATION_TOKEN` (optional but recommended): The verification token from your Ko-fi webhook settings. This ensures only legitimate webhooks from Ko-fi are processed.

To get your verification token:
1. Go to your Ko-fi account settings
2. Navigate to "Webhooks" section
3. Create a new webhook
4. Copy the verification token shown

### 2. Set Up Ko-fi Webhook

1. Log in to your Ko-fi account
2. Go to **Account Settings** → **Webhooks**
3. Click **Add Webhook**
4. Set the **Webhook URL** to:
   ```
   https://your-domain.com/api/kofi-webhook
   ```
   Replace `your-domain.com` with your actual domain (e.g., `buildscape-tracker.vercel.app`)

5. Copy the **Verification Token** and add it to your Vercel environment variables as `KOFI_VERIFICATION_TOKEN`

6. Save the webhook

### 3. How It Works

#### Automatic Linking
1. **User links their Ko-fi username** in their profile (Profile → Link Accounts → Ko-fi Account Linking)
2. **User subscribes on Ko-fi** - When they make a payment, Ko-fi automatically sends a webhook POST request to your server
3. **Webhook processing**:
   - Ko-fi sends payment data including the `from_name` field (Ko-fi username)
   - Your server receives the webhook at `/api/kofi-webhook`
   - The system matches the `from_name` to the `kofiUsername` stored in your database
   - If a match is found, the subscription is automatically linked and activated
4. **Result**: The user's profile immediately shows their active subscription status

**Important**: Users must enter their Ko-fi username in their profile before subscribing, so the system can match payments to their account.

#### Subscription Tracking
The system tracks:
- Active subscription status
- Subscription tier name (if using membership tiers)
- Payment amount and currency
- Last payment date
- Next payment date (for monthly subscriptions)

#### Display in Profile
- Users can see their subscription status in their Profile page
- Shows tier name, payment amount, and payment dates
- Displays a message confirming they'll receive in-game rewards

### 4. Minecraft Mod Integration

Your Minecraft mod can check if a player has an active subscription using the API endpoint:

**Endpoint:** `GET /api/auth?action=checkSubscription&uuid=<minecraft-uuid>`

**Example Request:**
```
GET https://your-domain.com/api/auth?action=checkSubscription&uuid=550e8400e29b41d4a716446655440000
```

**Response (Active Subscription):**
```json
{
  "hasSubscription": true,
  "subscription": {
    "isActive": true,
    "tierName": "Bronze",
    "lastPaymentDate": 1702540800000,
    "nextPaymentDate": 1705132800000,
    "amount": "5.00",
    "currency": "USD"
  },
  "userId": "user-id",
  "username": "player-username",
  "minecraftUsername": "MinecraftPlayer"
}
```

**Response (No Subscription):**
```json
{
  "hasSubscription": false,
  "subscription": null,
  "userId": "user-id",
  "username": "player-username",
  "minecraftUsername": "MinecraftPlayer"
}
```

### 5. Example Mod Code (Java)

```java
public boolean hasActiveSubscription(UUID playerUuid) {
    try {
        String uuidString = playerUuid.toString().replace("-", "");
        URL url = new URL("https://your-domain.com/api/auth?action=checkSubscription&uuid=" + uuidString);
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
            
            // Parse JSON (use Gson, Jackson, or similar)
            JSONObject json = new JSONObject(response.toString());
            return json.getBoolean("hasSubscription");
        }
        
        return false;
    } catch (Exception e) {
        e.printStackTrace();
        return false;
    }
}

@EventHandler
public void onPlayerJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    UUID uuid = player.getUniqueId();
    
    if (hasActiveSubscription(uuid)) {
        // Grant rewards to subscriber
        player.sendMessage("Welcome back, subscriber! You have special rewards!");
        // Give items, apply effects, etc.
    }
}
```

## Payment Types Supported

- **Donation**: One-time donations
- **Subscription**: Monthly subscriptions (recurring payments)
- **Commission**: Commission payments
- **Shop Order**: Shop purchases

## Webhook Security

The webhook endpoint:
- Verifies the `verification_token` matches your configured token (if set)
- Returns HTTP 200 to prevent infinite retries (even for errors)
- Logs all webhook events for debugging
- Stores payment history in the `kofi_payments` collection

## Testing

1. Use a service like [webhook.site](https://webhook.site) to test webhook URLs
2. Make a test donation/subscription on Ko-fi
3. Check your Vercel function logs to see webhook processing
4. Verify the user's profile shows the subscription status

## Troubleshooting

### Webhook Not Working
- Check Vercel function logs for errors
- Verify the webhook URL is correct and publicly accessible
- Ensure environment variables are set correctly
- Check that emails match between Ko-fi and website accounts

### Subscription Not Showing
- Verify the user entered their Ko-fi username correctly in their profile (must match exactly, case-insensitive)
- Check that the webhook was received (check Vercel function logs)
- Ensure the payment type is Subscription or Donation
- Check that `is_subscription_payment` is true for recurring subscriptions
- Verify the Ko-fi username in the webhook `from_name` field matches the user's linked username

### Mod Can't Verify Subscription
- Ensure the player has linked their Minecraft account in their profile
- Verify the UUID format (with or without dashes, both work)
- Check API endpoint URL is correct
- Verify the user has an active subscription in their profile

## Notes

- Subscriptions are linked automatically based on **username matching** (from the `from_name` field in the webhook)
- Users **must link their Ko-fi username** in their profile before subscribing for automatic linking to work
- The system handles both one-time donations and recurring subscriptions
- Payment history is stored in the `kofi_payments` collection for audit purposes
- Multiple payments from the same Ko-fi username will update the existing subscription link
- Username matching is case-insensitive (automatically normalized to lowercase)

## How Subscription Detection Works

### Step-by-Step Flow:

1. **User Setup**:
   - User creates account on your website
   - User goes to Profile → Link Accounts tab
   - User enters their Ko-fi username and clicks "Link Ko-fi Account"
   - Username is stored in the database as `kofiUsername`

2. **User Subscribes on Ko-fi**:
   - User visits your Ko-fi page
   - User selects a subscription tier and completes payment
   - Ko-fi processes the payment

3. **Ko-fi Sends Webhook**:
   - Ko-fi automatically sends a POST request to `https://your-domain.com/api/kofi-webhook`
   - Webhook payload includes:
     - `from_name`: The Ko-fi username of the person who paid
     - `type`: "Subscription" or "Donation"
     - `is_subscription_payment`: true/false
     - `amount`, `currency`, `tier_name`, etc.

4. **Your Server Processes Webhook**:
   - Server receives webhook at `/api/kofi-webhook`
   - Extracts `from_name` (Ko-fi username) from webhook data
   - Normalizes username to lowercase for matching
   - Searches database for user with matching `kofiUsername`
   - If found, updates their subscription status:
     - Sets `kofiSubscription.isActive = true`
     - Stores tier name, amount, payment dates
     - Calculates next payment date for recurring subscriptions

5. **User Sees Updated Status**:
   - User refreshes their profile page
   - Subscription status now shows as "Active"
   - Displays tier name, amount, and payment dates

6. **Minecraft Mod Integration**:
   - Mod calls: `GET /api/auth?action=checkSubscription&uuid=<minecraft-uuid>`
   - API checks if user with that Minecraft UUID has active subscription
   - Returns subscription status to mod
   - Mod grants rewards accordingly

