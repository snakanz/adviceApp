# Two Critical Issues - Analysis & Fixes Required

## Issue 1: Token Expiration After Leaving Page Open

### Problem
When you leave the Meetings page open for a while, meetings disappear and show "Authentication required. Please log in again."

### Root Cause: Token Storage Mismatch

**The Conflict:**
1. **Supabase stores token as:** `'supabase.auth.token'` (in `src/lib/supabase.js` line 14)
2. **AuthCallback stores token as:** `'jwt'` (in `src/pages/AuthCallback.js` line 47)
3. **Meetings.js reads token as:** `'jwt'` (in `src/pages/Meetings.js` line 425)

**What Happens:**
- AuthContext has automatic token refresh (lines 86-105 in `src/context/AuthContext.js`)
- It refreshes the token stored as `'supabase.auth.token'`
- But Meetings.js is looking for the old `'jwt'` key
- After ~1 hour, the old token expires
- Meetings.js gets `null` from localStorage
- Meetings disappear

### Files Using Old `'jwt'` Key
- `src/pages/AuthCallback.js` - Line 47 (stores it)
- `src/pages/Meetings.js` - Lines 425, 1094
- `src/pages/Clients.js` - Line 125
- `src/pages/ActionItems.js` - Lines 99, 163
- `src/components/DataImport.js` - Lines 87, 125, 159
- `src/components/DocumentsTab.js` - Line 53
- `src/components/ClientDocumentsSection.js` - Line 67

### Solution
Replace all `localStorage.getItem('jwt')` with proper token retrieval from Supabase session:
```javascript
// OLD (breaks after token refresh)
const token = localStorage.getItem('jwt');

// NEW (always gets current token)
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## Issue 2: Google Calendar Connection Fails When Calendly Connected

### Problem
When you try to connect Google Calendar after Calendly is already connected, you get:
```
⚠️ No provider token found - user may not have signed in with Google
```

### Root Cause 1: Missing Provider Token Extraction

**In `backend/src/routes/auth.js` (lines 646-654):**
```javascript
const providerToken = authUser.app_metadata?.provider_token;
const providerRefreshToken = authUser.app_metadata?.provider_refresh_token;

if (!providerToken) {
  console.log('⚠️ No provider token found - user may not have signed in with Google');
  return res.json({
    success: false,
    message: 'No Google Calendar access - user did not sign in with Google OAuth'
  });
}
```

**Why it fails:**
- The endpoint assumes Google tokens are in `app_metadata`
- But when you're already authenticated via Google, those tokens may not be accessible this way
- The endpoint doesn't handle switching calendars properly

### Root Cause 2: Missing Deactivation Logic

**In `backend/src/routes/auth.js` (lines 711-724):**
The auto-connect endpoint creates a new Google connection WITHOUT deactivating Calendly first.

**Compare with working pattern in `backend/src/routes/calendar-settings.js` (lines 364-379):**
```javascript
// Deactivate all other active connections (single active connection per user)
const { error: deactivateError } = await req.supabase
  .from('calendar_connections')
  .update({
    is_active: false,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('is_active', true);
```

### Solution
The auto-connect endpoint needs to:
1. Deactivate existing Calendly connection before creating Google one
2. Handle the case where provider tokens aren't in app_metadata
3. Provide better error handling for calendar switching

---

## Summary of Changes Needed

### Frontend (7 files)
- Replace `localStorage.getItem('jwt')` with Supabase session token retrieval
- Use AuthContext's `getAccessToken()` method or direct Supabase session access

### Backend (1 file)
- Update `/api/auth/auto-connect-calendar` endpoint to:
  - Deactivate other connections before creating new one
  - Handle missing provider tokens gracefully
  - Support calendar switching workflow

---

## Implementation Priority

**High Priority (Blocking):**
1. Fix token expiration issue (Issue 1) - Users lose access after ~1 hour
2. Fix calendar switching (Issue 2) - Users can't switch from Calendly to Google

**Scope:** ~8 files total (7 frontend + 1 backend)

