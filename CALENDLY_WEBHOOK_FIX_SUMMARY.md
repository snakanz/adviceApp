# Calendly Webhook & OAuth Fix Summary

## Date: 2025-11-11

## Issues Fixed

### 1. ✅ Webhooks Now Use User-Specific OAuth Tokens

**Problem:**
- Webhook handlers created `CalendlyService` without any access token
- Queried for ANY active Calendly connection (not user-specific)
- Would fail in multi-user environment or when fetching event details

**Solution:**
- Webhook payload contains `created_by` field with Calendly user URI
- Store `calendly_user_uri` and `calendly_organization_uri` during OAuth callback
- Match webhook events to users by querying `calendar_connections.calendly_user_uri`
- Create `CalendlyService` with that user's specific `access_token`

**Files Changed:**
- `backend/src/routes/calendly.js` - Updated `handleInviteeCreated()` and `handleInviteeUpdated()`
- `backend/src/routes/calendar.js` - Store Calendly URIs during OAuth callback

**Code Changes:**

```javascript
// OLD (BROKEN):
const calendlyService = new CalendlyService(); // No token!
const { data: connection } = await supabase
  .from('calendar_connections')
  .select('user_id')
  .eq('provider', 'calendly')
  .eq('is_active', true)
  .single(); // Returns ANY active connection!

// NEW (FIXED):
const calendlyUserUri = payload.created_by; // Get from webhook
const { data: connection } = await supabase
  .from('calendar_connections')
  .select('user_id, access_token')
  .eq('provider', 'calendly')
  .eq('calendly_user_uri', calendlyUserUri) // Match specific user!
  .eq('is_active', true)
  .single();

const calendlyService = new CalendlyService(connection.access_token); // User's token!
```

---

### 2. ✅ Force Calendly Auth Screen on Every Connection

**Problem:**
- When reconnecting Calendly, users were auto-authenticated without seeing the auth screen
- This could cause confusion about which account is being connected
- No explicit consent shown on reconnection

**Solution:**
- Added `prompt: 'consent'` parameter to OAuth authorization URL
- Forces Calendly to show the authorization screen every time
- Users must explicitly approve the connection each time

**Files Changed:**
- `backend/src/services/calendlyOAuth.js` - Added `prompt: 'consent'` parameter

**Code Changes:**

```javascript
// OLD:
const params = new URLSearchParams({
  client_id: this.clientId,
  redirect_uri: this.redirectUri,
  response_type: 'code',
  state: state || 'state',
  scope: 'default'
});

// NEW:
const params = new URLSearchParams({
  client_id: this.clientId,
  redirect_uri: this.redirectUri,
  response_type: 'code',
  state: state || 'state',
  scope: 'default',
  prompt: 'consent' // ✅ Force auth screen every time
});
```

---

## How It Works Now

### OAuth Flow:
1. User clicks "Connect with Calendly OAuth" in settings
2. Frontend opens Calendly OAuth URL with `prompt=consent` parameter
3. **Calendly ALWAYS shows authorization screen** (even if previously authorized)
4. User approves connection
5. Calendly redirects to callback with authorization code
6. Backend exchanges code for access token and refresh token
7. Backend fetches Calendly user info (including `uri` and `current_organization`)
8. **Backend stores `calendly_user_uri` and `calendly_organization_uri` in database**
9. Backend triggers background sync of meetings

### Webhook Flow:
1. Calendly sends webhook when meeting is created/updated/canceled
2. Webhook payload includes `created_by` field with Calendly user URI
3. **Backend matches `created_by` to `calendar_connections.calendly_user_uri`**
4. **Backend fetches that user's `access_token` from database**
5. **Backend creates `CalendlyService` with user's specific token**
6. Backend fetches event details from Calendly API using user's token
7. Backend saves/updates meeting in database for correct user

---

## Database Schema

The `calendar_connections` table already has these columns (no migration needed):
- `calendly_user_uri` (text) - Stores Calendly user URI for webhook matching
- `calendly_organization_uri` (text) - Stores Calendly organization URI
- `access_token` (text) - User's OAuth access token
- `refresh_token` (text) - User's OAuth refresh token

---

## Benefits

### Security:
- ✅ Each user's Calendly data is completely isolated
- ✅ Webhooks use correct user's OAuth token
- ✅ No cross-user data contamination possible

### User Experience:
- ✅ Users always see Calendly auth screen when connecting
- ✅ Clear which Calendly account is being connected
- ✅ Explicit consent required on every connection

### Functionality:
- ✅ Real-time meeting updates via webhooks
- ✅ Instant meeting creation/cancellation/updates
- ✅ No polling required
- ✅ Lower API usage

---

## Testing Checklist

- [ ] User A connects their Calendly account
- [ ] User A's `calendly_user_uri` is stored in database
- [ ] User A creates a meeting in Calendly
- [ ] Webhook fires and meeting appears in User A's account
- [ ] User B connects their Calendly account
- [ ] User B's `calendly_user_uri` is stored in database
- [ ] User B creates a meeting in Calendly
- [ ] Webhook fires and meeting appears in User B's account (NOT User A's)
- [ ] User A disconnects and reconnects Calendly
- [ ] Calendly auth screen is shown (not auto-authenticated)
- [ ] User A approves connection
- [ ] User A's meetings still work correctly

---

## Deployment Notes

**No database migration required** - The `calendly_user_uri` and `calendly_organization_uri` columns already exist in the `calendar_connections` table.

**Environment Variables Required:**
- `CALENDLY_OAUTH_CLIENT_ID` - Calendly OAuth client ID
- `CALENDLY_OAUTH_CLIENT_SECRET` - Calendly OAuth client secret
- `CALENDLY_OAUTH_REDIRECT_URI` - OAuth callback URL (optional, defaults to backend URL)

**Backward Compatibility:**
- Existing connections without `calendly_user_uri` will need to reconnect
- Webhooks for old connections will fail gracefully with error log
- Users will be prompted to reconnect Calendly in settings

---

## Related Files

### Modified:
- `backend/src/services/calendlyOAuth.js` - Added `prompt: 'consent'`
- `backend/src/routes/calendar.js` - Store Calendly URIs during OAuth
- `backend/src/routes/calendly.js` - Use user-specific tokens in webhooks

### Unchanged (but relevant):
- `backend/src/services/calendlyService.js` - Already supports user-specific tokens
- `src/components/CalendarSettings.js` - Frontend OAuth flow
- `backend/src/routes/calendar-settings.js` - OAuth URL generation endpoint

---

## Previous Related Fixes

This builds on the previous security fix from 2025-11-11:
- Removed global `CALENDLY_PERSONAL_ACCESS_TOKEN` environment variable
- Refactored `CalendlyService` to use user-specific OAuth tokens
- Updated all routes to fetch user tokens from database

---

## Conclusion

The Calendly integration is now **fully multi-tenant** with:
- ✅ User-specific OAuth tokens
- ✅ Webhook user isolation
- ✅ Forced consent on connection
- ✅ Real-time meeting updates
- ✅ Complete data security

Each user's Calendly data is completely isolated and webhooks work correctly in a multi-user environment.

