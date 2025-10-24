# 🧪 TESTING STEPS - Multi-Calendar Switching

**Status:** ✅ READY TO TEST  
**Date:** 2025-10-24  

---

## 📋 TEST PLAN

### Test 1: Register Without Calendar (2 minutes)

**Objective:** Verify users can register and skip calendar setup

**Steps:**
```
1. Open https://adviceapp.pages.dev/register
2. Click "Sign up with Email"
3. Fill in:
   - Name: Test User 1
   - Email: testuser1@example.com
   - Password: TestPassword123!
   - Confirm Password: TestPassword123!
4. Click "Sign Up"
5. Complete onboarding:
   - Business Name: Test Business 1
   - Business Type: Financial Advisor
   - Team Size: 1
   - Timezone: (your timezone)
6. Click "Next"
7. On "Sync your meetings" page, click "Next" (skip sync)
8. Click "Go to Dashboard"
```

**Expected Results:**
- ✅ Dashboard loads successfully
- ✅ "No meetings" message appears
- ✅ No calendar connected yet
- ✅ Can access all pages (Clients, Pipeline, etc.)

**Pass/Fail:** ___________

---

### Test 2: Connect First Calendar (3 minutes)

**Objective:** Verify users can connect Google Calendar

**Steps:**
```
1. From dashboard, click Settings (gear icon)
2. Click "Calendar Integrations"
3. Click "Connect Google Calendar"
4. Select your Google account
5. Click "Allow" to grant permissions
6. Wait for redirect back to Settings
```

**Expected Results:**
- ✅ Google Calendar appears in "Current Connection" section
- ✅ Shows "Connected" status
- ✅ Shows your Google email
- ✅ Shows "Last sync" with recent timestamp
- ✅ Meetings appear in Meetings page
- ✅ No errors in browser console

**Pass/Fail:** ___________

---

### Test 3: Connect Second Calendar (3 minutes)

**Objective:** Verify users can connect Calendly without re-authenticating Google

**Steps:**
```
1. Still in Settings → Calendar Integrations
2. Scroll down to "Switch Calendar" section
3. Click "Connect Calendly"
4. Choose authentication method:
   - Option A: OAuth (if available)
   - Option B: Personal Access Token
5. Complete authentication
6. Wait for redirect back to Settings
```

**Expected Results:**
- ✅ Google Calendar moves to "Available Calendars" (inactive)
- ✅ Calendly appears in "Current Connection" (active)
- ✅ "Last sync" updates to recent time
- ✅ Meetings now show from Calendly
- ✅ No errors in browser console

**Pass/Fail:** ___________

---

### Test 4: Switch Back to Google (1 minute) - KEY TEST!

**Objective:** Verify one-click switching WITHOUT re-authentication

**Steps:**
```
1. Still in Settings → Calendar Integrations
2. Scroll to "Available Calendars" section
3. Find Google Calendar
4. Click "Switch to Google Calendar"
5. Observe what happens
```

**Expected Results:**
- ✅ NO OAuth popup appears (this is the key!)
- ✅ Instant switch (no loading delay)
- ✅ Google moves to "Current Connection" (active)
- ✅ Calendly moves to "Available Calendars" (inactive)
- ✅ "Last sync" updates
- ✅ Meetings sync from Google again
- ✅ No errors in browser console

**Pass/Fail:** ___________

---

### Test 5: Security Isolation (5 minutes)

**Objective:** Verify users can't see each other's calendar data

**Steps:**
```
1. Open TWO browser windows (or use incognito)

WINDOW 1:
2. Go to https://adviceapp.pages.dev/register
3. Sign up as: testuser2@example.com
4. Complete onboarding
5. Connect Google Calendar
6. Go to Settings → Calendar Integrations
7. Note: You see ONLY your Google connection

WINDOW 2:
8. Go to https://adviceapp.pages.dev/register
9. Sign up as: testuser3@example.com
10. Complete onboarding
11. Connect Calendly
12. Go to Settings → Calendar Integrations
13. Note: You see ONLY your Calendly connection

BACK TO WINDOW 1:
14. Refresh Settings page
15. Check what you see
```

**Expected Results:**
- ✅ User 2 sees ONLY their Google connection
- ✅ User 2 does NOT see User 3's Calendly
- ✅ User 3 sees ONLY their Calendly connection
- ✅ User 3 does NOT see User 2's Google
- ✅ Complete data isolation
- ✅ No errors in browser console

**Pass/Fail:** ___________

---

### Test 6: Multiple Switches (2 minutes)

**Objective:** Verify repeated switching works smoothly

**Steps:**
```
1. In Settings → Calendar Integrations
2. Switch to Calendly
3. Wait 5 seconds
4. Switch to Google
5. Wait 5 seconds
6. Switch to Calendly
7. Wait 5 seconds
8. Switch to Google
```

**Expected Results:**
- ✅ All switches instant (no re-auth)
- ✅ No errors
- ✅ Meetings update correctly
- ✅ "Last sync" updates each time
- ✅ No console errors

**Pass/Fail:** ___________

---

## 📊 TEST SUMMARY

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. Register without calendar | ☐ | ☐ | |
| 2. Connect first calendar | ☐ | ☐ | |
| 3. Connect second calendar | ☐ | ☐ | |
| 4. Switch back (no re-auth) | ☐ | ☐ | KEY TEST |
| 5. Security isolation | ☐ | ☐ | |
| 6. Multiple switches | ☐ | ☐ | |

---

## 🐛 TROUBLESHOOTING

**If Test 4 shows OAuth popup:**
- ❌ FAIL - Tokens not persisting
- Check: `calendar_connections` table has `access_token`
- Check: Backend code is deployed (commit f000fb4)

**If Test 5 shows other user's data:**
- ❌ FAIL - Security breach
- Check: RLS policies are enabled
- Check: `auth.uid()` is set correctly
- Contact support immediately

**If any test shows console errors:**
- ❌ FAIL - Check browser console (F12)
- Check: Backend logs in Render dashboard
- Check: Network tab for failed requests

---

## ✅ SUCCESS CRITERIA

All tests pass when:
- ✅ Can register without calendar
- ✅ Can connect first calendar
- ✅ Can connect second calendar
- ✅ Can switch calendars instantly (NO re-auth)
- ✅ Meetings sync from active calendar
- ✅ Users can't see each other's data
- ✅ No errors in console or logs

---

**Ready to test?** Start with Test 1!

**Report Results:** ___________

