# Why Meetings Are Not Showing - Diagnosis

## The Problem

User `snaka1003@gmail.com` is authenticated but meetings are not appearing in the Meetings page.

## Root Causes Identified

### 1. **Token Expiration Issue** ⚠️ CRITICAL
```
❌ Token expired
❌ Token verification failed: Token expired
```

**What's happening:**
- Frontend is sending an expired JWT token
- Backend rejects the request
- Meetings endpoint returns 401 Unauthorized
- Frontend shows empty meetings list

**Why this is challenging:**
- Token expires after 24 hours
- Frontend doesn't automatically refresh expired tokens
- User needs to log out and log back in to get a new token
- No automatic token refresh mechanism in place

### 2. **No Initial Sync Completed**

The webhook setup requires the database migration to be run first. If migration wasn't run:
- `calendar_watch_channels` table doesn't exist or has wrong schema
- Webhook setup fails silently
- No meetings are synced from Google Calendar
- Database is empty for this user

### 3. **Webhook Never Triggered**

Even if webhook is set up, it only syncs when:
- Google Calendar events change
- Webhook notification is received
- Initial sync must happen on connection

If user just connected Google Calendar:
- Webhook is set up but hasn't received any notifications yet
- No meetings in database
- "Last sync: Never" shows in Settings

## How to Diagnose

### Step 1: Check Token Status
```javascript
// In browser console:
localStorage.getItem('jwt')
// If this is empty or very old, token is expired
```

### Step 2: Check Database for Meetings
```sql
-- In Supabase SQL Editor:
SELECT COUNT(*) as total_meetings
FROM meetings
WHERE userid = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';

-- Check by source:
SELECT meeting_source, COUNT(*) as count
FROM meetings
WHERE userid = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
GROUP BY meeting_source;

-- Check webhook channels:
SELECT * FROM calendar_watch_channels
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```

### Step 3: Check Backend Logs
Look for these messages:
- ✅ "Setting up Google Calendar watch" - Webhook setup succeeded
- ✅ "Initial sync completed" - Meetings were fetched
- ❌ "Webhook setup failed" - Something went wrong
- ❌ "Token expired" - Authentication issue

## Solutions

### Solution 1: Fix Token Expiration (IMMEDIATE)
```
1. Log out of Advicly
2. Log back in with Google
3. New JWT token will be created (valid for 24 hours)
4. Meetings should now load
```

### Solution 2: Verify Database Migration
```
1. Go to Supabase SQL Editor
2. Run: SELECT * FROM calendar_watch_channels LIMIT 1;
3. If table doesn't exist or has INTEGER user_id:
   - Run migration 025_update_calendar_watch_channels_for_uuid.sql
4. Reconnect Google Calendar
```

### Solution 3: Trigger Initial Sync
```
1. Go to Settings → Calendar Integrations
2. Click "Disconnect"
3. Click "Connect Google Calendar"
4. Complete OAuth flow
5. Wait 10-15 seconds for initial sync
6. Check "Last sync" timestamp
```

### Solution 4: Check Backend Logs
```
1. Go to Render dashboard
2. Check backend logs for errors
3. Look for webhook setup messages
4. Look for sync completion messages
```

## Why This Is Challenging

### 1. **Multiple Systems Involved**
- Frontend (Cloudflare Pages)
- Backend (Render)
- Database (Supabase)
- Google Calendar API
- Webhooks (Google → Backend)

Each system can fail independently.

### 2. **Token Management**
- JWT tokens expire after 24 hours
- No automatic refresh mechanism
- User must manually log out/in
- Frontend doesn't handle expired tokens gracefully

### 3. **Async Webhook Setup**
- Webhook setup happens in background
- Initial sync happens in background
- No real-time feedback to user
- User doesn't know if sync succeeded

### 4. **Database Schema Complexity**
- Multiple migration files
- UUID vs INTEGER user_id confusion
- Foreign key constraints
- Row Level Security policies

### 5. **Silent Failures**
- Webhook setup fails but connection still created
- Initial sync fails but connection shows as active
- No error messages to user
- "Last sync: Never" is only indicator

## Recommended Fixes

### Short Term (Immediate)
1. **Log out and log back in** to refresh token
2. **Check "Last sync" timestamp** in Settings
3. **Verify database migration** was run

### Medium Term (Next Sprint)
1. **Add automatic token refresh** to frontend
2. **Add error messages** when sync fails
3. **Add sync status indicator** in UI
4. **Add retry logic** for failed syncs

### Long Term (Architecture)
1. **Implement proper auth flow** with refresh tokens
2. **Add webhook status monitoring** dashboard
3. **Add automatic sync retry** with exponential backoff
4. **Add comprehensive logging** and alerting
5. **Add user-facing sync status** in Settings

## Testing Checklist

- [ ] User logs out and logs back in
- [ ] Check browser console for JWT token
- [ ] Check Supabase for meetings in database
- [ ] Check backend logs for webhook messages
- [ ] Check Settings for "Last sync" timestamp
- [ ] Create test meeting in Google Calendar
- [ ] Wait 5 seconds and refresh Meetings page
- [ ] Verify test meeting appears

## Next Steps

1. **Immediate:** Log out and log back in
2. **Verify:** Check "Last sync" in Settings
3. **Debug:** Check backend logs on Render
4. **Confirm:** Create test meeting in Google Calendar
5. **Report:** Share findings with support

## Support Information

If meetings still don't appear after these steps:
1. Share the user ID: `4c903cdf-85ba-4608-8be9-23ec8bbbaa7d`
2. Share backend logs from Render
3. Share database query results
4. Share "Last sync" timestamp from Settings
5. Confirm Google Calendar is connected

