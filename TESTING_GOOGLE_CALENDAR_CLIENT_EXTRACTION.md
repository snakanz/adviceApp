# Testing Guide: Google Calendar Client Extraction

## 🚀 Deployment Status

**Commit**: `7a288e8`  
**Status**: Deployed to Render  
**Expected Build Time**: 3-5 minutes

---

## 📋 Pre-Testing Checklist

- [ ] Render deployment completed successfully
- [ ] Backend service is running
- [ ] Frontend is accessible
- [ ] You're logged in to Advicly

---

## 🧪 Test Scenario 1: New Meeting with Client Attendee

### Setup
1. Go to your Google Calendar
2. Create a new event with:
   - **Title**: "Meeting with John Smith"
   - **Attendees**: Add a client email (e.g., `client@example.com`)
   - **Time**: Any time in the future
   - **Save**: Click Save

### Expected Behavior
1. **Webhook triggers** (within 30 seconds)
2. **Meeting appears** on Advicly Meetings page
3. **Attendee shows** on meeting card
4. **Client extracted** automatically
5. **Clients page updated** with new client

### Verification Steps
1. Open Advicly in a new tab
2. Go to **Meetings** page
3. Look for your new meeting
4. Verify attendee email is shown
5. Go to **Clients** page
6. Look for "John Smith" or client name
7. Verify meeting count shows 1
8. Click on client to see meeting details

---

## 🧪 Test Scenario 2: Multiple Meetings Same Client

### Setup
1. Create a second meeting with the **same client email**
2. Different title, different time
3. Save to Google Calendar

### Expected Behavior
1. **Second meeting syncs** via webhook
2. **Same client recognized** (by email)
3. **Meeting linked** to existing client
4. **Meeting count increases** to 2

### Verification Steps
1. Refresh Advicly Clients page
2. Find the client
3. Verify meeting count shows **2**
4. Click to expand and see both meetings listed
5. Both should be grouped under same client

---

## 🧪 Test Scenario 3: Client Name Extraction

### Test Different Name Sources

#### Test 3a: displayName (Best Case)
- Create meeting with attendee who has full name in Google Contacts
- Expected: Client name = full name from contacts

#### Test 3b: Meeting Title Pattern
- Create meeting titled "Meeting with Sarah Johnson"
- Attendee: `sarah@example.com` (no displayName)
- Expected: Client name = "Sarah Johnson" (extracted from title)

#### Test 3c: Email Fallback
- Create meeting with attendee `john.doe@example.com`
- No displayName, no pattern match
- Expected: Client name = "John Doe" (formatted from email)

---

## 🧪 Test Scenario 4: Verify No Manual Button Needed

### Setup
1. Create a new Google Calendar meeting with client
2. Wait for webhook sync
3. Go to Clients page

### Expected Behavior
- Client appears **automatically**
- **No need** to click "Extract Clients" button
- Meeting is **already linked**

### Verification
- [ ] Client visible without manual extraction
- [ ] Meeting count is correct
- [ ] All meetings grouped properly

---

## 🔍 Debugging: Check Backend Logs

If clients aren't appearing, check Render logs:

```bash
# Look for these log messages:
"🔄 Starting client extraction for Google Calendar meetings..."
"✅ Client extraction completed for Google Calendar meetings:"
"👤 Created new client: [Name] ([Email])"
"Linked to [Name] ([Email])"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Client not appearing | Check if attendees JSON is valid in database |
| Wrong client name | Verify displayName in Google Calendar |
| Meeting not syncing | Check webhook is active in calendar_watch_channels |
| Extraction errors | Check Render logs for error messages |

---

## ✅ Success Criteria

All of these should be true:

- [ ] New Google Calendar meetings sync automatically
- [ ] Attendees data is captured
- [ ] Clients are extracted without manual button
- [ ] Client names are populated (not just emails)
- [ ] Multiple meetings grouped under same client
- [ ] Meeting count badge shows correct total
- [ ] Clients page displays all information correctly
- [ ] No errors in Render logs

---

## 📊 Expected Results

### Clients Page Should Show

```
┌─────────────────────────────────────────┐
│ Client Name          │ Email            │ Meetings │
├─────────────────────────────────────────┤
│ John Smith           │ john@example.com │    2     │
│ Sarah Johnson        │ sarah@example.com│    1     │
│ Mike Wilson          │ mike@example.com │    3     │
└─────────────────────────────────────────┘
```

### When Clicking on Client

```
Client: John Smith (john@example.com)

Meetings:
├─ Meeting with John Smith (Nov 1, 2024)
└─ Follow-up with John (Nov 8, 2024)
```

---

## 🎉 Completion

Once all tests pass, the implementation is complete and working correctly!

**Next Steps**: 
- Monitor for any issues
- Check Render logs periodically
- Report any anomalies

