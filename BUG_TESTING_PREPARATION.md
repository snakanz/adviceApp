# 🧪 BUG TESTING PREPARATION - Advicly Platform

**Status:** ✅ READY FOR COMPREHENSIVE BUG TESTING  
**Date:** 2025-10-26  
**Latest Commits:** 8c55c98, 0a4e257, 2bd531a, d74987d

---

## 📋 WHAT'S BEEN IMPLEMENTED

### ✅ Calendly Webhook Engagement System
- Automatic webhook verification on user login
- 30-second periodic webhook status refresh
- Real-time sync indicators (⚡ or 🕐)
- Fallback to polling if webhook fails
- Comprehensive logging for debugging

### ✅ Calendar Switching UI
- **Active Calendar** - Blue border, pulsing "ACTIVE - Fetching Meetings" badge
- **Inactive Calendars** - Gray border, "Connected" badge
- **One-click switching** - Click card or "Switch to This" button
- **Clear status display** - Sync method and last sync time for active calendar only
- **Professional design** - Clean, minimal, responsive

### ✅ Multi-Calendar Architecture
- `calendar_connections` table for multiple calendars per user
- `calendar_watch_channels` for Google Calendar webhooks
- `calendly_webhook_events` for Calendly webhook tracking
- Automatic sync on calendar switch
- Webhook-based real-time sync with polling fallback

---

## 🎯 CRITICAL TESTS TO RUN

### Test 1: Calendar Switching UI (5 minutes)
**What to test:** Visual design and switching functionality

```
1. Go to Settings → Calendar Integrations
2. Verify active calendar has:
   - Blue border and background
   - "⚡ ACTIVE - Fetching Meetings" badge (pulsing)
   - Sync status (⚡ Real-time or 🕐 Polling)
   - Last sync timestamp
   - "Disconnect" button

3. Verify inactive calendars have:
   - Gray border and background
   - "✓ Connected" badge
   - "Switch to This" button
   - NO sync status or last sync time

4. Click "Switch to This" on inactive calendar
   - Should switch instantly
   - No OAuth popup
   - UI updates immediately
   - Success message appears

5. Click on active calendar card
   - Should show "Disconnect" button
   - Click "Disconnect" to remove
```

**Expected Results:**
- ✅ Clear visual distinction between active/inactive
- ✅ One-click switching works
- ✅ No re-authentication needed
- ✅ UI updates instantly
- ✅ Success messages appear

**Pass/Fail:** ___________

---

### Test 2: Calendly Webhook Engagement (5 minutes)
**What to test:** Webhook verification and status display

```
1. Log in to Advicly
2. Open browser console (F12)
3. Look for webhook verification logs:
   - "🔍 Verifying webhooks on login..."
   - "✅ Calendly webhook verified active"
   - Or "⚠️ Calendly using polling sync"

4. Go to Settings → Calendar Integrations
5. If Calendly is active, check status:
   - Should show ⚡ Real-time sync active (if webhook working)
   - Or 🕐 Polling sync (15 min) (if webhook not active)

6. Stay on Calendar Settings for 30+ seconds
7. Check console for periodic refresh:
   - "🔄 Refreshing webhook status..."
   - Should appear every 30 seconds
```

**Expected Results:**
- ✅ Webhook verification logs appear on login
- ✅ Webhook status shows correctly
- ✅ Periodic refresh happens every 30 seconds
- ✅ No console errors
- ✅ Status updates correctly

**Pass/Fail:** ___________

---

### Test 3: Multi-Calendar Switching (5 minutes)
**What to test:** Switching between multiple calendars

```
1. Have both Google Calendar and Calendly connected
2. Go to Settings → Calendar Integrations
3. Switch to Google Calendar
   - Wait 5 seconds
   - Verify meetings sync from Google
   - Check "Last synced" timestamp updates

4. Switch to Calendly
   - Wait 5 seconds
   - Verify meetings sync from Calendly
   - Check "Last synced" timestamp updates

5. Switch back to Google
   - Verify instant switch (no re-auth)
   - Verify meetings update

6. Repeat 2-3 times
   - All switches should be instant
   - No OAuth popups
   - No errors
```

**Expected Results:**
- ✅ All switches instant (no re-auth)
- ✅ Meetings update from correct calendar
- ✅ Last sync timestamp updates
- ✅ No console errors
- ✅ No OAuth popups

**Pass/Fail:** ___________

---

### Test 4: Webhook Status Accuracy (5 minutes)
**What to test:** Webhook status reflects actual state

```
1. Go to Settings → Calendar Integrations
2. If Calendly is active:
   - Check if showing ⚡ Real-time sync active
   - This means webhook is working

3. If showing 🕐 Polling sync (15 min):
   - This means webhook is not active
   - Check environment variable: CALENDLY_WEBHOOK_SIGNING_KEY
   - Check Calendly dashboard for webhook subscription

4. Add a meeting to your calendar
5. Wait for sync:
   - If ⚡ Real-time: Should appear in 1-2 seconds
   - If 🕐 Polling: Should appear within 15 minutes

6. Check Meetings page
   - New meeting should appear
   - Should show correct calendar source
```

**Expected Results:**
- ✅ Webhook status accurate
- ✅ Real-time sync works (1-2 seconds)
- ✅ Polling sync works (within 15 minutes)
- ✅ Meetings appear in correct calendar
- ✅ No errors

**Pass/Fail:** ___________

---

### Test 5: Data Isolation (5 minutes)
**What to test:** Users can't see each other's calendars

```
1. Open TWO browser windows (or incognito)

WINDOW 1:
2. Sign in as user1@example.com
3. Connect Google Calendar
4. Go to Settings → Calendar Integrations
5. Note the calendar shown

WINDOW 2:
6. Sign in as user2@example.com
7. Connect Calendly
8. Go to Settings → Calendar Integrations
9. Note the calendar shown

BACK TO WINDOW 1:
10. Refresh Settings page
11. Verify you ONLY see your Google Calendar
12. You should NOT see user2's Calendly
```

**Expected Results:**
- ✅ User 1 sees ONLY their Google Calendar
- ✅ User 1 does NOT see User 2's Calendly
- ✅ User 2 sees ONLY their Calendly
- ✅ User 2 does NOT see User 1's Google
- ✅ Complete data isolation

**Pass/Fail:** ___________

---

### Test 6: Error Handling (5 minutes)
**What to test:** Graceful error handling

```
1. Go to Settings → Calendar Integrations
2. Open browser console (F12)
3. Disconnect all calendars
4. Try to switch to a calendar (should fail gracefully)
5. Reconnect a calendar
6. Check for any console errors
7. Verify error messages are user-friendly
```

**Expected Results:**
- ✅ No console errors
- ✅ Error messages are clear
- ✅ App doesn't crash
- ✅ Can recover from errors
- ✅ Logging is helpful for debugging

**Pass/Fail:** ___________

---

## 📊 TEST SUMMARY TABLE

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. Calendar Switching UI | ☐ | ☐ | Visual design & switching |
| 2. Webhook Engagement | ☐ | ☐ | Verification & status |
| 3. Multi-Calendar Switching | ☐ | ☐ | Multiple switches |
| 4. Webhook Status Accuracy | ☐ | ☐ | Real-time vs polling |
| 5. Data Isolation | ☐ | ☐ | Security |
| 6. Error Handling | ☐ | ☐ | Graceful failures |

---

## 🔍 DEBUGGING CHECKLIST

### Browser Console (F12)
- [ ] No red errors
- [ ] Webhook verification logs appear on login
- [ ] Periodic refresh logs appear every 30 seconds
- [ ] Calendar switch logs appear

### Network Tab (F12)
- [ ] POST /api/auth/verify-webhooks succeeds
- [ ] PATCH /api/calendar-connections/:id/toggle-sync succeeds
- [ ] GET /api/calendar-connections/:id/webhook-status succeeds
- [ ] No 404 or 500 errors

### Backend Logs (Render Dashboard)
- [ ] No errors on webhook verification
- [ ] No errors on calendar switch
- [ ] Sync operations complete successfully
- [ ] Webhook status checks work

### Database (Supabase)
- [ ] calendar_connections table has correct data
- [ ] is_active field updates on switch
- [ ] access_token is stored securely
- [ ] last_sync_at updates correctly

---

## 📝 RECENT COMMITS

1. **8c55c98** - Calendar switching UI with active/inactive status
2. **0a4e257** - Calendar switching UI guide
3. **2bd531a** - Calendar switching complete summary
4. **d74987d** - Calendar switching quick reference

---

## 🚀 DEPLOYMENT STATUS

✅ **Frontend** - Deployed to Cloudflare Pages (auto-deploys)
✅ **Backend** - Deployed to Render (auto-deploys)
✅ **Database** - Supabase (no schema changes)

**All changes are live!**

---

## 📚 DOCUMENTATION

- **CALENDAR_SWITCHING_UI_GUIDE.md** - Comprehensive UI guide
- **CALENDAR_SWITCHING_COMPLETE.md** - Complete implementation
- **CALENDAR_SWITCHING_QUICK_REFERENCE.md** - Quick reference
- **CALENDLY_WEBHOOK_ENGAGEMENT.md** - Webhook system
- **TESTING_STEPS_MULTI_CALENDAR.md** - Original testing steps

---

## ✅ READY TO TEST

Everything is committed, pushed, and deployed. Ready for comprehensive bug testing!

**Start with Test 1 and work through all 6 tests.**

**Report any issues found and we'll fix them in the next chat!**

