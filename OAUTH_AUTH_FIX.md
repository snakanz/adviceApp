# OAuth Authentication Fix - Complete Documentation

**Date:** October 20, 2025  
**Status:** ✅ RESOLVED  
**Issue:** Users were being automatically signed out immediately after completing Google OAuth login

---

## Problem Summary

Users would complete Google OAuth authentication successfully, but then immediately get signed out and redirected back to the login page. The session was being established correctly but then cleared within seconds.

### Symptoms
- User clicks "Sign in with Google"
- Google OAuth completes successfully
- User briefly sees authenticated state
- Immediately signed out and redirected to `/login`
- Console showed: `INITIAL_SESSION` → `SIGNED_OUT`

---

## Root Cause

The issue was in **`src/services/api.js`** - the API service had aggressive auto-signout logic:

```javascript
if (response.status === 401) {
    // Sign out and redirect to login
    await supabase.auth.signOut();  // ❌ This was the problem
    window.location.href = '/login';
    throw new Error('Unauthorized');
}
```

**What was happening:**
1. User completes OAuth and gets valid Supabase session
2. Frontend makes API calls to backend
3. If ANY API call returned 401 (even temporarily), the API service would:
   - Immediately call `supabase.auth.signOut()`
   - Clear the session
   - Redirect to login
4. This created a race condition where valid sessions were being destroyed

---

## Solution

### 1. Fixed API Service Auto-Signout Logic

**File:** `src/services/api.js`

Changed the 401 handler to check if a valid session exists before signing out:

```javascript
if (response.status === 401) {
    console.warn('⚠️ 401 Unauthorized response from:', endpoint);
    
    // Check if we have a valid session before signing out
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        // No session - redirect to login
        console.log('❌ No session found, redirecting to login');
        window.location.href = '/login';
    } else {
        // We have a session but got 401 - this might be a backend issue
        // Don't sign out automatically, just log the error
        console.error('❌ 401 error despite having valid session. Backend may not recognize token yet.');
    }
    
    throw new Error('Unauthorized');
}
```

**Key improvement:** Only redirects to login if there's truly no session. If session exists but backend returns 401, it logs the error but doesn't destroy the session.

### 2. Enhanced AuthCallback Component

**File:** `src/pages/AuthCallback.js`

- Removed dependency on `useAuth()` hook to avoid race conditions
- Uses `supabase` client directly for session retrieval
- Increased wait time to 1.5 seconds for OAuth processing
- Added comprehensive error logging

```javascript
// Get the session directly from Supabase
const { data: { session }, error } = await supabase.auth.getSession();

if (!session) {
    console.error('❌ No session found after OAuth callback');
    setStatus('error');
    setMessage('Authentication failed. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
    return;
}
```

### 3. Added Detailed Logging

**File:** `src/context/AuthContext.js`

Added comprehensive logging to track authentication state changes:

```javascript
// Log URL and hash for debugging
console.log('🔍 Current URL:', window.location.href);
console.log('🔍 URL Hash:', window.location.hash);

// Log session details
if (session) {
    console.log('✅ Session user:', session.user.email);
    console.log('✅ Session expires at:', new Date(session.expires_at * 1000).toLocaleString());
}

// Add stack traces to identify what triggers SIGNED_OUT
console.log('📋 Stack trace:', new Error().stack);
```

### 4. Maintained PKCE Flow

**File:** `src/lib/supabase.js`

Kept `flowType: 'pkce'` (not `implicit`) as Google OAuth requires PKCE for security:

```javascript
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // PKCE flow is required for Google OAuth
      storage: window.localStorage,
      storageKey: 'supabase.auth.token',
      debug: true
    }
  }
);
```

---

## Files Modified

1. ✅ **src/services/api.js** - Fixed auto-signout logic
2. ✅ **src/pages/AuthCallback.js** - Enhanced OAuth callback handling
3. ✅ **src/context/AuthContext.js** - Added detailed logging
4. ✅ **src/lib/supabase.js** - Maintained PKCE flow with debug logging

---

## Testing & Verification

### How to Test
1. Go to https://adviceapp.pages.dev
2. Open DevTools (F12) → Console
3. Clear storage: `localStorage.clear(); sessionStorage.clear();`
4. Hard refresh: Cmd+Shift+R
5. Click "Sign in with Google"
6. Complete OAuth flow
7. Verify you stay logged in and reach `/meetings` page

### Expected Console Output
```
🔄 Initializing Supabase Auth...
🔍 Current URL: https://adviceapp.pages.dev/auth/callback#access_token=...
🔍 URL Hash: #access_token=...
📋 Initial session: Found
✅ Session user: user@example.com
✅ Session expires at: [timestamp]
🔔 Auth state changed: SIGNED_IN
✅ User signed in: user@example.com
🔄 Redirecting to /meetings...
```

---

## Architecture Notes

### Supabase OAuth Flow (PKCE)
1. User clicks "Sign in with Google"
2. Frontend calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Supabase redirects to Google OAuth
4. User authenticates with Google
5. Google redirects back to `/auth/callback` with hash fragment containing tokens
6. Supabase client automatically processes hash fragment
7. Session is established and stored in localStorage
8. Frontend redirects to `/meetings`

### Session Management
- **Storage:** localStorage with key `supabase.auth.token`
- **Auto-refresh:** Enabled (tokens refresh automatically before expiry)
- **Persistence:** Enabled (session survives page refreshes)
- **Detection:** Enabled (automatically processes OAuth callback URLs)

---

## Related Configuration

### Supabase Dashboard Settings
- **Site URL:** `https://adviceapp.pages.dev`
- **Redirect URLs:** 
  - `https://adviceapp.pages.dev/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)

### Google OAuth Settings
- **Authorized redirect URIs:** Must include Supabase's OAuth callback URL
- **Scopes:** email, profile, openid

---

## Future Improvements

1. **Better Error Handling:** Add retry logic for transient 401 errors
2. **Session Validation:** Periodically validate session with backend
3. **Token Refresh UI:** Show user-friendly message during token refresh
4. **Offline Support:** Handle authentication when offline

---

## Troubleshooting

### If users still get signed out:

1. **Check Supabase logs:** Look for session creation/deletion events
2. **Check browser console:** Look for stack traces on SIGNED_OUT events
3. **Verify redirect URLs:** Ensure Supabase dashboard has correct URLs
4. **Check token expiry:** Verify tokens aren't expiring too quickly
5. **Backend token validation:** Ensure backend properly validates Supabase tokens

### Common Issues

**Issue:** Session not found after OAuth callback  
**Solution:** Check that `detectSessionInUrl: true` is set in Supabase client config

**Issue:** 401 errors from backend  
**Solution:** Verify backend is using `verifySupabaseToken` middleware correctly

**Issue:** Session expires too quickly  
**Solution:** Check Supabase JWT expiry settings in dashboard

---

## Deployment

Changes deployed via:
```bash
npm run build
git add -A
git commit -m "Fix OAuth authentication flow - prevent auto-signout and add detailed logging"
git push
```

Cloudflare Pages automatically deploys on push to `main` branch.

---

## Success Criteria ✅

- [x] Users can complete Google OAuth login
- [x] Session persists after OAuth callback
- [x] Users are not automatically signed out
- [x] Users successfully reach `/meetings` page
- [x] Session survives page refreshes
- [x] Detailed logging helps debug future issues

---

## Contact

For questions or issues, refer to:
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **OAuth Flow Docs:** https://supabase.com/docs/guides/auth/social-login
- **This repository:** https://github.com/snakanz/adviceApp

