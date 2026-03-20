# Quick Fix: Meetings Not Showing

## 🚨 The Issue

Meetings are not appearing in the Meetings page, even though Google Calendar is connected.

## ⚡ Quick Fixes (Try These First)

### Fix #1: Refresh Your Login (Most Common)
**This fixes 80% of cases!**

1. **Log out** of Advicly
   - Click your profile icon
   - Click "Log out"

2. **Log back in** with Google
   - Click "Sign in with Google"
   - Complete OAuth flow

3. **Wait 10-15 seconds** for initial sync

4. **Go to Meetings page**
   - Meetings should now appear

**Why this works:** Your JWT token expired. Logging back in creates a new token and triggers the initial sync.

---

### Fix #2: Reconnect Google Calendar
**If Fix #1 doesn't work:**

1. **Go to Settings → Calendar Integrations**

2. **Click "Disconnect"**
   - This stops the old webhook

3. **Click "Connect Google Calendar"**
   - Complete OAuth flow

4. **Wait 10-15 seconds** for initial sync
   - Watch for "Last sync" to update

5. **Go to Meetings page**
   - Meetings should now appear

**Why this works:** Reconnecting triggers the initial sync to fetch all existing meetings.

---

### Fix #3: Check Your Connection Status
**Verify the connection is working:**

1. **Go to Settings → Calendar Integrations**

2. **Look for "Current Connection" section**
   - Should show "Google Calendar" with green checkmark
   - Should show "Connected" status
   - Should show "Sync enabled" (green)

3. **Check "Last sync" timestamp**
   - Should show a recent time (not "Never")
   - If "Never", try Fix #2

4. **If still "Never":**
   - Check backend logs on Render
   - Look for "Setting up Google Calendar watch" message
   - Look for "Initial sync completed" message

---

## 🔍 Verify It's Working

### Test 1: Check Settings
- ✅ Google Calendar shows "Connected"
- ✅ "Last sync" shows recent time
- ✅ "Sync enabled" is green

### Test 2: Create a Test Meeting
1. Open Google Calendar in another tab
2. Create a new meeting
3. Go back to Advicly Meetings page
4. Wait 5 seconds
5. Refresh the page
6. New meeting should appear

### Test 3: Check Database (Advanced)
If meetings still don't appear, check the database:

```sql
-- Go to Supabase SQL Editor and run:
SELECT COUNT(*) as total_meetings
FROM meetings
WHERE userid = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```

If this returns 0, no meetings are in the database.

---

## 🆘 If Nothing Works

### Step 1: Check Backend Logs
1. Go to Render dashboard
2. Select your backend service
3. Go to "Logs"
4. Look for these messages:
   - "Setting up Google Calendar watch" ✅ Good
   - "Initial sync completed" ✅ Good
   - "Webhook setup failed" ❌ Problem
   - "Token expired" ❌ Problem

### Step 2: Check Database Migration
1. Go to Supabase SQL Editor
2. Run this query:
```sql
SELECT * FROM calendar_watch_channels LIMIT 1;
```

3. If you get an error "table does not exist":
   - Run migration: `backend/migrations/025_update_calendar_watch_channels_for_uuid.sql`
   - Then reconnect Google Calendar

### Step 3: Verify Google Calendar Connection
1. Go to Settings → Calendar Integrations
2. Check the account email shown
3. Verify it's the correct Google account
4. If wrong account, disconnect and reconnect with correct account

---

## 📋 Troubleshooting Checklist

- [ ] Logged out and logged back in?
- [ ] Checked "Last sync" timestamp in Settings?
- [ ] Tried reconnecting Google Calendar?
- [ ] Created a test meeting in Google Calendar?
- [ ] Waited 5 seconds and refreshed?
- [ ] Checked backend logs on Render?
- [ ] Verified database migration was run?
- [ ] Checked if meetings exist in database?

---

## 🎯 Most Likely Causes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Last sync: Never" | Initial sync didn't run | Reconnect Google Calendar |
| Meetings appear then disappear | Token expired | Log out and log back in |
| Connection shows "Connected" but no meetings | Database migration not run | Run migration 025 |
| Meetings appear in Google Calendar but not Advicly | Webhook not set up | Reconnect Google Calendar |
| Error message in Settings | Backend issue | Check Render logs |

---

## 🚀 Expected Behavior

### When You Connect Google Calendar:
1. ✅ OAuth flow completes
2. ✅ "Connected" status shows in Settings
3. ✅ Webhook is automatically set up
4. ✅ Initial sync fetches all meetings
5. ✅ "Last sync" shows recent time
6. ✅ Meetings appear in Meetings page

### When You Create a Meeting in Google Calendar:
1. ✅ Google sends webhook notification
2. ✅ Backend receives notification
3. ✅ Backend syncs the meeting
4. ✅ Meeting appears in Advicly within 5 seconds

---

## 📞 Still Need Help?

If you've tried all these fixes and meetings still don't appear:

1. **Share this information:**
   - User ID: `4c903cdf-85ba-4608-8be9-23ec8bbbaa7d`
   - "Last sync" timestamp from Settings
   - Backend logs from Render
   - Database query results

2. **Check these files for more details:**
   - `MEETINGS_NOT_SHOWING_DIAGNOSIS.md` - Detailed diagnosis
   - `AUTOMATIC_WEBHOOK_SYNC_GUIDE.md` - How webhook sync works
   - `RUN_WEBHOOK_MIGRATION.md` - Database migration instructions

3. **Contact support** with the information above

