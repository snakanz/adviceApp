# Google OAuth Fix - Testing Guide

## 🔧 What Was Fixed

**File:** `backend/src/routes/calendar.js` (lines 280-422)

**Issues Fixed:**
1. ❌ **Prisma not initialized** - Code used `prisma.user` but Prisma was never imported
2. ❌ **Wrong table name** - Used `prisma.calendarToken` instead of `calendar_connections`
3. ❌ **Missing tenant creation** - New users had no tenant
4. ❌ **No sync trigger** - Calendar meetings weren't being fetched

**Changes Made:**
- ✅ Replaced Prisma with Supabase `getSupabase()` calls
- ✅ Use `calendar_connections` table for storing tokens
- ✅ Create tenant for new users automatically
- ✅ Trigger background sync after connection
- ✅ Added comprehensive error handling and logging

---

## 🧪 Testing Steps

### Step 1: Delete Test User (Before Each Test)

**Option A: Using Supabase SQL Editor**
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy content from `backend/scripts/delete-test-user.sql`
4. Replace `'test@example.com'` with your test email
5. Run the query
6. Verify: `remaining_users` should be 0

**Option B: Using psql (if you have direct DB access)**
```bash
psql -h your-db-host -U postgres -d your-db-name -f backend/scripts/delete-test-user.sql
```

### Step 2: Test Signup Flow

1. **Start the backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Open the frontend:**
   - Go to `http://localhost:3000` (or your frontend URL)
   - Click "Sign up with Google"

3. **Complete OAuth:**
   - Use your test email
   - Authorize calendar access
   - Wait for redirect

4. **Check backend logs for:**
   ```
   ✅ Google OAuth login for: test@example.com
   ✅ Created new user: [UUID]
   ✅ Created new tenant: [UUID]
   ✅ Created new Google Calendar connection
   🔄 Triggering initial Google Calendar sync in background...
   ✅ Initial Google Calendar sync completed
   ```

### Step 3: Verify Database

**Check user was created:**
```sql
SELECT id, email, name, provider, tenant_id, onboarding_completed 
FROM users 
WHERE email = 'test@example.com';
```

**Check tenant was created:**
```sql
SELECT id, name, owner_id, timezone 
FROM tenants 
WHERE owner_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

**Check calendar connection:**
```sql
SELECT id, user_id, provider, is_active, is_primary, sync_enabled, transcription_enabled
FROM calendar_connections 
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

**Check meetings were synced:**
```sql
SELECT COUNT(*) as meeting_count
FROM meetings 
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

### Step 4: Verify Frontend

1. **Check if redirected to onboarding**
2. **Check if calendar shows as connected**
3. **Check if meetings appear on Meetings page**

---

## ✅ Success Criteria

- [ ] User created in database with UUID id
- [ ] Tenant created automatically
- [ ] Calendar connection created with all required fields
- [ ] `sync_enabled = true`
- [ ] `transcription_enabled = true`
- [ ] `is_primary = true`
- [ ] Background sync triggered
- [ ] Meetings fetched from Google Calendar
- [ ] No Prisma errors in logs
- [ ] No database constraint violations
- [ ] Frontend receives postMessage successfully
- [ ] User can proceed through onboarding

---

## 🐛 Troubleshooting

### Issue: "Prisma is not defined"
- **Cause:** Old code path still being used
- **Fix:** Restart backend server
- **Check:** Verify commit `e54617c` is deployed

### Issue: "Database error while creating user"
- **Cause:** User already exists or email constraint violation
- **Fix:** Run delete script first
- **Check:** `SELECT * FROM users WHERE email = 'test@example.com';`

### Issue: "Failed to create tenant"
- **Cause:** Missing `tenants` table or permission issue
- **Fix:** Check database schema
- **Check:** `SELECT * FROM information_schema.tables WHERE table_name = 'tenants';`

### Issue: "Failed to create calendar connection"
- **Cause:** Missing `calendar_connections` table or foreign key issue
- **Fix:** Check database schema
- **Check:** `SELECT * FROM information_schema.tables WHERE table_name = 'calendar_connections';`

### Issue: "Initial sync failed"
- **Cause:** Google API error or token issue
- **Fix:** Check Google API credentials
- **Check:** Backend logs for detailed error

### Issue: Frontend still shows "Connecting..."
- **Cause:** postMessage not received
- **Fix:** Check browser console for errors
- **Check:** Verify popup window opened correctly

---

## 📊 Database Queries for Verification

**Count all test users:**
```sql
SELECT COUNT(*) FROM users WHERE email LIKE '%test%';
```

**Find user by email:**
```sql
SELECT * FROM users WHERE email = 'test@example.com';
```

**Find all data for a user:**
```sql
WITH user_data AS (
  SELECT id FROM users WHERE email = 'test@example.com'
)
SELECT 
  'users' as table_name, COUNT(*) as count FROM users WHERE id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants WHERE owner_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'calendar_connections', COUNT(*) FROM calendar_connections WHERE user_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'meetings', COUNT(*) FROM meetings WHERE user_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'clients', COUNT(*) FROM clients WHERE user_id IN (SELECT id FROM user_data);
```

---

## 🚀 Deployment

After testing locally:

1. **Commit changes:**
   ```bash
   git log --oneline | head -1
   # Should show: Fix: Replace Prisma with Supabase in Google OAuth callback
   ```

2. **Push to production:**
   ```bash
   git push origin main
   ```

3. **Verify on Render:**
   - Check deployment status
   - Tail logs for errors
   - Test signup flow on production

---

## 📝 Notes

- The fix only affects the initial login flow (no state parameter)
- Reconnection flow (with state parameter) was already using Supabase correctly
- All other routes in calendar.js still use Prisma (not changed to avoid breaking existing functionality)
- Background sync is non-blocking (doesn't delay OAuth callback)

