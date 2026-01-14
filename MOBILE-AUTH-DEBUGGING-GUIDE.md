# Mobile Authentication Debugging & Supabase Dev Mode Guide

## Part 1: Mobile Authentication Issues

### Common Mobile Auth Problems

#### Issue 1: OAuth Redirect Loop on Mobile
**Symptom**: After OAuth (Google/Microsoft) login on mobile, user gets stuck in redirect loop

**Root Causes**:
1. Mobile browsers handle OAuth redirects differently
2. Deep links may not work properly
3. Session storage issues on mobile Safari/Chrome

**Debug Steps**:
1. Check browser console on mobile (use Chrome DevTools remote debugging)
2. Look for these logs in AuthCallback.js:
   ```
   🔍 AuthCallback: Analyzing URL...
   🔐 AuthCallback: Detected OAuth callback flow
   ✅ OAuth session established
   ```

**Solution**: Add mobile-specific OAuth handling

```javascript
// In AuthContext.js - signInWithOAuth function
const signInWithOAuth = async (provider, options = {}) => {
  try {
    // Detect mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          ...(isMobile && { display: 'touch' }) // Mobile-friendly OAuth
        },
        ...options
      }
    });

    if (error) throw error;

    console.log('✅ OAuth sign in initiated:', provider, 'Mobile:', isMobile);
    return { success: true, data };
  } catch (error) {
    console.error('❌ OAuth sign in error:', error);
    return { success: false, error: error.message };
  }
};
```

#### Issue 2: Session Not Persisting on Mobile
**Symptom**: User logs in successfully but gets logged out on page refresh

**Root Cause**: Mobile Safari aggressive cookie/storage policies

**Debug**: Check Supabase client initialization

```javascript
// In lib/supabase.js - verify this configuration
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage, // Use localStorage instead of cookies for mobile
      storageKey: 'supabase.auth.token',
      flowType: 'pkce' // Important for mobile OAuth
    }
  }
);
```

#### Issue 3: AuthCallback Timeout on Slow Mobile Networks
**Symptom**: "Authentication failed" on mobile after successful OAuth

**Solution**: Increase timeout in AuthCallback.js

```javascript
// In AuthCallback.js - handleOAuthCallback function
const handleOAuthCallback = async () => {
  console.log('🔐 Processing OAuth callback...');
  setStatus('processing');
  setMessage('Setting up your account...');

  // MOBILE FIX: Wait longer for session on slow networks
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const waitTime = isMobile ? 2000 : 500; // 2 seconds on mobile

  await new Promise(resolve => setTimeout(resolve, waitTime));

  // Get the session directly from Supabase
  const { data: { session }, error } = await supabase.auth.getSession();

  // ... rest of the function
};
```

### Mobile Testing Checklist

- [ ] Test on iOS Safari
- [ ] Test on iOS Chrome
- [ ] Test on Android Chrome
- [ ] Test on Android Firefox
- [ ] Test on slow 3G network (Chrome DevTools Network throttling)
- [ ] Test with private/incognito mode
- [ ] Test with cleared cache/cookies

### Mobile-Specific Logging

Add this to AuthCallback.js to debug mobile issues:

```javascript
useEffect(() => {
  // Mobile detection and logging
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const browser = userAgent.match(/(chrome|safari|firefox|edge)/i)?.[0] || 'unknown';

  console.log('📱 Device Info:', {
    isMobile,
    browser,
    userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  });

  // Rest of handleCallback logic...
}, []);
```

---

## Part 2: Supabase Dev Mode for Infinite Test Emails

### Method 1: Using Gmail Aliases (Best for Quick Testing)

Gmail ignores dots and plus signs, so these all go to the same inbox:

```
nelson@gmail.com
nelson+test1@gmail.com
nelson+test2@gmail.com
nelson+test3@gmail.com
n.e.l.s.o.n@gmail.com
nel.son@gmail.com
```

**Usage**:
1. Use your real Gmail address as the base
2. Add `+anything` before the @
3. Each variation is treated as a unique email by Supabase
4. All emails go to your single Gmail inbox

**Example Testing Flow**:
```bash
# Test signup
Email: nelson+signup1@gmail.com
Password: testpassword123

# Test another signup
Email: nelson+signup2@gmail.com
Password: testpassword123

# Test OAuth flow
Email: nelson+oauth1@gmail.com
Password: testpassword123
```

### Method 2: Supabase Local Dev (Best for Full Development)

#### Setup Supabase CLI and Local Instance

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize Supabase in your project
cd /Users/Nelson/adviceApp/adviceApp-7
supabase init

# Start local Supabase (PostgreSQL, Auth, Storage, etc.)
supabase start
```

This gives you:
- Local PostgreSQL database
- Local Auth server
- Local Storage server
- **Automatic email capture** - all emails are logged, no need to verify

#### Configure Local Dev

```bash
# supabase/config.toml will be created

# Key settings for local dev:
[auth]
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false  # 🔥 This is the magic - no email confirmation needed!

[auth.sms]
enable_signup = false
```

#### Connect Your App to Local Supabase

Create `.env.local` for local development:

```bash
# .env.local
REACT_APP_SUPABASE_URL=http://localhost:54321
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
REACT_APP_API_BASE_URL=http://localhost:3001
```

**Start local dev**:
```bash
# Terminal 1: Start local Supabase
supabase start

# Terminal 2: Start backend
cd backend
npm start

# Terminal 3: Start frontend
npm start
```

#### View Local Emails (Inbucket)

When running `supabase start`, you get Inbucket email testing:

```
Inbucket URL: http://localhost:54324
```

**All emails sent by Supabase are captured here!**

You can:
- View confirmation emails
- Click confirmation links
- Test email templates
- No real email needed

#### Testing Flow with Local Supabase

```javascript
// Sign up with ANY email (doesn't need to exist)
Email: test1@example.com
Password: testpassword123

// Check Inbucket
// Go to: http://localhost:54324
// Click on test1@example.com
// See confirmation email
// Click confirmation link (or skip if confirmations disabled)

// Sign up with another fake email
Email: test2@example.com
Password: testpassword123

// Infinite fake emails work!
```

### Method 3: Disable Email Confirmation in Production (Temporary)

**⚠️ WARNING: Only use for testing, re-enable for production**

In Supabase Dashboard → Authentication → Email Auth:
1. Disable "Confirm email"
2. Users can sign up without email verification
3. ✅ Instant testing with any email
4. ❌ Security risk - **only for dev/testing**

Remember to re-enable before going live!

### Method 4: Use Temporary Email Services

For quick testing without setup:

- https://temp-mail.org
- https://10minutemail.com
- https://guerrillamail.com

**Usage**:
1. Go to temp email site
2. Copy temporary email address
3. Use it to sign up in your app
4. Go back to temp email site to see confirmation email
5. Click confirmation link

**Cons**:
- Manual process
- Emails expire quickly
- Can't automate testing

---

## Recommended Testing Setup

### For Quick Manual Testing:
**Use Gmail Aliases** (Method 1)
```
your.email+test1@gmail.com
your.email+test2@gmail.com
your.email+test3@gmail.com
```

### For Full Development:
**Use Local Supabase** (Method 2)
```bash
supabase start
# All emails captured in Inbucket
# No confirmation needed
# Infinite fake emails
```

### For Automated E2E Testing:
**Local Supabase + Cypress/Playwright**
```javascript
// cypress/e2e/auth.cy.js
describe('Authentication', () => {
  it('should sign up with fake email', () => {
    const testEmail = `test${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('testpassword123');
    cy.get('button[type="submit"]').click();
    // No email confirmation needed with local Supabase!
    cy.url().should('include', '/onboarding');
  });
});
```

---

## Mobile Debug Commands

### iOS Safari Remote Debugging
1. Enable Web Inspector on iPhone: Settings → Safari → Advanced → Web Inspector
2. Connect iPhone to Mac via USB
3. Open Safari on Mac → Develop → [Your iPhone] → [Your App]
4. See full console logs, network requests, storage

### Android Chrome Remote Debugging
1. Enable USB Debugging on Android: Settings → Developer Options → USB Debugging
2. Connect Android to computer via USB
3. Open Chrome on computer → `chrome://inspect`
4. See your device → Inspect
5. Full DevTools available

### Check Session Storage on Mobile
Run this in mobile browser console:
```javascript
// Check if session exists
console.log('Session:', localStorage.getItem('supabase.auth.token'));

// Check user info
supabase.auth.getSession().then(({data}) => console.log('Session:', data));

// Check if on mobile
console.log('Is Mobile:', /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
```

---

## Quick Fix Implementation

Add this file to apply mobile fixes immediately:

```javascript
// src/utils/mobileAuthFix.js

export const isMobile = () => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const getMobileWaitTime = () => {
  return isMobile() ? 2000 : 500; // 2s mobile, 500ms desktop
};

export const logMobileDebugInfo = () => {
  if (!isMobile()) return;

  console.log('📱 Mobile Auth Debug Info:', {
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    supabaseToken: !!localStorage.getItem('supabase.auth.token')
  });
};

// Call this on app load
logMobileDebugInfo();
```

Then import and use in AuthCallback.js:
```javascript
import { isMobile, getMobileWaitTime, logMobileDebugInfo } from '../utils/mobileAuthFix';

// In handleOAuthCallback
await new Promise(resolve => setTimeout(resolve, getMobileWaitTime()));
```

---

## Next Steps

1. **Test current mobile auth** with remote debugging
2. **Set up local Supabase** for unlimited testing
3. **Apply mobile fixes** if issues found
4. **Add mobile logging** to capture real issues
5. **Test on real devices** (iOS Safari, Android Chrome)

Let me know what specific errors you're seeing on mobile and I can help debug further!
