# Onboarding Calendar Authentication Issues - Complete Analysis & Fix

## Issues Identified

### Issue 1: OAuth Callback Redirect Errors
**Problem**: When calendar OAuth fails during onboarding, backend redirects to `/login?error=auth_failed` instead of preserving onboarding state.

**Impact**: User loses onboarding progress and gets kicked back to login page.

**Current Flow**:
```
Onboarding Step 3 → Google OAuth → ERROR → Redirect to /login
```

**Expected Flow**:
```
Onboarding Step 3 → Google OAuth → ERROR → Back to /auth/callback with error → Back to Onboarding Step 3 with error message
```

### Issue 2: Backend Uses Old JWT Auth Instead of Supabase Sessions
**Problem**: `/api/auth/google/callback` and `/api/auth/microsoft/callback` create custom JWT tokens instead of using Supabase sessions.

**Impact**:
- Session mismatch between Supabase (used by frontend) and custom JWT (used by calendar auth)
- User appears unauthenticated even after successful OAuth
- Onboarding state gets lost

**Evidence**:
```javascript
// In auth.js line 430-438
const jwtToken = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
```

This JWT is NOT a Supabase session token!

### Issue 3: Duplicate Auth Routes
**Problem**: There are TWO sets of Google/Microsoft auth endpoints:
- `/api/auth/google` - Old JWT-based system
- `/api/calendar/auth/google` - Newer system (possibly Supabase-compatible)

**Impact**: Frontend calls one endpoint, but might get routed to the wrong one.

### Issue 4: Missing Error Communication to Frontend
**Problem**: When OAuth fails, errors are logged in backend but not communicated to frontend properly.

**What happens now**:
```javascript
catch (error) {
  console.error('Google auth error:', error);  // Logged in backend only
  res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);  // Generic error
}
```

**What should happen**:
```javascript
catch (error) {
  console.error('Google auth error:', error);
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error.message)}&onboarding=true`);
}
```

## Root Cause

The calendar OAuth system was built with a custom JWT auth system, but the main app now uses Supabase Auth. When a user goes through onboarding:

1. ✅ User signs up with Supabase Auth (email/password or Google OAuth)
2. ✅ Supabase session is created
3. ✅ User starts onboarding
4. ✅ User clicks "Connect Google Calendar" in Step 3
5. ❌ Backend `/api/auth/google` is called (OLD JWT system)
6. ❌ Backend creates custom JWT token (NOT Supabase session)
7. ❌ Redirects to `/auth/callback?token=JWT_TOKEN`
8. ❌ Frontend expects Supabase session, gets JWT token instead
9. ❌ AuthCallback can't validate JWT token with Supabase
10. ❌ Authentication fails, user stuck in loop

## Solutions

### Solution 1: Update Calendar OAuth to Use Supabase Sessions (Recommended)

Modify `/api/auth/google/callback` and `/api/auth/microsoft/callback` to:
1. NOT create custom JWT tokens
2. Use the EXISTING Supabase session from the request
3. Redirect back to frontend without token parameter
4. Let frontend use existing Supabase session

**Implementation**:

```javascript
// backend/src/routes/auth.js

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      // ERROR: Redirect back to onboarding with error
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=missing_code&onboarding=true`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    console.log('📅 Google OAuth callback - User:', userInfo.data.email);

    // **FIX**: Get user from Supabase Auth session instead of creating JWT
    // The user is already authenticated via Supabase
    const { data: { user }, error: userError } = await getSupabase().auth.getUser(req.headers.authorization?.replace('Bearer ', ''));

    if (userError || !user) {
      console.error('❌ No authenticated user found:', userError);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=not_authenticated&onboarding=true`);
    }

    console.log('✅ Using authenticated Supabase user:', user.email);

    // Store Google tokens in calendar_connections table
    const { data: existingConnection } = await getSupabase()
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (existingConnection) {
      // Update existing connection
      await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);
    } else {
      // Create new connection
      await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          provider: 'google',
          provider_account_email: userInfo.data.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true
        });
    }

    console.log('✅ Google Calendar connected successfully');

    // **FIX**: Redirect back to /auth/callback WITHOUT JWT token
    // Frontend will use existing Supabase session
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true`);

  } catch (error) {
    console.error('❌ Google auth error:', error);
    // **FIX**: Include error details for better debugging
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error.message)}&onboarding=true`);
  }
});
```

### Solution 2: Improve Error Handling in AuthCallback.js

Update AuthCallback to handle onboarding errors better:

```javascript
// src/pages/AuthCallback.js

useEffect(() => {
  const handleCallback = async () => {
    try {
      // Check for errors in URL
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const isOnboarding = params.get('onboarding') === 'true';

      if (error) {
        console.error('❌ OAuth error:', error);

        if (isOnboarding) {
          // Restore onboarding state and show error
          const onboardingState = sessionStorage.getItem('onboarding_state');
          if (onboardingState) {
            const state = JSON.parse(onboardingState);

            // Mark OAuth as failed
            sessionStorage.setItem('oauth_return', JSON.stringify({
              provider: state.selectedProvider,
              success: false,
              error: error
            }));

            // Clear onboarding state
            sessionStorage.removeItem('onboarding_state');

            // Redirect back to onboarding
            setStatus('error');
            setMessage('Calendar connection failed. Please try again.');

            setTimeout(() => {
              navigate('/onboarding', {
                replace: true,
                state: { restoredData: state }
              });
            }, 2000);
            return;
          }
        }

        // Not onboarding - regular error
        setStatus('error');
        setMessage(error || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // ... rest of existing logic
    }
  };

  handleCallback();
}, [navigate]);
```

### Solution 3: Add Detailed Logging

Add console logs to track the entire flow:

```javascript
// In Step3_CalendarSetup.js - handleGoogleConnect

const handleGoogleConnect = async () => {
  console.log('🔵 Starting Google Calendar connection...');
  console.log('🔵 Current user:', user);
  console.log('🔵 Onboarding data:', data);

  setIsConnecting(true);
  setError('');

  try {
    const token = await getAccessToken();
    console.log('🔵 Access token obtained:', token ? 'YES' : 'NO');

    // Get OAuth URL from auth endpoint
    const response = await axios.get(
      `${API_BASE_URL}/api/auth/google`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('🔵 OAuth URL response:', response.data);

    if (response.data.url && user?.id) {
      console.log('🔵 Saving onboarding state to sessionStorage...');
      console.log('🔵 State to save:', {
        currentStep: 3,
        selectedProvider: 'google',
        selectedPlan: data.selected_plan,
        user_id: user.id
      });

      // Save onboarding state
      sessionStorage.setItem('onboarding_state', JSON.stringify({
        currentStep: 3,
        selectedProvider: 'google',
        selectedPlan: data.selected_plan,
        business_name: data.business_name,
        business_type: data.business_type,
        team_size: data.team_size,
        timezone: data.timezone,
        enable_transcription: enableTranscription,
        user_id: user.id
      }));

      console.log('🔵 Redirecting to OAuth URL...');
      window.location.href = response.data.url;
    } else {
      console.error('❌ Missing OAuth URL or user ID');
      setError('Failed to initiate calendar connection');
      setIsConnecting(false);
    }
  } catch (err) {
    console.error('❌ Error connecting to Google:', err);
    console.error('❌ Error details:', err.response?.data);
    setError('Failed to connect to Google Calendar');
    setIsConnecting(false);
  }
};
```

## Testing Checklist

After applying fixes:

- [ ] Desktop: Sign up → Onboarding → Connect Google Calendar
- [ ] Desktop: Check browser console for detailed logs
- [ ] Desktop: Verify calendar connects successfully
- [ ] Desktop: Complete onboarding flow
- [ ] Mobile: Sign up → Onboarding → Connect Google Calendar
- [ ] Mobile: Use remote debugging to see console logs
- [ ] Mobile: Verify calendar connects successfully
- [ ] Mobile: Complete onboarding flow
- [ ] Test error scenario: Cancel OAuth consent screen
- [ ] Test error scenario: Deny permissions
- [ ] Verify error messages are helpful
- [ ] Verify user can retry after error

## Immediate Debug Steps

To help user `holly@advicly.co.uk` right now:

1. **Check backend logs** (Render dashboard):
   ```
   Look for:
   📅 /api/auth/google/callback called
   📅 Google OAuth callback - User: holly@advicly.co.uk
   ✅ Google Calendar connection updated successfully
   OR
   ❌ Any error messages
   ```

2. **Check if calendar was actually connected**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM calendar_connections
   WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
   ```

3. **Check onboarding status**:
   ```sql
   SELECT email, onboarding_completed, onboarding_step
   FROM users
   WHERE email = 'holly@advicly.co.uk';
   ```

4. **Manual fix** (if calendar connected but onboarding stuck):
   ```sql
   -- Update onboarding step to move forward
   UPDATE users
   SET onboarding_step = 4  -- Move to next step
   WHERE email = 'holly@advicly.co.uk';
   ```

## Priority Fixes

1. **HIGH**: Update OAuth callbacks to NOT create JWT tokens
2. **HIGH**: Improve error handling to preserve onboarding state
3. **MEDIUM**: Add detailed logging for debugging
4. **LOW**: Remove duplicate auth routes
5. **LOW**: Document the correct OAuth flow

## Files to Modify

1. `backend/src/routes/auth.js` - Update OAuth callbacks
2. `src/pages/AuthCallback.js` - Improve error handling
3. `src/pages/Onboarding/Step3_CalendarSetup.js` - Add detailed logging

---

**Next Steps**: Apply Solution 1 (update OAuth callbacks) as it's the root cause. This will fix both desktop and mobile issues.
