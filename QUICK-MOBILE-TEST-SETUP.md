# Quick Setup: Test Mobile Login with Infinite Emails

## Option 1: Gmail Aliases (Fastest - 30 seconds)

Use your existing Gmail address with variations:

```
your.email@gmail.com          → Original
your.email+test1@gmail.com    → Test account 1
your.email+test2@gmail.com    → Test account 2
your.email+test3@gmail.com    → Test account 3
your.email+mobile1@gmail.com  → Mobile test 1
your.email+ios@gmail.com      → iOS test
your.email+android@gmail.com  → Android test
```

**All go to your single Gmail inbox!**

### Testing Flow:
1. Open your app on mobile: https://adviceapp.pages.dev
2. Click "Sign up" or "Sign in"
3. Use: `your.email+mobile1@gmail.com`
4. Password: `TestPassword123!`
5. Check your Gmail inbox for confirmation email
6. Click confirmation link
7. Should redirect to app and complete login

**Repeat with +mobile2, +mobile3, etc. for unlimited tests**

---

## Option 2: Local Supabase (Best for Development)

### Setup (5 minutes):

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize in your project
cd /Users/Nelson/adviceApp/adviceApp-7
supabase init

# Start local Supabase
supabase start
```

You'll see output like:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324  ← Email testing!
```

### Disable Email Confirmation (in supabase/config.toml):

```toml
[auth.email]
enable_confirmations = false  # No email needed!
```

### Create .env.local for local dev:

```bash
REACT_APP_SUPABASE_URL=http://localhost:54321
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Testing with Infinite Emails:

```bash
# Start local Supabase
supabase start

# Start your app
npm start

# Now sign up with ANY email:
test1@example.com
test2@example.com
mobile-user@example.com
anything@fake.com

# No confirmation needed!
# All emails captured in: http://localhost:54324
```

---

## Mobile Remote Debugging

### iOS Safari:
1. iPhone: Settings → Safari → Advanced → Enable "Web Inspector"
2. Connect iPhone to Mac with USB
3. Mac Safari → Develop → [Your iPhone] → [Your Site]
4. Full console access!

### Android Chrome:
1. Android: Settings → Developer Options → USB Debugging
2. Connect to computer
3. Chrome → `chrome://inspect`
4. Click "Inspect" under your device
5. Full DevTools!

---

## Check Mobile Auth Status

On mobile browser console, run:

```javascript
// Check session
localStorage.getItem('supabase.auth.token')

// Check mobile detection
/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Get session info
supabase.auth.getSession().then(({data}) => console.log(data))
```

---

## Mobile Auth Logs

When you log in on mobile, you'll now see:

```
📱 Mobile Auth Debug Info: {
  isMobile: true,
  browser: "safari",
  screenSize: "390x844",
  localStorage: true,
  supabaseToken: true
}

⏱️ Waiting 2000ms for session (mobile: true)...
✅ OAuth session established: your.email@gmail.com
```

If you see errors, check [MOBILE-AUTH-DEBUGGING-GUIDE.md](MOBILE-AUTH-DEBUGGING-GUIDE.md) for solutions.

---

## Quick Test Checklist

- [ ] Test Gmail alias signup: `your.email+test1@gmail.com`
- [ ] Check email in Gmail inbox
- [ ] Click confirmation link
- [ ] Verify login successful
- [ ] Test on iOS Safari (if available)
- [ ] Test on Android Chrome (if available)
- [ ] Check browser console for mobile logs
- [ ] Verify session persists after page refresh

---

## Common Issues

### "Authentication failed" on mobile
→ Session timeout on slow network
→ **Fixed**: Now waits 2s on mobile (vs 500ms desktop)

### "Login works but logs out on refresh"
→ Safari private mode blocking localStorage
→ **Solution**: Exit private/incognito mode

### OAuth stuck in redirect loop
→ Mobile browser not handling redirect properly
→ **Check**: Browser console for specific error

### Can't see console logs on mobile
→ Need remote debugging enabled
→ **See**: iOS Safari or Android Chrome debugging above

---

## For Full Details

See [MOBILE-AUTH-DEBUGGING-GUIDE.md](MOBILE-AUTH-DEBUGGING-GUIDE.md) for:
- Complete mobile debugging guide
- All Supabase dev mode methods
- Advanced troubleshooting
- E2E testing setup
- Production deployment checklist
