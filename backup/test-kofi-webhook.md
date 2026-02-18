# Testing Ko-fi Webhook

## Method 1: Quick Endpoint Test (Manual POST Request)

Test if your endpoint is accessible and responds correctly:

### Using curl (PowerShell):
```powershell
$body = @{
    data = '{"verification_token":"test","message_id":"test-123","timestamp":"2024-01-01T00:00:00Z","type":"Donation","is_public":true,"from_name":"TestUser","message":"Test","amount":"5.00","url":"","email":"test@example.com","currency":"USD","is_subscription_payment":false,"is_first_subscription_payment":false,"kofi_transaction_id":"test-123","shop_items":null,"tier_name":null,"shipping":null}'
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://buildscape.online/api/kofi-webhook" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```

### Using a REST client (Postman/Insomnia):
- **URL**: `https://buildscape.online/api/kofi-webhook`
- **Method**: POST
- **Headers**: `Content-Type: application/x-www-form-urlencoded`
- **Body** (form-urlencoded):
  ```
  data={"verification_token":"test","message_id":"test-123","timestamp":"2024-01-01T00:00:00Z","type":"Donation","is_public":true,"from_name":"TestUser","message":"Test","amount":"5.00","url":"","email":"test@example.com","currency":"USD","is_subscription_payment":false,"is_first_subscription_payment":false,"kofi_transaction_id":"test-123","shop_items":null,"tier_name":null,"shipping":null}
  ```

**Expected Response**: Should return a JSON response (even if it's an error, it should respond)

## Method 2: Use Webhook.site (Recommended for Testing)

1. Go to https://webhook.site
2. Copy the unique URL they provide (e.g., `https://webhook.site/unique-id`)
3. Temporarily set this URL in your Ko-fi webhook settings
4. Make a test donation/subscription on Ko-fi
5. Check webhook.site to see if Ko-fi sent the webhook
6. Once confirmed, switch back to `https://buildscape.online/api/kofi-webhook`

## Method 3: Real Test with Your Account

1. **Link your Ko-fi username in your profile**:
   - Log into your website account
   - Go to Profile → Link Accounts tab
   - Enter your Ko-fi username and click "Link Ko-fi Account"

2. **Make a test donation/subscription**:
   - Go to your Ko-fi page
   - Make a small test donation or subscription
   - Ko-fi will automatically send a webhook to your server

3. **Check Vercel logs**:
   - Go to your Vercel dashboard
   - Navigate to your project → Functions → `kofi-webhook`
   - Check the logs for:
     - `Updated subscription for user...` (success)
     - `No user found for Ko-fi username...` (username mismatch)
     - `Invalid Ko-fi verification token` (token mismatch)
     - Any error messages

4. **Verify in your profile**:
   - Refresh your profile page
   - Check if subscription status shows as "Active"
   - Should display tier name, amount, and payment dates

## Method 4: Check Database Directly

If you have database access, check:
- `users` collection: Look for your user document and check `kofiSubscription.isActive`
- `kofi_payments` collection: Should have a new entry with payment details

## Common Issues to Check

### ✅ Endpoint is accessible
- Test with Method 1 above
- Should return a response (even if error)

### ✅ Verification token matches
- Check Vercel environment variable `KOFI_VERIFICATION_TOKEN`
- Must match the token shown in Ko-fi webhook settings
- If mismatch, you'll see "Invalid verification token" in logs

### ✅ Username matches
- Your Ko-fi username (from Ko-fi profile) must match what you entered in your website profile
- Matching is case-insensitive
- Check Vercel logs for "No user found for Ko-fi username..."

### ✅ Webhook URL in Ko-fi
- Must be exactly: `https://buildscape.online/api/kofi-webhook`
- No trailing slash
- Must be HTTPS (not HTTP)

## What Success Looks Like

1. **In Vercel logs**: `Updated subscription for user [userId] ([username]) - Tier: [tier], Amount: [amount] [currency]`
2. **In your profile**: Subscription status shows as "Active" with tier details
3. **In database**: `kofiSubscription.isActive = true` in your user document
4. **Response**: Webhook returns `{"success": true, "message": "Subscription updated", "userId": "..."}`

