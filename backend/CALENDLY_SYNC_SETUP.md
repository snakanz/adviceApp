# Calendly Automatic Sync Setup

This document explains the Calendly integration and automatic sync functionality in the Advicly platform.

## Overview

The Calendly integration provides three methods for keeping meetings synchronized:

1. **Automatic Periodic Sync** - Background scheduler that syncs every 15 minutes
2. **Manual Sync** - User-triggered sync via UI button
3. **Real-time Webhooks** - Instant updates when meetings are created/cancelled (optional)

## Features

### ✅ Automatic Periodic Sync (NEW)

- **Frequency**: Every 15 minutes
- **Scope**: Syncs all Calendly meetings for all users
- **Auto-start**: Starts automatically when backend server launches
- **Time Range**: 2 years back, 1 year forward
- **Handles**: New meetings, updated meetings, cancelled meetings

### ✅ Manual Sync

- **Trigger**: "Sync Calendly" button in UI
- **Scope**: Syncs meetings for the current user
- **Use Case**: Immediate sync when needed

### ✅ Real-time Webhooks (Optional)

- **Trigger**: Calendly sends webhook when events occur
- **Events**: Meeting created, meeting cancelled
- **Latency**: Near-instant updates
- **Setup Required**: Yes (see below)

## Configuration

### Required Environment Variables

```bash
# Required for all sync methods
CALENDLY_PERSONAL_ACCESS_TOKEN=your_calendly_token_here

# Optional - only needed for webhook verification
CALENDLY_WEBHOOK_SIGNING_KEY=your_webhook_signing_key_here
```

### Getting Your Calendly Personal Access Token

1. Log in to your Calendly account
2. Go to **Integrations** > **API & Webhooks**
3. Click **Generate New Token**
4. Copy the token and add it to your `.env` file

## Automatic Sync Scheduler

### How It Works

The scheduler service (`backend/src/services/syncScheduler.js`) runs automatically when the backend starts:

1. Server starts
2. After 5 seconds, scheduler initializes
3. Every 15 minutes, scheduler:
   - Fetches all users from database
   - For each user, syncs Calendly meetings
   - Logs results to console

### Monitoring

Check backend logs for sync activity:

```
🔄 [Scheduled Sync] Starting automatic Calendly sync...
📊 [Scheduled Sync] Found 1 user(s) to sync
  🔄 Syncing for user 1 (user@example.com)...
  ✅ User 1: 3 new, 2 updated
✅ [Scheduled Sync] Completed: 3 new, 2 updated, 0 errors
⏰ Next sync in 15 minutes
```

### API Endpoints

#### Check Scheduler Status

```bash
GET /api/calendly/scheduler/status
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "scheduler": {
    "isRunning": true,
    "scheduledTasks": [
      {
        "name": "Calendly Sync",
        "schedule": "Every 15 minutes"
      }
    ],
    "calendlyConfigured": true
  }
}
```

#### Manually Trigger Sync

```bash
POST /api/calendly/scheduler/trigger
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "message": "Automatic sync triggered in background"
}
```

## Webhook Setup (Optional)

Webhooks provide real-time updates when meetings are created or cancelled in Calendly.

### Setup Instructions

1. **Get Webhook URL**
   ```bash
   GET /api/calendly/webhook/test
   ```
   This returns your webhook URL and setup instructions.

2. **Configure in Calendly**
   - Go to Calendly **Integrations** > **Webhooks**
   - Click **Create Webhook**
   - Set **Webhook URL** to: `https://your-backend-url.com/api/calendly/webhook`
   - Subscribe to events:
     - `invitee.created` - When someone books a meeting
     - `invitee.canceled` - When a meeting is cancelled
   - Copy the **Signing Key**

3. **Add Signing Key to Environment**
   ```bash
   CALENDLY_WEBHOOK_SIGNING_KEY=your_signing_key_here
   ```

4. **Test Webhook**
   - Book a test meeting in Calendly
   - Check backend logs for webhook receipt
   - Verify meeting appears in database

### Webhook Events Handled

| Event | Description | Action |
|-------|-------------|--------|
| `invitee.created` | New meeting booked | Creates meeting in database |
| `invitee.canceled` | Meeting cancelled | Marks meeting as deleted |

### Webhook Security

- All webhooks are verified using HMAC-SHA256 signatures
- Invalid signatures are rejected with 401 status
- If signing key is not configured, verification is skipped (development only)

## Sync Behavior

### What Gets Synced

- **Meeting Title**: Event name from Calendly
- **Start/End Time**: Meeting schedule
- **Attendees**: Client email and name
- **Location**: Meeting location (Zoom, phone, etc.)
- **Status**: Active or cancelled

### Duplicate Prevention

- Meetings are identified by `calendly_event_uuid`
- Existing meetings are updated, not duplicated
- Unique constraint prevents duplicate inserts

### Deletion Handling

When a meeting is cancelled in Calendly:
- Meeting is marked as `is_deleted: true`
- `sync_status` set to `'deleted'`
- Meeting remains in database for historical records
- Not shown in UI by default

### Client Extraction

After syncing meetings, the system automatically:
1. Extracts client emails from meeting attendees
2. Creates or links client records
3. Associates meetings with clients

## Troubleshooting

### Sync Not Working

1. **Check Token Configuration**
   ```bash
   GET /api/calendly/status
   ```
   Should return `connected: true`

2. **Check Scheduler Status**
   ```bash
   GET /api/calendly/scheduler/status
   ```
   Should return `isRunning: true`

3. **Check Backend Logs**
   Look for error messages in console output

4. **Manually Trigger Sync**
   ```bash
   POST /api/calendly/sync
   ```
   Check response for errors

### No Meetings Appearing

1. **Verify Time Range**
   - Scheduler syncs 2 years back, 1 year forward
   - Meetings outside this range won't sync

2. **Check Meeting Status**
   - Only `active` meetings are synced
   - Cancelled meetings are marked as deleted

3. **Database Query**
   ```sql
   SELECT * FROM meetings 
   WHERE meeting_source = 'calendly' 
   AND is_deleted IS NOT TRUE;
   ```

### Webhook Not Receiving Events

1. **Verify Webhook URL is Accessible**
   - Must be publicly accessible (not localhost)
   - Use ngrok for local testing

2. **Check Signing Key**
   - Ensure `CALENDLY_WEBHOOK_SIGNING_KEY` is set correctly
   - Key must match the one from Calendly

3. **Check Calendly Webhook Logs**
   - Go to Calendly Webhooks page
   - View delivery logs for errors

## Performance Considerations

### Sync Frequency

- **15 minutes** is a good balance between freshness and API usage
- Can be adjusted in `syncScheduler.js` (cron schedule)
- More frequent syncs increase API calls

### API Rate Limits

- Calendly API has rate limits (check their documentation)
- Scheduler spreads requests across users
- Webhook approach reduces API calls

### Database Impact

- Each sync queries existing meetings
- Indexes on `calendly_event_uuid` improve performance
- Consider archiving old meetings if database grows large

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Calendly Integration                     │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
         │  Scheduler  │ │ Manual │ │  Webhooks  │
         │  (15 min)   │ │  Sync  │ │ (Real-time)│
         └──────┬──────┘ └───┬────┘ └─────┬──────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ CalendlyService    │
                    │ - fetchEvents()    │
                    │ - syncToDatabase() │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Supabase Database │
                    │  meetings table    │
                    └────────────────────┘
```

## Files Modified/Created

### New Files
- `backend/src/services/syncScheduler.js` - Automatic sync scheduler
- `backend/CALENDLY_SYNC_SETUP.md` - This documentation

### Modified Files
- `backend/src/index.js` - Initialize scheduler on startup
- `backend/src/routes/calendly.js` - Added scheduler and webhook endpoints
- `backend/package.json` - Added `node-cron` dependency

## Future Enhancements

- [ ] Configurable sync frequency per user
- [ ] Sync status dashboard in UI
- [ ] Email notifications for sync failures
- [ ] Support for multiple Calendly accounts
- [ ] Bi-directional sync (create Calendly events from Advicly)

