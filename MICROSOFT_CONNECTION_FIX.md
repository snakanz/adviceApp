# Microsoft Calendar Connection Fix Guide

## 🎯 What Was Fixed

The issue was that Microsoft's MSAL library stores refresh tokens in an internal encrypted cache and doesn't expose them directly on the token response object. We've now implemented code to extract the refresh token from the MSAL cache.

### Changes Made:

1. **`backend/src/services/microsoftCalendar.js`**:
   - Added `getRefreshTokenFromCache()` method to extract refresh tokens from MSAL's internal cache
   - Updated `exchangeCodeForToken()` to return the refresh token along with access token
   - Added detailed logging to track token extraction

2. **Azure Configuration**: ✅ Already correct (no changes needed)
   - All required permissions are granted
   - `offline_access` scope is properly configured

---

## 🔧 Fixing Existing User Connection

Your existing user needs to **re-authenticate** to get a valid refresh token stored in the database.

### Option 1: User Re-connects via UI (Recommended)

**Steps for the user:**

1. Go to **Settings → Calendar Connections**
2. Click **"Disconnect"** for Microsoft Calendar
3. Click **"Connect Microsoft Calendar"** again
4. Complete the OAuth flow
5. ✅ Done! The new refresh token will be stored automatically

---

### Option 2: Force Re-auth via Render Web Shell (Quick Fix)

Since you have Render Web Shell access, you can force the user to re-authenticate:

#### Step 1: Open Render Web Shell

1. Go to your Render dashboard
2. Navigate to your backend service
3. Click **"Shell"** tab (Web Shell)

#### Step 2: Run the diagnostic script

```bash
cd /opt/render/project/src
node backend/scripts/fix-microsoft-connection.js
```

This will show you the current state of all Microsoft connections.

#### Step 3: Mark connection for re-auth

If the connection is missing a refresh token, run this SQL command in the Web Shell:

```bash
# Connect to your Supabase database
# You'll need your Supabase connection string

# Or use the Supabase SQL Editor directly
```

**In Supabase SQL Editor** (easier):

1. Go to your Supabase dashboard
2. Click **SQL Editor**
3. Run this query:

```sql
-- Check current state
SELECT 
  id,
  user_id,
  provider_account_email,
  is_active,
  refresh_token IS NOT NULL as has_refresh_token,
  token_expires_at,
  created_at,
  updated_at
FROM calendar_connections
WHERE provider = 'microsoft';

-- Mark for re-authentication (deactivate the connection)
UPDATE calendar_connections 
SET 
  is_active = false,
  updated_at = NOW()
WHERE provider = 'microsoft' 
  AND refresh_token IS NULL;
```

#### Step 4: User re-connects

After marking the connection as inactive, the user will see "Not Connected" in their settings and can click "Connect Microsoft Calendar" to re-authenticate.

---

## 🧪 Testing the Fix

### 1. Deploy the Changes

```bash
# Commit and push the changes
git add backend/src/services/microsoftCalendar.js backend/scripts/fix-microsoft-connection.js
git commit -m "Fix: Extract Microsoft refresh token from MSAL cache"
git push origin main
```

### 2. Wait for Render to Deploy

Monitor the deployment in Render dashboard.

### 3. Check Logs During OAuth

When the user re-connects, you should see these logs in Render:

```
✅ Refresh token found in MSAL cache for account: [account-id]
🔑 Microsoft OAuth - Refresh token extracted: YES ✅
📊 Microsoft OAuth - Access token received: YES ✅
⏰ Microsoft OAuth - Token expires on: [timestamp]
💾 Storing Microsoft Calendar tokens in calendar_connections...
✅ Microsoft Calendar connection created successfully
```

### 4. Verify in Database

Check Supabase to confirm the refresh token is now stored:

```sql
SELECT 
  id,
  provider_account_email,
  refresh_token IS NOT NULL as has_refresh_token,
  LENGTH(refresh_token) as refresh_token_length,
  token_expires_at
FROM calendar_connections
WHERE provider = 'microsoft';
```

You should see:
- `has_refresh_token`: `true`
- `refresh_token_length`: > 0 (typically 100-500 characters)

---

## 🚨 If Refresh Token Still Missing After Re-auth

If the refresh token is still `NULL` after re-authentication, check:

### 1. Check Render Logs

Look for this specific log line:

```
🔑 Microsoft OAuth - Refresh token extracted: NO ❌
```

If you see this, it means MSAL didn't store the refresh token in its cache.

### 2. Verify Azure Permissions

Double-check that `offline_access` is:
- ✅ Listed in the permissions
- ✅ Granted (green checkmark)
- ✅ Status shows "Granted for Default Directory"

### 3. Check MSAL Cache

Add this debug code temporarily to `microsoftCalendar.js`:

```javascript
// In getRefreshTokenFromCache method, add:
console.log('🔍 MSAL Cache Contents:', JSON.stringify(parsedCache, null, 2));
```

This will show you exactly what's in the MSAL cache.

---

## 📋 Quick Reference Commands

### Check Connection Status
```bash
node backend/scripts/fix-microsoft-connection.js
```

### SQL: View All Microsoft Connections
```sql
SELECT * FROM calendar_connections WHERE provider = 'microsoft';
```

### SQL: Force Re-auth
```sql
UPDATE calendar_connections 
SET is_active = false 
WHERE provider = 'microsoft' AND refresh_token IS NULL;
```

### SQL: Delete Connection (Nuclear Option)
```sql
DELETE FROM calendar_connections 
WHERE provider = 'microsoft' AND user_id = 'USER_ID_HERE';
```

---

## ✅ Success Criteria

After the fix, you should have:

1. ✅ Refresh token stored in `calendar_connections.refresh_token`
2. ✅ Access token stored in `calendar_connections.access_token`
3. ✅ Token expiry time in `calendar_connections.token_expires_at`
4. ✅ Connection marked as `is_active = true`
5. ✅ Logs showing "Refresh token extracted: YES ✅"

---

## 🆘 Need Help?

If you're still having issues:

1. Check Render logs during OAuth flow
2. Check Supabase logs for database errors
3. Verify Azure app permissions are granted
4. Try the diagnostic script to see connection state
5. Check that environment variables are set correctly in Render

