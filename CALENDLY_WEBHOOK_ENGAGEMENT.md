# Calendly Webhook Engagement System

## Overview

This document describes how Advicly ensures Calendly webhooks are **always engaged** and working properly, whether users are logging in, logging out, or switching calendars.

## Architecture

### Components

1. **CalendlyWebhookManager** (`backend/src/services/calendlyWebhookManager.js`)
   - Verifies webhook is active in Calendly
   - Checks webhook subscription exists
   - Provides webhook status for UI display
   - Handles webhook setup instructions

2. **Auth Routes** (`backend/src/routes/auth.js`)
   - New endpoint: `POST /api/auth/verify-webhooks`
   - Called on user login to verify webhooks are active
   - Returns status for both Google Calendar and Calendly

3. **Calendar Settings Routes** (`backend/src/routes/calendar-settings.js`)
   - Enhanced webhook status checking
   - Uses CalendlyWebhookManager for detailed status
   - Provides real-time sync method (webhook vs polling)

4. **Frontend Auth Context** (`src/context/AuthContext.js`)
   - Calls webhook verification on login
   - Calls webhook verification on session restore
   - Logs webhook status for debugging

5. **Calendar Settings UI** (`src/components/CalendarSettings.js`)
   - Refreshes webhook status every 30 seconds
   - Shows real-time sync status (⚡ webhook or 🕐 polling)
   - Displays last sync timestamp

## User Flows

### Flow 1: User Logs In

```
1. User enters credentials/OAuth
   ↓
2. Supabase Auth completes
   ↓
3. Frontend AuthContext detects SIGNED_IN event
   ↓
4. Frontend calls POST /api/auth/verify-webhooks
   ↓
5. Backend checks:
   - Is Google Calendar active? → Verify webhook
   - Is Calendly active? → Verify webhook subscription
   ↓
6. Backend returns webhook status
   ↓
7. Frontend logs status (for debugging)
   ↓
8. User sees Calendar Settings with correct sync status
```

### Flow 2: User Logs Out

```
1. User clicks "Sign Out"
   ↓
2. Supabase Auth clears session
   ↓
3. Frontend detects SIGNED_OUT event
   ↓
4. Frontend clears auth state
   ↓
5. Webhooks remain active in Calendly (organization-level)
   ↓
6. Next login will re-verify webhooks
```

### Flow 3: User Switches Calendars

```
1. User clicks "Disconnect" on active calendar
   ↓
2. Backend deactivates calendar connection
   ↓
3. Frontend reloads connections
   ↓
4. User clicks "Connect" on new calendar
   ↓
5. Backend activates new calendar
   ↓
6. Backend triggers automatic sync
   ↓
7. Frontend refreshes webhook status
   ↓
8. User sees new calendar with correct sync status
```

## Webhook Status Determination

### Calendly Webhook Status

The system checks if Calendly webhook is active by:

1. **Checking Environment Variable**
   - `CALENDLY_WEBHOOK_SIGNING_KEY` must be set
   - This is the signing key from Calendly webhook subscription

2. **Verifying Webhook Subscription**
   - Calls Calendly API to list webhook subscriptions
   - Looks for subscription with our webhook URL
   - Confirms subscription exists and is active

3. **Fallback to Polling**
   - If webhook not found: uses 15-minute polling
   - Polling is automatic and transparent to user
   - UI shows "🕐 Polling sync (15 min)"

### Google Calendar Webhook Status

The system checks if Google Calendar webhook is active by:

1. **Checking calendar_watch_channels Table**
   - Queries for active watch channel for user
   - Checks expiration date (7 days max)
   - Verifies channel is still valid

2. **Fallback to Polling**
   - If webhook expired: uses polling until renewed
   - Renewal happens automatically in background
   - UI shows "🕐 Polling sync (15 min)" temporarily

## API Endpoints

### POST /api/auth/verify-webhooks

**Purpose:** Verify calendar webhooks are active on user login

**Request:**
```bash
POST /api/auth/verify-webhooks
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "user_id": "user-uuid",
  "webhooks": {
    "google": {
      "status": "active",
      "sync_method": "webhook",
      "message": "Google Calendar webhook is active"
    },
    "calendly": {
      "webhook_active": true,
      "sync_method": "webhook",
      "message": "Calendly webhook is active and syncing in real-time"
    }
  },
  "message": "Webhook verification completed"
}
```

### GET /api/calendar-connections/:id/webhook-status

**Purpose:** Get webhook status for a specific calendar connection

**Response:**
```json
{
  "success": true,
  "webhook_status": {
    "webhook_active": true,
    "sync_method": "webhook",
    "message": "Calendly webhook is active and syncing in real-time"
  }
}
```

## Frontend Behavior

### On Login
1. AuthContext detects SIGNED_IN or INITIAL_SESSION event
2. Calls `verifyWebhooksOnLogin(session)`
3. Sends POST request to `/api/auth/verify-webhooks`
4. Logs webhook status to console
5. User sees Calendar Settings with correct status

### On Calendar Settings Page
1. Component loads connections
2. Fetches webhook status for each connection
3. Displays status indicators:
   - ⚡ Real-time sync active (webhook working)
   - 🕐 Polling sync (15 min) (webhook not active)
4. Refreshes status every 30 seconds
5. Updates UI automatically

## Configuration

### Required Environment Variables

```bash
# Calendly webhook signing key (from Calendly dashboard)
CALENDLY_WEBHOOK_SIGNING_KEY=your_signing_key_here

# Backend URL (for webhook callbacks)
BACKEND_URL=https://adviceapp-9rgw.onrender.com

# Frontend URL (for redirects)
FRONTEND_URL=https://adviceapp.pages.dev
```

### Calendly Webhook Setup

1. Go to Calendly → Integrations → Webhooks
2. Click "Create Webhook"
3. Set URL to: `https://adviceapp-9rgw.onrender.com/api/calendly/webhook`
4. Subscribe to events:
   - `invitee.created`
   - `invitee.canceled`
   - `invitee.updated`
5. Copy the Signing Key
6. Add to environment: `CALENDLY_WEBHOOK_SIGNING_KEY=<key>`
7. Restart backend server

## Monitoring & Debugging

### Check Webhook Status

**Frontend Console:**
```javascript
// After login, check console for:
✅ Webhook verification completed: {...}
✅ Google Calendar webhook is active
✅ Calendly webhook is active
```

**Backend Logs:**
```
🔍 Verifying webhooks for user <id> on login...
✅ Google Calendar is active for user <id>
🔍 Calendly is connected for user <id>, verifying webhook...
✅ Calendly webhook verified active for user <id>
```

### Troubleshooting

**Issue:** Calendly showing "🕐 Polling sync (15 min)"

**Solutions:**
1. Check `CALENDLY_WEBHOOK_SIGNING_KEY` is set in environment
2. Verify webhook subscription exists in Calendly dashboard
3. Check webhook URL is correct: `https://adviceapp-9rgw.onrender.com/api/calendly/webhook`
4. Verify backend can reach Calendly API
5. Check backend logs for webhook verification errors

**Issue:** Webhook status not updating

**Solutions:**
1. Frontend refreshes every 30 seconds automatically
2. Manual refresh: Go to Calendar Settings and wait 30 seconds
3. Check browser console for errors
4. Check backend logs for API errors

## Testing

### Test Webhook Engagement

1. **Login Test**
   - Log in to Advicly
   - Check browser console for webhook verification
   - Should see "✅ Calendly webhook is active"

2. **Calendar Settings Test**
   - Go to Settings → Calendar Integrations
   - Should see "⚡ Real-time sync active" for Calendly
   - Wait 30 seconds, status should refresh

3. **New Meeting Test**
   - Add meeting to Calendly
   - Should appear in Advicly within 1-2 seconds
   - Webhook is working in real-time

4. **Logout/Login Test**
   - Log out
   - Log back in
   - Check console for webhook verification
   - Should confirm webhooks are still active

## Summary

Calendly webhooks are now **always engaged** through:

✅ **Automatic verification on login** - Confirms webhooks are active
✅ **Periodic status refresh** - Every 30 seconds in UI
✅ **Fallback to polling** - If webhook fails, automatic polling takes over
✅ **Transparent to user** - No manual intervention needed
✅ **Real-time sync** - Meetings appear within 1-2 seconds
✅ **Clear status indicators** - UI shows sync method (webhook vs polling)

The system is designed to be **reliable, automatic, and transparent**.

