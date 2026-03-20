# 🧪 Testing Calendar Sync During Signup

## ✅ Quick Test (5 minutes)

### Step 1: Clear Browser Cache
```
1. Open DevTools (F12)
2. Go to Application tab
3. Clear Cookies and Local Storage for adviceapp.pages.dev
4. Close and reopen browser
```

### Step 2: Start Fresh Signup
```
1. Go to https://adviceapp.pages.dev/signup
2. Sign up with NEW email (e.g., test-sync-123@gmail.com)
3. Complete Google OAuth
```

### Step 3: Connect Google Calendar
```
1. On "Connect your calendar" step
2. Click "Connect Google Calendar"
3. Authorize Advicly to access your calendar
4. Should see "Connected ✅"
5. Click "Continue"
```

### Step 4: Complete Onboarding
```
1. Fill in Business Profile
2. Select subscription plan (Free or Paid)
3. Click "Complete Setup"
```

### Step 5: Check Dashboard
```
1. Wait 10-15 seconds
2. Go to Meetings page
3. Should see your Google Calendar meetings! ✅
```

---

## 🔍 Verify in Logs

Go to: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730

**Logs tab** → Search for your email or timestamp

### Expected Log Sequence

```
✅ User signed up successfully
✅ Google Calendar connection created successfully
⏭️  Skipping webhook setup and sync during onboarding
✅ User completed onboarding with active subscription
🔄 Triggering calendar sync after onboarding completion...
📅 Fetching events from [timestamp] to future...
📊 Found X events in calendar
✅ Calendar sync completed after onboarding: {added: X, updated: 0}
```

---

## ❌ Troubleshooting

### No meetings appear after 30 seconds

**Check logs for errors:**
- Search for: `Calendar sync failed`
- Look for: `Error fetching events`

**Possible causes:**
- Google Calendar is empty (add test event)
- Token refresh failed (check 401 errors)
- Sync service crashed (check error logs)

### Meetings appear but incomplete

- Check if attendees/descriptions are missing
- Verify Google Calendar API is enabled
- Check token has correct scopes

---

## 📊 Success Criteria

✅ Meetings appear on dashboard after signup  
✅ No manual reconnect needed  
✅ Sync completes within 30 seconds  
✅ Logs show successful sync  
✅ Meetings have correct titles/times  
✅ Clients are auto-created from attendees  

---

## 🚀 Next Steps

After confirming this works:
1. Test with multiple users
2. Test with different calendar providers (Calendly, Outlook)
3. Test with large calendars (100+ events)
4. Monitor production for sync errors

