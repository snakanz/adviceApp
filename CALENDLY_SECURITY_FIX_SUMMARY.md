# Calendly Security Fix - User Isolation Implementation

## 🚨 Critical Security Issue - RESOLVED

**Issue**: All users' Calendly syncs were using a global `CALENDLY_PERSONAL_ACCESS_TOKEN` instead of user-specific OAuth tokens, causing cross-user data contamination.

**Impact**: When Daniel (jeongguan@gmail.com) connected his Calendly account, he saw Nelson's (nelson.greenwood@sjpp.co.uk) Calendly meetings instead of his own.

**Root Cause**: The `CalendlyService` class was designed for single-user use with a global token, not multi-tenant use with per-user OAuth tokens.

---

## ✅ Changes Implemented

### 1. **CalendlyService Refactored** (`backend/src/services/calendlyService.js`)

**Before:**
```javascript
constructor() {
  this.baseURL = 'https://api.calendly.com';
  this.personalAccessToken = process.env.CALENDLY_PERSONAL_ACCESS_TOKEN;
}
```

**After:**
```javascript
constructor(accessToken = null) {
  this.baseURL = 'https://api.calendly.com';
  this.accessToken = accessToken; // User-specific OAuth token
}
```

**Key Changes:**
- ✅ Constructor now accepts user-specific `accessToken` parameter
- ✅ Removed dependency on `process.env.CALENDLY_PERSONAL_ACCESS_TOKEN`
- ✅ All API requests now use `this.accessToken` instead of global token
- ✅ Added static method `getUserAccessToken(userId)` to fetch user's token from database
- ✅ Implemented automatic token refresh logic for expired OAuth tokens

### 2. **All Route Handlers Updated**

Updated all CalendlyService instantiations to fetch user-specific tokens:

#### `backend/src/routes/calendly.js`
- ✅ `/test-connection` - Fetches user's token before testing
- ✅ `/sync` - Fetches user's token before syncing
- ✅ Added proper error handling for missing connections

#### `backend/src/routes/calendar.js`
- ✅ OAuth callback - Uses the access token just received from OAuth flow
- ✅ Background sync uses user's token

#### `backend/src/routes/calendar-settings.js`
- ✅ Already correct - passes user's token to constructor

#### `backend/src/index.js`
- ✅ Manual sync endpoint - Fetches user's token before syncing

### 3. **Legacy Code Removed** (`backend/src/routes.js`)

- ✅ Removed global token fallback logic
- ✅ Deprecated old `/calendly/sync` endpoint
- ✅ Updated error messages to guide users to new endpoints

### 4. **Token Refresh Logic Added**

The `getUserAccessToken()` method now:
- ✅ Checks if token is expired (using `token_expires_at` field)
- ✅ Automatically refreshes expired tokens using refresh token
- ✅ Updates database with new tokens
- ✅ Falls back to existing token if refresh fails

---

## 🔒 Security Improvements

### Before (INSECURE):
```
User A connects Calendly → Stores OAuth token in DB
User A syncs → Uses GLOBAL token (Nelson's) → Sees Nelson's meetings ❌

User B connects Calendly → Stores OAuth token in DB  
User B syncs → Uses GLOBAL token (Nelson's) → Sees Nelson's meetings ❌
```

### After (SECURE):
```
User A connects Calendly → Stores OAuth token in DB
User A syncs → Uses User A's token → Sees User A's meetings ✅

User B connects Calendly → Stores OAuth token in DB
User B syncs → Uses User B's token → Sees User B's meetings ✅
```

---

## 📋 Required Manual Actions

### 1. **Environment Variable Cleanup**
- ✅ **DONE**: Removed `CALENDLY_PERSONAL_ACCESS_TOKEN` from Render environment variables

### 2. **Database Cleanup**
⚠️ **REQUIRED**: Delete Daniel's incorrectly synced Calendly meetings

Daniel's user ID: `a2fe3d0f-c258-44a1-970a-158f198422d5`

**SQL to run** (via Supabase dashboard or migration):
```sql
DELETE FROM meetings
WHERE user_id = 'a2fe3d0f-c258-44a1-970a-158f198422d5'
  AND meeting_source = 'calendly';
```

### 3. **User Re-connection**
Ask Daniel to:
1. Go to Settings → Calendar
2. Disconnect Calendly (if still connected)
3. Reconnect his Calendly account
4. Trigger a fresh sync

### 4. **Verification**
After Daniel reconnects:
1. Check that he sees only HIS Calendly meetings
2. Verify the meetings belong to `daniel.soon@sjpp.co.uk`
3. Confirm no meetings from `nelson.greenwood@sjpp.co.uk` appear

---

## 🧪 Testing

A test script has been created: `backend/test-calendly-user-isolation.js`

**To run** (requires Supabase env vars):
```bash
cd backend
node test-calendly-user-isolation.js
```

**What it tests:**
- ✅ CalendlyService constructor accepts access token
- ✅ getUserAccessToken fetches user-specific token
- ✅ Calendar connections are user-specific
- ✅ No global token dependency
- ✅ Service fails gracefully without token

---

## 📊 Files Modified

1. ✅ `backend/src/services/calendlyService.js` - Core service refactored
2. ✅ `backend/src/routes/calendly.js` - Updated all endpoints
3. ✅ `backend/src/routes/calendar.js` - Updated OAuth callback
4. ✅ `backend/src/routes/calendar-settings.js` - Already correct
5. ✅ `backend/src/index.js` - Updated manual sync
6. ✅ `backend/src/routes.js` - Removed legacy code

---

## 🎯 Pattern to Follow

**Every time you use CalendlyService:**

```javascript
// 1. Fetch user's token from database
const accessToken = await CalendlyService.getUserAccessToken(userId);

// 2. Check if token exists
if (!accessToken) {
  return res.status(400).json({ 
    error: 'Please connect your Calendly account first' 
  });
}

// 3. Create service with user's token
const calendlyService = new CalendlyService(accessToken);

// 4. Use the service
await calendlyService.syncMeetingsToDatabase(userId);
```

---

## ✅ Verification Checklist

- [x] CalendlyService constructor accepts user-specific token
- [x] All route handlers fetch user's token before creating service
- [x] Global `CALENDLY_PERSONAL_ACCESS_TOKEN` removed from environment
- [x] Legacy code removed/deprecated
- [x] Token refresh logic implemented
- [x] Error handling for missing connections added
- [ ] Daniel's incorrect meetings deleted (MANUAL ACTION REQUIRED)
- [ ] Daniel reconnects Calendly account (USER ACTION REQUIRED)
- [ ] Verify Daniel sees only his meetings (VERIFICATION REQUIRED)

---

## 🚀 Deployment Status

**Code Changes**: ✅ Complete and ready to deploy
**Environment**: ✅ Global token removed from Render
**Database**: ⚠️ Cleanup required (see Manual Actions above)

---

## 📞 Support

If issues persist after these changes:
1. Check Render logs for Calendly sync errors
2. Verify user has active Calendly connection in `calendar_connections` table
3. Check that `access_token` field is populated for the user
4. Verify OAuth flow is storing tokens correctly

---

**Date**: 2025-11-11
**Fixed By**: Augment Agent
**Severity**: Critical Security Issue
**Status**: Code Fixed ✅ | Manual Cleanup Required ⚠️

