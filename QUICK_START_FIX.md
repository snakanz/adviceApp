# 🚀 Quick Start: Fix Microsoft Calendar Connection

## ✅ What's Been Done

1. **Code Fixed**: `backend/src/services/microsoftCalendar.js` now extracts refresh tokens from MSAL cache
2. **Scripts Created**: Diagnostic and fix scripts are ready to use
3. **Azure Config**: Already correct (no changes needed)

---

## 🎯 What You Need to Do NOW

### Step 1: Deploy the Code Changes (5 minutes)

```bash
# Commit and push the changes
git add .
git commit -m "Fix: Extract Microsoft refresh token from MSAL cache"
git push origin main
```

Wait for Render to deploy (check Render dashboard).

---

### Step 2: Check Current Connection Status (2 minutes)

**Option A: Using Supabase SQL Editor** (Easiest)

1. Go to your Supabase dashboard
2. Click **SQL Editor**
3. Copy and paste the contents of `backend/scripts/check-microsoft-connections.sql`
4. Click **Run**

**Option B: Using Render Web Shell**

1. Go to Render dashboard → Your backend service
2. Click **Shell** tab
3. Run:
```bash
cd /opt/render/project/src
node backend/scripts/fix-microsoft-connection.js
```

---

### Step 3: Fix the Existing User (Choose ONE method)

#### Method 1: User Self-Service (Recommended) ⭐

**Tell your user to:**
1. Go to **Settings → Calendar Connections**
2. Click **"Disconnect"** for Microsoft Calendar
3. Click **"Connect Microsoft Calendar"** again
4. Complete the OAuth flow
5. ✅ Done!

---

#### Method 2: Force Re-auth via Database (Quick)

**In Supabase SQL Editor:**

```sql
-- Mark the connection as inactive (forces re-auth)
UPDATE calendar_connections 
SET 
  is_active = false,
  updated_at = NOW()
WHERE provider = 'microsoft' 
  AND refresh_token IS NULL;
```

Then tell the user to connect their calendar in Settings.

---

#### Method 3: Using Render Web Shell Script

```bash
cd /opt/render/project/src
node backend/scripts/force-microsoft-reauth.js
```

Or for a specific user:
```bash
node backend/scripts/force-microsoft-reauth.js user@example.com
```

---

### Step 4: Verify the Fix (2 minutes)

After the user re-connects, check in Supabase:

```sql
SELECT 
  provider_account_email,
  is_active,
  refresh_token IS NOT NULL as has_refresh_token,
  LENGTH(refresh_token) as token_length,
  token_expires_at
FROM calendar_connections
WHERE provider = 'microsoft';
```

**Expected Result:**
- `has_refresh_token`: `true` ✅
- `token_length`: > 100 ✅
- `is_active`: `true` ✅

---

### Step 5: Check Render Logs (Optional)

When the user re-connects, you should see in Render logs:

```
✅ Refresh token found in MSAL cache for account: [id]
🔑 Microsoft OAuth - Refresh token extracted: YES ✅
📊 Microsoft OAuth - Access token received: YES ✅
💾 Storing Microsoft Calendar tokens in calendar_connections...
✅ Microsoft Calendar connection created successfully
```

---

## 🎯 TL;DR - Fastest Path

1. **Deploy code**: `git push`
2. **Run SQL in Supabase**:
   ```sql
   UPDATE calendar_connections 
   SET is_active = false 
   WHERE provider = 'microsoft' AND refresh_token IS NULL;
   ```
3. **Tell user**: "Reconnect your Microsoft Calendar in Settings"
4. **Verify**: Check that `refresh_token` is now stored in database

---

## 📞 If Something Goes Wrong

### Refresh token still NULL after re-auth?

**Check Render logs for:**
```
🔑 Microsoft OAuth - Refresh token extracted: NO ❌
```

**If you see this:**
1. Check Azure permissions (should already be correct)
2. Add debug logging to see MSAL cache contents
3. Verify `offline_access` scope is in the OAuth request

### User can't reconnect?

**Check:**
1. Is the connection marked as `is_active = false`?
2. Are environment variables set in Render?
3. Is the redirect URI correct in Azure?

### Database errors?

**Check:**
1. Supabase connection is working
2. `calendar_connections` table exists
3. User has proper permissions

---

## 📚 Additional Resources

- **Full Guide**: See `MICROSOFT_CONNECTION_FIX.md`
- **SQL Diagnostics**: See `backend/scripts/check-microsoft-connections.sql`
- **Node Scripts**: See `backend/scripts/fix-microsoft-connection.js`

---

## ✅ Success Checklist

- [ ] Code deployed to Render
- [ ] Existing connection marked as inactive (or deleted)
- [ ] User re-connected Microsoft Calendar
- [ ] Refresh token is stored in database
- [ ] Logs show "Refresh token extracted: YES ✅"
- [ ] Connection is active and working

---

**Estimated Total Time: 10-15 minutes** ⏱️

