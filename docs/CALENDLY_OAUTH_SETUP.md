# Calendly OAuth 2.0 Integration Setup

This guide explains how to set up Calendly OAuth 2.0 integration for the Advicly platform.

## Overview

Calendly integration provides an alternative calendar source for users who cannot connect their Google Calendar due to workplace restrictions. The integration supports:

- **OAuth 2.0 Authentication** (Recommended) - Secure, user-friendly
- **API Token Authentication** - Manual setup option
- **Real-time Webhook Sync** - Automatic meeting updates
- **Single Active Connection** - Only one calendar source per user at a time

## Prerequisites

1. Calendly account with API access
2. Calendly OAuth application credentials
3. Backend deployed on Render
4. Frontend deployed on Cloudflare Pages

## Step 1: Create Calendly OAuth Application

### 1.1 Go to Calendly Developer Portal

1. Visit https://calendly.com/integrations/api_webhooks
2. Sign in with your Calendly account
3. Click "Create New App" or "OAuth Application"

### 1.2 Configure OAuth Application

**Application Details:**
- **Name**: Advicly
- **Description**: Financial advisor meeting management platform
- **Redirect URI**: `https://your-backend-domain.com/api/calendar/calendly/oauth/callback`
  - For production: `https://adviceapp-9rgw.onrender.com/api/calendar/calendly/oauth/callback`
  - For local dev: `http://localhost:3001/api/calendar/calendly/oauth/callback`

**Scopes Required:**
- `default` (Calendly uses a single default scope for all permissions)

### 1.3 Get Credentials

After creating the application, you'll receive:
- **Client ID**: `calendly_oauth_client_id_xxx`
- **Client Secret**: `calendly_oauth_client_secret_xxx`

Save these securely - you'll need them for environment variables.

## Step 2: Configure Environment Variables

### Backend (Render)

Add these environment variables to your Render service dashboard:

```bash
# Calendly OAuth Configuration
CALENDLY_OAUTH_CLIENT_ID=your_client_id_here
CALENDLY_OAUTH_CLIENT_SECRET=your_client_secret_here
CALENDLY_OAUTH_REDIRECT_URI=https://adviceapp-9rgw.onrender.com/api/calendar/calendly/oauth/callback

# Optional: Calendly Webhook Signing Key (for webhook verification)
CALENDLY_WEBHOOK_SIGNING_KEY=your_webhook_signing_key_here

# Optional: Personal Access Token (for fallback/testing)
CALENDLY_PERSONAL_ACCESS_TOKEN=your_personal_access_token_here
```

### Frontend (Cloudflare Pages)

No additional environment variables needed for Calendly OAuth on the frontend.

## Step 3: Set Up Calendly Webhooks

### 3.1 Configure Webhook Endpoint

1. Go to Calendly Settings → Integrations → Webhooks
2. Create a new webhook subscription
3. Set the webhook URL to: `https://your-backend-domain.com/api/calendly/webhook`
   - For production: `https://adviceapp-9rgw.onrender.com/api/calendly/webhook`

### 3.2 Subscribe to Events

Select these events:
- `invitee.created` - New meeting scheduled
- `invitee.updated` - Meeting details changed
- `invitee.canceled` - Meeting cancelled

### 3.3 Get Webhook Signing Key

1. After creating the webhook, Calendly will provide a signing key
2. Copy this key and add it to your environment variables as `CALENDLY_WEBHOOK_SIGNING_KEY`

## Step 4: Test the Integration

### 4.1 Test OAuth Flow

1. Go to Settings → Calendar Integrations
2. Click "Connect Calendly"
3. Choose "OAuth (Recommended)"
4. Click "Connect with Calendly OAuth"
5. You'll be redirected to Calendly to authorize
6. After authorization, you'll be redirected back to Settings

### 4.2 Test Webhook Sync

1. After connecting Calendly, go to Meetings page
2. You should see your Calendly meetings imported
3. Create a new meeting in Calendly
4. The webhook should automatically sync it to Advicly within seconds

### 4.3 Test Switching Between Calendars

1. Connect Google Calendar
2. Then connect Calendly
3. Verify that only Calendly is active (Google should be deactivated)
4. Switch back to Google Calendar
5. Verify that Calendly is deactivated

## Step 5: User Experience

### During Onboarding

Users can choose between:
1. **Google Calendar** - If their workplace allows it
2. **Calendly** - If Google Calendar is blocked

### In Settings

Users can:
- View current calendar connection status
- Switch between Google Calendar and Calendly
- Disconnect and reconnect calendars
- Choose between OAuth and API token methods for Calendly

## Troubleshooting

### OAuth Not Configured Error

**Error**: "Calendly OAuth not configured"

**Solution**: 
- Verify `CALENDLY_OAUTH_CLIENT_ID` and `CALENDLY_OAUTH_CLIENT_SECRET` are set in Render
- Check that the values are correct (no extra spaces)
- Restart the Render service

### Redirect URI Mismatch

**Error**: "redirect_uri_mismatch" during OAuth

**Solution**:
- Verify the redirect URI in Calendly matches exactly: `https://adviceapp-9rgw.onrender.com/api/calendar/calendly/oauth/callback`
- Check for trailing slashes or protocol mismatches
- Update in Calendly if needed

### Webhooks Not Syncing

**Error**: Meetings not appearing after webhook events

**Solution**:
- Verify webhook URL is publicly accessible
- Check webhook signing key is set correctly
- Review backend logs for webhook processing errors
- Test webhook endpoint: `GET /api/calendly/webhook/test`

### Only One Calendar Connection

**Expected Behavior**: When connecting a new calendar, the previous one is automatically deactivated

This is by design - Advicly supports only one active calendar source per user at a time.

## API Endpoints

### OAuth Endpoints

- `GET /api/calendar/calendly/auth` - Get OAuth authorization URL
- `GET /api/calendar/calendly/oauth/callback` - OAuth callback handler

### Calendar Settings Endpoints

- `GET /api/calendar-connections/calendly/auth-url` - Get OAuth URL (authenticated)
- `POST /api/calendar-connections/calendly` - Connect via API token (authenticated)

### Webhook Endpoints

- `POST /api/calendly/webhook` - Receive webhook events
- `GET /api/calendly/webhook/test` - Test webhook endpoint

### Sync Endpoints

- `POST /api/calendly/sync` - Manual sync (authenticated)
- `GET /api/calendly/status` - Check connection status (authenticated)

## Security Considerations

1. **OAuth Tokens**: Stored securely in `calendar_connections` table
2. **Webhook Verification**: Signature verification using `CALENDLY_WEBHOOK_SIGNING_KEY`
3. **Single Active Connection**: Prevents data conflicts from multiple sources
4. **User Isolation**: Each user's meetings are isolated via `user_id` in database

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs on Render
3. Verify all environment variables are set correctly
4. Test webhook endpoint accessibility

