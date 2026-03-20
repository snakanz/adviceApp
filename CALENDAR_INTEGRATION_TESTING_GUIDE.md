# Calendar Integration Testing Guide

## Pre-Testing Setup

### Environment
- Frontend: https://adviceapp.pages.dev
- Backend: https://adviceapp-9rgw.onrender.com
- Database: Supabase (xjqjzievgepqpgtggcjx)

### Test Accounts
- Primary Google Account: snaka1003@gmail.com
- Secondary Google Account: (optional, for testing account switching)
- Calendly Account: (optional, for testing Calendly integration)

### Database Migration
Before testing, ensure the migration has been applied:
```sql
-- Run on Supabase SQL Editor
SELECT * FROM calendar_connections LIMIT 1;
-- Should show tenant_id column is nullable
```

## Test Scenarios

### Scenario 1: Initial Google Calendar Connection

**Steps**:
1. Log out completely
2. Go to https://adviceapp.pages.dev/login
3. Click "Sign in with Google"
4. Authorize with snaka1003@gmail.com
5. Complete onboarding if needed
6. Navigate to Settings → Calendar Integrations

**Expected Results**:
- ✅ "Current Connection" section shows Google Calendar
- ✅ Account email (snaka1003@gmail.com) is displayed
- ✅ "Connected" status badge appears
- ✅ Green checkmark appears on Calendar Sync button in sidebar
- ✅ "Last sync" shows "Never" or recent time

**Database Check**:
```sql
SELECT id, provider, provider_account_email, is_active, sync_enabled 
FROM calendar_connections 
WHERE user_id = 'your_user_id' 
AND provider = 'google';
```
Should show one row with `is_active = true`

---

### Scenario 2: Reconnect with Same Account

**Steps**:
1. In Calendar Integrations, click "Connect Google Calendar"
2. Authorize with same account (snaka1003@gmail.com)
3. Observe the result

**Expected Results**:
- ✅ Connection updates (doesn't create duplicate)
- ✅ Still shows as active
- ✅ No error messages
- ✅ Green checkmark remains on sidebar button

**Database Check**:
```sql
SELECT COUNT(*) FROM calendar_connections 
WHERE user_id = 'your_user_id' 
AND provider = 'google' 
AND provider_account_email = 'snaka1003@gmail.com';
```
Should return 1 (not 2)

---

### Scenario 3: Switch to Different Google Account

**Steps**:
1. With Google Calendar connected, click "Connect Google Calendar" again
2. Authorize with different Google account (if available)
3. Observe the result

**Expected Results**:
- ✅ New account connection is created
- ✅ Previous account connection is deactivated
- ✅ Only new account shows in "Current Connection"
- ✅ Green checkmark still shows on sidebar
- ✅ New account email is displayed

**Database Check**:
```sql
SELECT provider_account_email, is_active 
FROM calendar_connections 
WHERE user_id = 'your_user_id' 
AND provider = 'google' 
ORDER BY created_at DESC;
```
Should show:
- Latest connection: `is_active = true`
- Previous connection: `is_active = false`

---

### Scenario 4: Connect Calendly

**Steps**:
1. With Google Calendar connected, click "Calendly" in "Add Calendar"
2. Enter Calendly API token
3. Click "Connect Calendly"

**Expected Results**:
- ✅ Google Calendar is deactivated
- ✅ Calendly appears in "Current Connection"
- ✅ Calendly email is displayed
- ✅ Green checkmark on sidebar
- ✅ Success message appears

**Database Check**:
```sql
SELECT provider, is_active 
FROM calendar_connections 
WHERE user_id = 'your_user_id' 
ORDER BY created_at DESC;
```
Should show:
- Calendly: `is_active = true`
- Google: `is_active = false`

---

### Scenario 5: Disable Sync

**Steps**:
1. With calendar connected, click "Disable Sync" button
2. Observe the result

**Expected Results**:
- ✅ Button changes to "Enable Sync"
- ✅ Connection remains active
- ✅ Green checkmark still shows (connection is active)
- ✅ Success message appears

**Database Check**:
```sql
SELECT is_active, sync_enabled 
FROM calendar_connections 
WHERE user_id = 'your_user_id' 
AND is_active = true;
```
Should show: `is_active = true, sync_enabled = false`

---

### Scenario 6: Disconnect Calendar

**Steps**:
1. Click "Disconnect" button on active connection
2. Confirm disconnection
3. Observe the result

**Expected Results**:
- ✅ Connection is removed from "Current Connection"
- ✅ "No calendar connected" message appears
- ✅ Red alert appears on Calendar Sync button
- ✅ "Add Calendar" section shows both options
- ✅ Success message appears

**Database Check**:
```sql
SELECT COUNT(*) FROM calendar_connections 
WHERE user_id = 'your_user_id' 
AND is_active = true;
```
Should return 0

---

### Scenario 7: Calendar Sync Button Status

**Steps**:
1. Observe Calendar Sync button in sidebar
2. Connect a calendar
3. Observe button status changes
4. Disconnect calendar
5. Observe button status changes

**Expected Results**:
- ✅ Red alert when no calendar connected
- ✅ Green checkmark when calendar connected
- ✅ Loading spinner briefly while checking
- ✅ Status updates within 30 seconds

---

## Error Scenarios

### Error 1: Database Connection Fails

**Trigger**: Disconnect database temporarily

**Expected Results**:
- ✅ Error message: "Database service unavailable"
- ✅ Graceful error handling
- ✅ No crashes

---

### Error 2: Invalid Calendly Token

**Trigger**: Enter invalid Calendly API token

**Expected Results**:
- ✅ Error message appears
- ✅ Connection not created
- ✅ Previous connection remains active

---

### Error 3: OAuth Cancellation

**Trigger**: Click "Cancel" during Google OAuth

**Expected Results**:
- ✅ Redirected back to Calendar Integrations
- ✅ No connection created
- ✅ Previous connection remains active

---

## Performance Tests

### Test 1: Page Load Time
- Calendar Integrations page should load in < 2 seconds
- Status indicator should update within 30 seconds

### Test 2: Connection Switch Time
- Switching calendars should complete in < 5 seconds
- Database should show deactivation immediately

### Test 3: Concurrent Requests
- Multiple rapid clicks should not create duplicate connections
- Database unique constraint should prevent duplicates

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Rollback Plan

If issues occur:

1. **Revert Code**: `git revert <commit-hash>`
2. **Revert Migration**: 
   ```sql
   ALTER TABLE calendar_connections 
   ALTER COLUMN tenant_id SET NOT NULL;
   ```
3. **Restart Backend**: Render will auto-deploy
4. **Clear Cache**: Users hard refresh

---

## Sign-Off

- [ ] All scenarios pass
- [ ] No error messages
- [ ] Database state is correct
- [ ] UI is responsive
- [ ] Performance is acceptable
- [ ] Ready for production

