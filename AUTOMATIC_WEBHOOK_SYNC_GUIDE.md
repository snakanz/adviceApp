# Automatic Webhook-Based Google Calendar Sync

## Overview

Your Google Calendar now syncs **automatically** using webhooks. No manual sync button needed!

## How It Works

### 1. Connection Setup
```
User connects Google Calendar in Settings
    ↓
Backend creates calendar_connections entry with OAuth tokens
    ↓
Backend automatically sets up Google Calendar webhook
    ↓
Google confirms webhook subscription
    ↓
✅ Automatic sync is now active
```

### 2. Real-Time Sync
```
User creates/edits/deletes event in Google Calendar
    ↓
Google sends webhook notification to Advicly backend
    ↓
Backend receives notification and syncs changed events
    ↓
Meetings database is updated automatically
    ↓
✅ Changes appear in Advicly instantly
```

### 3. Disconnection
```
User disconnects Google Calendar in Settings
    ↓
Backend stops the webhook subscription
    ↓
Google stops sending notifications
    ↓
✅ Sync is disabled
```

## What Gets Synced Automatically

✅ **Synced in Real-Time:**
- New meetings created in Google Calendar
- Meeting title/time changes
- Attendee changes
- Meeting deletions
- All changes within past 30 days to future

❌ **NOT Synced:**
- All-day events (unless they have specific times)
- Declined events
- Events outside the 30-day window

## Webhook Lifecycle

### Expiration & Renewal
- Google webhooks expire after **7 days maximum**
- Advicly automatically renews the webhook before expiration
- Renewal happens silently in the background
- No user action required

### Webhook Status
- Check webhook status in backend logs
- Webhook channel ID stored in `calendar_watch_channels` table
- Expiration timestamp tracked for renewal

## Database Schema

### calendar_watch_channels Table
```sql
CREATE TABLE calendar_watch_channels (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,           -- User who owns the webhook
  channel_id TEXT NOT NULL UNIQUE, -- Google's channel ID
  resource_id TEXT NOT NULL,       -- Google's resource ID
  expiration TIMESTAMP NOT NULL,   -- When webhook expires
  webhook_url TEXT NOT NULL,       -- Where Google sends notifications
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### calendar_connections Table
```sql
-- Stores OAuth tokens and connection metadata
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT,                   -- 'google', 'calendly', 'outlook'
  access_token TEXT,               -- OAuth access token
  refresh_token TEXT,              -- OAuth refresh token
  token_expires_at TIMESTAMP,      -- When token expires
  is_active BOOLEAN,               -- Only one active per user
  sync_enabled BOOLEAN,            -- User can toggle sync
  last_sync_at TIMESTAMP,          -- Last successful sync
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## API Endpoints

### Webhook Endpoint
**POST /api/calendar/webhook**
- Receives notifications from Google Calendar
- No authentication required (Google sends notifications)
- Automatically syncs changed events
- Returns 200 immediately (Google expects quick response)

### Setup Webhook
**POST /api/calendar/webhook/setup**
- Manually trigger webhook setup
- Requires authentication
- Called automatically on connection
- Can be called manually if webhook fails

### Stop Webhook
**POST /api/calendar/webhook/stop**
- Manually stop webhook
- Requires authentication
- Called automatically on disconnection
- Cleans up webhook subscription

### Test Webhook
**GET /api/calendar/webhook/test**
- Check if webhook endpoint is accessible
- No authentication required
- Returns webhook URL and instructions

## Troubleshooting

### Meetings Not Syncing
**Symptoms:** New meetings in Google Calendar don't appear in Advicly

**Causes & Fixes:**
1. **Google Calendar not connected**
   - Go to Settings → Calendar Integrations
   - Click "Connect Google Calendar"
   - Verify connection shows as active

2. **Webhook setup failed**
   - Check backend logs on Render dashboard
   - Look for "Setting up Google Calendar watch" messages
   - Try reconnecting Google Calendar

3. **Webhook expired**
   - Webhooks expire after 7 days
   - Should auto-renew, but check logs
   - Reconnect if renewal failed

4. **Sync disabled**
   - Check if sync is toggled off in Settings
   - Toggle sync on to enable automatic sync

### Webhook Not Receiving Notifications
**Symptoms:** Backend logs show webhook setup succeeded, but no notifications received

**Causes & Fixes:**
1. **Backend URL not accessible**
   - Verify `BACKEND_URL` environment variable is correct
   - Should be: `https://adviceapp-9rgw.onrender.com`
   - Check Render deployment is active

2. **Firewall/Network issues**
   - Google must be able to reach your backend
   - Check Render logs for incoming requests
   - Verify no IP restrictions

3. **Webhook channel ID mismatch**
   - Check `calendar_watch_channels` table
   - Verify channel_id matches Google's records
   - Try reconnecting to reset

### Duplicate Meetings
**Symptoms:** Same meeting appears multiple times

**Causes & Fixes:**
1. **Webhook fired multiple times**
   - Google sometimes sends duplicate notifications
   - Database has unique constraint on `googleeventid`
   - Duplicates should be prevented automatically

2. **Manual sync + webhook sync**
   - Old manual sync button could cause duplicates
   - Removed in latest version
   - Should not happen with webhook-only sync

## Performance

- **Sync Latency:** < 5 seconds from Google Calendar change to Advicly update
- **API Calls:** Only when calendar changes (no polling)
- **Database Load:** Minimal (only updates changed events)
- **Webhook Timeout:** 30 seconds (Google requirement)

## Security

- **Tokens:** Encrypted in Supabase database
- **Permissions:** Read-only access to calendar events
- **User Isolation:** Each user only syncs their own calendar
- **Row Level Security:** RLS policies enforce data isolation
- **Webhook Verification:** Channel ID verified before processing

## Disabling Automatic Sync

### Temporarily Disable
1. Go to Settings → Calendar Integrations
2. Toggle "Sync Enabled" off
3. Meetings won't sync until toggled back on

### Permanently Disconnect
1. Go to Settings → Calendar Integrations
2. Click "Disconnect" button
3. Webhook is automatically stopped
4. No more automatic syncs

## Re-Enabling After Disconnect

1. Go to Settings → Calendar Integrations
2. Click "Connect Google Calendar"
3. Complete OAuth flow
4. Webhook is automatically set up
5. Automatic sync resumes

## Webhook Renewal

### Automatic Renewal
- Webhooks expire after 7 days
- Advicly checks expiration daily
- Automatically renews before expiration
- No user action needed

### Manual Renewal
- Disconnect and reconnect Google Calendar
- This creates a new webhook subscription
- Old webhook is automatically stopped

## Monitoring

### Check Webhook Status
```sql
-- View active webhooks
SELECT 
  user_id,
  channel_id,
  expiration,
  created_at
FROM calendar_watch_channels
WHERE expiration > NOW()
ORDER BY expiration;

-- Check for expired webhooks
SELECT 
  user_id,
  channel_id,
  expiration
FROM calendar_watch_channels
WHERE expiration < NOW();
```

### Check Sync Status
```sql
-- View last sync time per user
SELECT 
  cc.user_id,
  cc.provider,
  cc.last_sync_at,
  cc.sync_enabled
FROM calendar_connections cc
WHERE cc.is_active = true;
```

## Support

If automatic sync isn't working:
1. Check Settings → Calendar Integrations (is it connected?)
2. Check backend logs on Render dashboard
3. Look for webhook setup/notification messages
4. Try reconnecting Google Calendar
5. Contact support with error details

## Technical Details

### Webhook Headers
Google sends these headers with each notification:
- `x-goog-channel-id` - Webhook channel ID
- `x-goog-resource-id` - Calendar resource ID
- `x-goog-resource-state` - 'sync', 'exists', or 'deleted'
- `x-goog-resource-uri` - Calendar URI

### Sync Logic
1. Receive webhook notification
2. Verify channel ID is valid
3. If state is 'exists': fetch changed events
4. Compare with database
5. Add new meetings, update existing ones
6. Update `last_sync_at` timestamp

### Error Handling
- Webhook failures don't break connection
- Sync errors logged but don't stop webhook
- Failed syncs can be retried manually
- Webhook auto-renews even if sync fails

