# 🚀 Calendly Multi-User Deployment - FINAL STEPS

## ✅ What You've Already Done

1. ✅ Created Calendly OAuth App
   - Client ID: `Qp0Uzmt_VKYack5iGtc8hKtS1e-zCFtlikHWcjZ2jOM`
   - Client Secret: `EMzaDhfxhGtOOIm2fxZu5lBZkCu9EOXGGASoCjWYs58`
   - Webhook Signing Key: `Hsokfldc9vqwI6meu5wSyiJ__ichuvGTwQVdR-uqn8A`

2. ✅ Added Environment Variables to Render
   - `CALENDLY_OAUTH_CLIENT_ID`
   - `CALENDLY_OAUTH_CLIENT_SECRET`
   - `CALENDLY_WEBHOOK_SIGNING_KEY`

---

## 🔧 CRITICAL: Database Migration Required

### **Step 1: Create Webhook Events Table**

**Go to Supabase Dashboard → SQL Editor and run:**

```sql
-- Create table for Calendly webhook event deduplication
CREATE TABLE IF NOT EXISTS calendly_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_event_id ON calendly_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_created_at ON calendly_webhook_events(created_at);

-- Add comment
COMMENT ON TABLE calendly_webhook_events IS 'Stores processed Calendly webhook events for deduplication';
```

**OR** run the file: `run_calendly_migration.sql` in Supabase SQL Editor

---

### **Step 2: Fix Daniel's Existing Connection**

Daniel's connection has `calendly_user_uri: null` which will prevent webhooks from working for him.

**Option A: Have Daniel Reconnect (RECOMMENDED)**

1. Have Daniel log in
2. Go to Settings → Calendar
3. Disconnect Calendly
4. Reconnect Calendly via OAuth
5. Verify `calendly_user_uri` is populated

**Option B: Manual Database Fix (NOT RECOMMENDED)**

Only if Daniel can't reconnect, you can manually update his connection, but you'll need his Calendly user URI from the Calendly API.

---

### **Step 3: Restart Backend (If Not Already Done)**

Render should have automatically restarted when you added the environment variables. If not:

1. Go to Render Dashboard
2. Select your backend service
3. Click "Manual Deploy" → "Deploy latest commit"

---

## 🧪 Testing Your Setup

### **Quick Test (5 minutes)**

1. **Login to your app**
2. **Go to Settings → Calendar**
3. **Click "Connect with Calendly OAuth"**
4. **Verify**:
   - ✅ Popup opens with Calendly auth screen
   - ✅ After authorizing, popup closes
   - ✅ Success message appears
   - ✅ Connection shows in list

5. **Create a test meeting in Calendly**
6. **Check your app's Meetings page**
7. **Verify**:
   - ✅ Meeting appears within 2-3 seconds
   - ✅ No need to refresh page
   - ✅ Meeting details are correct

### **Full Testing**

See `CALENDLY_TESTING_GUIDE.md` for comprehensive testing instructions.

---

## 📊 Verify Everything is Working

### **Check 1: Database**

Run in Supabase SQL Editor:

```sql
-- Verify webhook events table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'calendly_webhook_events';

-- Check current Calendly connections
SELECT 
  user_id,
  provider_account_email,
  calendly_user_uri,
  is_active
FROM calendar_connections
WHERE provider = 'calendly';
```

**Expected**:
- ✅ `calendly_webhook_events` table exists
- ✅ All connections have `calendly_user_uri` populated (NOT NULL)

### **Check 2: Backend Logs**

Go to Render → Logs and look for:

```
✅ Calendly OAuth successful for Calendly account: user@example.com
✅ Created new Calendly connection for user USER_ID
```

When a meeting is created:

```
📥 Received Calendly webhook: { event: 'invitee.created', ... }
🔍 Looking for user with Calendly URI: https://api.calendly.com/users/XXXXX
✅ Found matching user: USER_ID
✅ Meeting saved from webhook: Meeting Title
```

### **Check 3: Frontend**

1. Connect Calendly account
2. Create test meeting in Calendly
3. Meeting should appear in app within 2-3 seconds
4. No errors in browser console

---

## 🎯 Success Criteria

Your Calendly integration is ready for production when:

1. ✅ `calendly_webhook_events` table exists in database
2. ✅ All environment variables are set in Render
3. ✅ Backend has been restarted
4. ✅ New users can connect their Calendly accounts
5. ✅ `calendly_user_uri` is populated for all connections
6. ✅ Meetings appear instantly when created in Calendly
7. ✅ Each user sees only their own meetings
8. ✅ No webhook signature errors in logs

---

## 🔍 Troubleshooting

### **Issue: "calendly_webhook_events table does not exist"**

**Fix**: Run the migration SQL in Supabase (Step 1 above)

### **Issue: "No matching Calendly connection found for webhook"**

**Cause**: User's `calendly_user_uri` is NULL

**Fix**: Have user disconnect and reconnect Calendly

### **Issue: "Invalid webhook signature"**

**Cause**: `CALENDLY_WEBHOOK_SIGNING_KEY` is incorrect

**Fix**: Verify environment variable in Render matches: `Hsokfldc9vqwI6meu5wSyiJ__ichuvGTwQVdR-uqn8A`

### **Issue: Meetings not appearing in real-time**

**Possible Causes**:
1. Webhook events table doesn't exist → Run migration
2. `calendly_user_uri` is NULL → Reconnect Calendly
3. Webhook signing key is wrong → Verify environment variable
4. Backend not restarted → Restart backend

---

## 📚 Documentation Files

- ✅ `CALENDLY_MULTI_USER_SETUP_COMPLETE.md` - Complete setup guide
- ✅ `CALENDLY_TESTING_GUIDE.md` - Testing instructions
- ✅ `run_calendly_migration.sql` - Database migration script
- ✅ `backend/migrations/create_calendly_webhook_events.sql` - Migration file

---

## 🎉 You're Done!

Once you've completed the steps above:

1. ✅ Run the database migration
2. ✅ Fix Daniel's connection (have him reconnect)
3. ✅ Test with a new user
4. ✅ Create a test meeting
5. ✅ Verify real-time delivery

**Your Calendly integration is now ready for production with full multi-user support!** 🚀

---

## 🔐 Security Notes

- ✅ **Webhook signing key is global** - One key for all users (app-level secret)
- ✅ **OAuth tokens are per-user** - Each user has their own access/refresh tokens
- ✅ **User matching via URI** - Webhooks matched to users via `calendly_user_uri`
- ✅ **RLS policies enabled** - Database enforces tenant isolation
- ✅ **Popup-based OAuth** - Keeps main window intact, better UX

---

## 📞 Support

If you encounter any issues:

1. Check backend logs in Render
2. Check browser console for errors
3. Verify database migration was successful
4. Ensure all environment variables are set
5. Restart backend if needed

---

**Next Steps**: Run the database migration and start testing! 🎯

