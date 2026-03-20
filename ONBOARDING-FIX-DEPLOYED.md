# Onboarding Calendar OAuth Fix - Deployed

## What Was Fixed

The root cause of the onboarding calendar authentication issue has been identified and fixed:

### Problem
The backend OAuth callbacks (`/api/auth/google/callback` and `/api/auth/microsoft/callback`) were creating custom JWT tokens instead of using the existing Supabase session from onboarding. This caused:

1. **Authentication mismatch**: Frontend expected Supabase session but got JWT token
2. **Lost onboarding state**: Errors redirected to `/login` instead of back to onboarding
3. **Infinite loop**: User got stuck at Step 3 because calendar connected but session was invalid

### Solution Implemented

**Backend Changes** ([backend/src/routes/auth.js](backend/src/routes/auth.js)):
- ✅ Removed JWT token generation from OAuth callbacks
- ✅ Now redirects to `/auth/callback?success=true&provider=google` (no token parameter)
- ✅ Errors redirect to `/auth/callback?error=MESSAGE&provider=google&onboarding=true`
- ✅ Frontend uses existing Supabase session (no authentication mismatch)

**Frontend Changes** ([src/pages/AuthCallback.js](src/pages/AuthCallback.js)):
- ✅ Handles explicit `success` and `error` parameters from backend
- ✅ Restores onboarding state when errors occur (no more lost progress)
- ✅ Shows actual error messages instead of generic "auth_failed"
- ✅ Redirects back to onboarding with restored state

**Enhanced Logging** ([src/pages/Onboarding/Step3_CalendarSetup.js](src/pages/Onboarding/Step3_CalendarSetup.js)):
- ✅ Comprehensive logging at each step of OAuth flow
- ✅ Logs user info, onboarding data, and session state
- ✅ Makes debugging much easier if issues occur

## What Changed for Users

### Before Fix:
```
User clicks "Connect Google Calendar" →
OAuth succeeds →
Backend creates JWT token →
Frontend can't validate JWT →
Authentication fails →
User stuck in loop ❌
```

### After Fix:
```
User clicks "Connect Google Calendar" →
OAuth succeeds →
Backend stores calendar tokens →
Redirects with success=true →
Frontend uses existing Supabase session →
Returns to onboarding Step 3 →
User continues to next step ✅
```

## Testing Instructions

### For User: holly@advicly.co.uk

1. **Clear browser cache and cookies** (or use incognito mode)
2. Go to https://adviceapp.pages.dev
3. Sign up or log in with: `holly@advicly.co.uk`
4. Complete onboarding steps 1 and 2
5. At Step 3, click "Connect Google Calendar"
6. Authorize Google Calendar access
7. **Expected result**: Should return to Step 3 with "Connected" status
8. Click "Next" to proceed to Step 4
9. Complete onboarding

### If Issues Occur

With the new logging, you'll see detailed console output:

**Before OAuth:**
```
🔵 Starting Google Calendar connection...
🔵 Current user: holly@advicly.co.uk User ID: [uuid]
🔵 Onboarding data: { business_name: "...", ... }
🔵 Access token obtained: YES
🔵 OAuth URL response: { url: "https://..." }
🔵 Saving onboarding state to sessionStorage...
🔵 State to save: { currentStep: 3, selectedProvider: "google", ... }
🔵 Redirecting to OAuth URL...
```

**After OAuth (success):**
```
🔍 AuthCallback: Analyzing URL...
✅ AuthCallback: Backend confirmed calendar connection success: google
✅ OAuth session established: holly@advicly.co.uk
🔄 Detected onboarding OAuth return, restoring state...
✅ Calendar connected successfully!
🔄 Redirecting to onboarding step 3...
🔍 Checking for OAuth return in sessionStorage...
🔍 OAuth return found: {"provider":"google","success":true}
✅ google Calendar OAuth successful - Setting connected state
```

**After OAuth (error):**
```
🔍 AuthCallback: Analyzing URL...
❌ AuthCallback: Backend returned error: [actual error message]
Calendar connection failed: [actual error message]
🔄 Redirecting to onboarding with restored state...
```

## Mobile Testing

The fix applies to both desktop and mobile. Mobile users should see the same flow with:
- 2000ms wait time for session (vs 500ms desktop)
- Mobile-specific device info logged
- Same Supabase session handling

### Mobile Debug Checklist
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Enable remote debugging to see console logs
- [ ] Verify calendar connects successfully
- [ ] Verify can proceed to next onboarding step

## Backend Logs to Check

On Render.com dashboard, you should see:

**Successful flow:**
```
📅 /api/auth/google/callback called
  - code: ✅ Present
📅 Google OAuth callback - User: holly@advicly.co.uk
✅ Google Calendar connection updated successfully
✅ Google Calendar connected - redirecting to /auth/callback
```

**Error flow:**
```
📅 /api/auth/google/callback called
❌ Google auth error: [actual error]
```

## Database Verification

Check if calendar was connected:

```sql
-- Check calendar_connections
SELECT
  provider,
  provider_account_email,
  is_active,
  created_at,
  updated_at
FROM calendar_connections
WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');

-- Check onboarding status
SELECT
  email,
  onboarding_completed,
  onboarding_step,
  created_at
FROM users
WHERE email = 'holly@advicly.co.uk';
```

## Rollback Plan

If issues persist, the previous version can be restored with:
```bash
git revert HEAD
git push origin main
```

## Next Steps

1. **Test the fix** with holly@advicly.co.uk on both desktop and mobile
2. **Monitor backend logs** on Render to see if any errors occur
3. **Check browser console** for detailed client-side logs
4. **Verify database** to confirm calendar connection was created

If the issue is resolved, the onboarding flow should now work smoothly for all users! 🎉

---

**Deployed**: 2026-01-14
**Commit**: 527bf40
**Files Changed**: 4 (backend/src/routes/auth.js, src/pages/AuthCallback.js, src/pages/Onboarding/Step3_CalendarSetup.js, ONBOARDING-CALENDAR-AUTH-FIX.md)
