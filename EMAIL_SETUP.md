# Email Setup Guide - Outlook SMTP

This guide explains how to configure the email system to use your Outlook email directly via SMTP.

## Quick Setup for Outlook

### 1. Get Your Outlook App Password

**Important:** You cannot use your regular Outlook password. You need to create an "App Password" for security.

1. Go to https://account.microsoft.com/security
2. Sign in with your Outlook/Microsoft account
3. Enable **Two-step verification** (if not already enabled)
4. Go to **Security** → **Advanced security options**
5. Under **App passwords**, click **Create a new app password**
6. Name it "Buildscape Tracker" or similar
7. Copy the generated password (you'll only see it once!)

### 2. Add Environment Variables

Add these to your `.env` file (for local development) or Vercel Environment Variables (for production):

```env
# Email Service Configuration
EMAIL_SERVICE=smtp

# Outlook SMTP Settings
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password-here
SMTP_FROM=your-email@outlook.com
SMTP_SECURE=false
```

### 3. Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_SERVICE` | Set to `smtp` or `outlook` | `smtp` |
| `SMTP_HOST` | Outlook SMTP server | `smtp-mail.outlook.com` |
| `SMTP_PORT` | Port number (587 for TLS, 465 for SSL) | `587` |
| `SMTP_USER` | Your Outlook email address | `you@outlook.com` |
| `SMTP_PASS` | Your App Password (NOT your regular password) | `abcd efgh ijkl mnop` |
| `SMTP_FROM` | Sender email (usually same as SMTP_USER) | `you@outlook.com` |
| `SMTP_SECURE` | `false` for TLS (port 587), `true` for SSL (port 465) | `false` |

### 4. For Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all the variables listed above
4. Make sure to select **Production**, **Preview**, and **Development** environments
5. Click **Save**
6. **Redeploy** your application for changes to take effect

## Alternative SMTP Providers

### Gmail
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_SECURE=false
```

**Note:** Gmail also requires an App Password. Get it from: https://myaccount.google.com/apppasswords

### Office 365 / Microsoft 365
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@yourdomain.com
SMTP_SECURE=false
```

### Custom SMTP Server
```env
EMAIL_SERVICE=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
SMTP_FROM=your-email@yourdomain.com
SMTP_SECURE=false
```

## Testing

After configuration, test the password reset feature:

1. Go to the login page
2. Click "Forgot Password?"
3. Enter an email address
4. Check your server logs (development) or email inbox (production)
5. You should receive a 6-digit verification code

## Troubleshooting

### "SMTP credentials not configured"
- Make sure all SMTP_* environment variables are set
- Check that `EMAIL_SERVICE=smtp` is set

### "Invalid login" or "Authentication failed"
- Make sure you're using an **App Password**, not your regular password
- For Outlook: Check that two-step verification is enabled
- Verify your email address is correct

### "Connection timeout"
- Check your SMTP_HOST and SMTP_PORT are correct
- Try port 465 with `SMTP_SECURE=true` if 587 doesn't work
- Some networks block SMTP ports - check firewall settings

### Emails going to spam
- This is normal for automated emails
- Consider using a dedicated email service (Resend/SendGrid) for better deliverability

## Security Notes

- **Never commit** your `.env` file to git
- Use **App Passwords** instead of your main password
- App Passwords are more secure and can be revoked individually
- Keep your App Password secret and rotate it periodically

## Development Mode

If you don't configure SMTP, the system will log emails to the console in development mode. This is useful for testing without sending real emails.

