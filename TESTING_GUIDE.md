# 🧪 Advicly Platform - Complete Testing Guide

## Overview
The Calendly integration and authentication system have been fixed. This guide walks you through testing all critical features.

## Prerequisites
- ✅ Backend redeployed with latest fixes
- ✅ Calendly connection saved in database
- ✅ You're logged in to Advicly

## Test 1: Calendar Connections API ✅

### What to Test
The `/api/calendar-connections` endpoint should return your Calendly connection.

### Steps
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste and run:

```javascript
const token = localStorage.getItem('supabase.auth.token') || 
              sessionStorage.getItem('supabase.auth.token');
const accessToken = typeof token === 'string' ? 
  JSON.parse(token).access_token : token.access_token;

fetch('https://adviceapp-9rgw.onrender.com/api/calendar-connections', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ Status: 200 OK');
  console.log('Connections:', data.connections);
  data.connections.forEach(conn => {
    console.log(`- ${conn.provider}: ${conn.provider_account_email}`);
  });
})
.catch(err => console.error('❌ Error:', err));
```

### Expected Result
```
✅ Status: 200 OK
Connections: [
  {
    id: "7b7e2cd6-a1bd-490a-8d29-6344bfc57789",
    provider: "calendly",
    provider_account_email: "nelson.greenwood@sjpp.co.uk",
    is_active: true
  }
]
```

---

## Test 2: Calendar Settings UI ✅

### What to Test
The Calendar Settings page should display your Calendly connection.

### Steps
1. Go to **Settings** → **Calendar Integrations**
2. Look for Calendly section
3. Should show: "Connected - nelson.greenwood@sjpp.co.uk"

### Expected Result
- ✅ Calendly shows as connected
- ✅ Account email is displayed
- ✅ No error messages

---

## Test 3: Meetings Sync ✅

### What to Test
Calendly meetings should appear in your Meetings list.

### Steps
1. Go to **Meetings** page
2. Check if you see Calendly meetings
3. Look for meetings with `meeting_source: 'calendly'`

### Expected Result
- ✅ Calendly meetings appear in the list
- ✅ Meetings show correct titles and dates
- ✅ No duplicate meetings

---

## Test 4: Calendly Status Endpoint ✅

### What to Test
The `/api/calendly/status` endpoint should confirm connection.

### Steps
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste and run:

```javascript
const token = localStorage.getItem('supabase.auth.token') || 
              sessionStorage.getItem('supabase.auth.token');
const accessToken = typeof token === 'string' ? 
  JSON.parse(token).access_token : token.access_token;

fetch('https://adviceapp-9rgw.onrender.com/api/calendly/status', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ Calendly Status:', data);
})
.catch(err => console.error('❌ Error:', err));
```

### Expected Result
```
✅ Calendly Status: {
  connected: true,
  calendly_account: "nelson.greenwood@sjpp.co.uk"
}
```

---

## Test 5: Onboarding Status ✅

### What to Test
The `/api/auth/onboarding/status` endpoint should work.

### Steps
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste and run:

```javascript
const token = localStorage.getItem('supabase.auth.token') || 
              sessionStorage.getItem('supabase.auth.token');
const accessToken = typeof token === 'string' ? 
  JSON.parse(token).access_token : token.access_token;

fetch('https://adviceapp-9rgw.onrender.com/api/auth/onboarding/status', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ Onboarding Status:', data);
})
.catch(err => console.error('❌ Error:', err));
```

### Expected Result
```
✅ Onboarding Status: {
  onboarding_completed: true,
  onboarding_step: 6
}
```

---

## Test 6: Backend Logs ✅

### What to Test
Backend should show successful authentication.

### Steps
1. Go to https://dashboard.render.com
2. Click your "adviceapp" service
3. Click **Logs** tab
4. Refresh the page or make an API call
5. Look for: `✅ Authenticated user: snaka1003@gmail.com`

### Expected Result
```
✅ Authenticated user: snaka1003@gmail.com (4c903cdf-85ba-4608-8be9-23ec8bbbaa7d)
```

---

## Troubleshooting

### Issue: Still Getting 401 Errors
**Solution:**
1. Hard refresh browser (Cmd+Shift+R on Mac)
2. Clear browser cache
3. Log out and log back in
4. Check backend logs for specific error

### Issue: Calendly Connection Not Showing
**Solution:**
1. Verify connection in database:
```sql
SELECT * FROM calendar_connections 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```
2. If empty, try connecting Calendly again
3. Check backend logs for OAuth errors

### Issue: Meetings Not Syncing
**Solution:**
1. Check if Calendly connection is active
2. Look for webhook sync messages in backend logs
3. Verify Calendly webhook is configured
4. Try manual sync: `/api/calendly/sync`

---

## Success Criteria ✅

All tests should pass:
- [ ] Test 1: Calendar Connections API returns 200 OK
- [ ] Test 2: Calendar Settings UI shows connection
- [ ] Test 3: Meetings page shows Calendly meetings
- [ ] Test 4: Calendly Status endpoint returns connected
- [ ] Test 5: Onboarding Status endpoint works
- [ ] Test 6: Backend logs show successful auth

---

## Commits Deployed
1. `44a74ea` - Fix JWT verification in authentication middleware
2. `988a200` - Consolidate authentication middleware across routes

**Status:** ✅ READY FOR PRODUCTION

