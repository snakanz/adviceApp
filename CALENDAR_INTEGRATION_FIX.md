# Google Calendar Integration Fix - Complete Solution

## Problem Summary

The Google Calendar integration was not working properly because:

1. **Database Schema Issue**: The `calendar_connections` table had `tenant_id` as `NOT NULL`, but the code was trying to insert `NULL` values for backwards compatibility with existing users who don't have a tenant yet.

2. **Multiple Active Connections**: The system allowed multiple active calendar connections per user, causing confusion about which calendar was being synced.

3. **Poor UI/UX**: The Calendar Integrations page showed all connections (active and inactive) without clear indication of which one was active.

4. **Status Indicator**: The Calendar Sync button in the sidebar only checked Google Calendar status, not all calendar types.

## Solutions Implemented

### 1. Database Schema Fix
**File**: `backend/migrations/022_fix_calendar_connections_tenant_nullable.sql`

- Made `tenant_id` nullable in `calendar_connections` table
- Updated foreign key constraint to allow NULL values
- Backfilled existing connections with tenant_id from users table
- Allows backwards compatibility with pre-multi-tenant users

### 2. Single Active Connection Per User
**Files**: 
- `backend/src/routes/auth.js` (Google OAuth callback)
- `backend/src/routes/calendar-settings.js` (Calendly connection)

**Implementation**:
- When a new calendar is connected, all other active connections are automatically deactivated
- Only one calendar can be active at a time
- Users can still have multiple connections stored, but only one is active
- Switching calendars is seamless - just connect a new one

**Code Changes**:
```javascript
// Deactivate all other active connections
const { error: deactivateError } = await getSupabase()
  .from('calendar_connections')
  .update({
    is_active: false,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', user.id)
  .eq('is_active', true);
```

### 3. Improved CalendarSettings UI
**File**: `src/components/CalendarSettings.js`

**Changes**:
- Renamed "Connected Calendars" to "Current Connection"
- Shows only active connections (max 1)
- Displays connected account email prominently
- Shows last sync time
- Clear "Connected" status badge
- "Switch Calendar" section with messaging about disconnecting previous calendar
- Shows "Currently connected" status for each provider option

**Visual Improvements**:
- Better spacing and hierarchy
- Green highlight for active connection
- Clear action buttons (Disable Sync, Disconnect)
- Helpful messaging for users

### 4. Updated Calendar Sync Button
**File**: `src/components/CalendarSyncButton.js`

**Changes**:
- Now checks for ANY active calendar connection (not just Google)
- Uses `/api/calendar-connections` endpoint
- Shows green checkmark ✅ if any calendar is active
- Shows red alert ❌ if no calendar is connected
- Shows loading spinner ⏳ while checking status
- Auto-refreshes every 30 seconds

## Database Schema

### calendar_connections Table
```sql
CREATE TABLE calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NOW NULLABLE
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'calendly')),
    provider_account_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,  -- Only one per user should be TRUE
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status TEXT,
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, provider_account_email)
);
```

## Testing Checklist

### 1. Google Calendar Connection
- [ ] Go to Settings → Calendar Integrations
- [ ] Click "Connect Google Calendar"
- [ ] Authorize with Google
- [ ] Verify connection appears in "Current Connection" section
- [ ] Verify green checkmark appears on Calendar Sync button in sidebar
- [ ] Verify account email is displayed
- [ ] Verify "Connected" status badge appears

### 2. Switching Calendars
- [ ] With Google Calendar connected, click "Connect Google Calendar" again
- [ ] Authorize with a different Google account
- [ ] Verify previous connection is deactivated
- [ ] Verify new connection is now active
- [ ] Verify only one connection shows in "Current Connection"

### 3. Calendly Connection
- [ ] Disconnect Google Calendar
- [ ] Click "Calendly" in "Add Calendar" section
- [ ] Enter Calendly API token
- [ ] Verify Calendly connection appears as active
- [ ] Verify green checkmark on Calendar Sync button

### 4. Switching from Calendly to Google
- [ ] With Calendly connected, click "Connect Google Calendar"
- [ ] Authorize with Google
- [ ] Verify Calendly connection is deactivated
- [ ] Verify Google Calendar is now active

### 5. Disconnect
- [ ] Click "Disconnect" button on active connection
- [ ] Confirm disconnection
- [ ] Verify connection is removed
- [ ] Verify red alert appears on Calendar Sync button
- [ ] Verify "No calendar connected" message appears

### 6. Sync Status
- [ ] Connect a calendar
- [ ] Verify "Last sync" time updates
- [ ] Verify sync status is tracked in database

## API Endpoints

### GET /api/calendar-connections
Returns all calendar connections for authenticated user
```json
{
  "success": true,
  "connections": [
    {
      "id": "uuid",
      "provider": "google",
      "provider_account_email": "user@gmail.com",
      "is_active": true,
      "sync_enabled": true,
      "last_sync_at": "2025-10-22T12:00:00Z"
    }
  ]
}
```

### POST /api/auth/google
Returns Google OAuth URL for authorization

### GET /api/auth/google/callback
Handles OAuth callback and creates/updates calendar connection

### POST /api/calendar-connections/calendly
Connects Calendly account with API token

### DELETE /api/calendar-connections/:id
Disconnects a calendar connection

## Deployment Notes

1. **Run Migration**: Execute `022_fix_calendar_connections_tenant_nullable.sql` on production database
2. **Restart Backend**: Render will auto-deploy on git push
3. **Clear Frontend Cache**: Users may need to hard refresh (Cmd+Shift+R)
4. **Monitor Logs**: Check Render logs for any connection errors

## Future Improvements

1. **Token Refresh**: Implement automatic Google token refresh before expiration
2. **Webhook Sync**: Set up Google Calendar webhooks for real-time sync
3. **Multiple Calendars**: Allow syncing from multiple calendars simultaneously
4. **Sync History**: Track sync history and errors for debugging
5. **Calendar Selection**: Let users choose which calendars to sync from

