# ⚠️ ACTION REQUIRED: Calendly Webhook Signing Key Fix

## 🎯 **What You Need To Do**

### Step 1: Add Database Columns (5 minutes)

Go to Supabase SQL Editor and run:

```sql
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS calendly_webhook_signing_key TEXT;

ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS webhook_signing_key TEXT;
```

**Verify:** You should see both columns listed.

### Step 2: Wait for Render Deployment (2 minutes)

Code is already committed and will auto-deploy.

### Step 3: Test the Fix (5 minutes)

1. Go to Settings → Calendar Integrations
2. Click "×" to disconnect Calendly
3. Click "+" to reconnect Calendly
4. Complete OAuth flow
5. Check Render logs for:
   ```
   🔑 Webhook signing key received from Calendly
   🔑 Webhook signing key stored for verification
   ```
6. Create a test meeting in Calendly
7. Verify it appears in Advicly within 5 seconds

## 📊 **What Changed**

### The Problem:
- Code was sending developer app signing key to Calendly
- Calendly doesn't accept that - it generates its own key
- Code wasn't storing the returned key
- Webhook verification was failing

### The Solution:
- ✅ Code now captures Calendly's returned signing key
- ✅ Stores it in database
- ✅ Uses database key for webhook verification
- ✅ More secure and scalable

## 📝 **Database Columns Added**

1. `calendar_connections.calendly_webhook_signing_key`
   - Stores signing key for this user's webhook
   - Used to verify incoming webhook events

2. `calendly_webhook_subscriptions.webhook_signing_key`
   - Backup storage of signing key
   - Allows multiple webhooks to be verified

## ✅ **Verification Query**

After reconnecting, run this to verify everything is stored:

```sql
SELECT 
  user_id,
  provider,
  calendly_webhook_id,
  calendly_webhook_signing_key,
  is_active
FROM calendar_connections
WHERE provider = 'calendly'
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `calendly_webhook_id`: Not NULL (webhook URI)
- `calendly_webhook_signing_key`: Not NULL (signing key)
- `is_active`: true

## 📚 **Documentation**

See these files for details:
- `CALENDLY_WEBHOOK_COMPLETE_FIX.md` - Full implementation details
- `CALENDLY_SIGNING_KEY_DATABASE_CHANGES.md` - Database changes
- `backend/migrations/027_add_calendly_webhook_signing_key.sql` - Migration file

## 🚀 **Timeline**

- **Now**: Add database columns (5 min)
- **+2 min**: Render deployment completes
- **+7 min**: Test and verify (5 min)
- **Total**: ~12 minutes to complete fix

## ⚠️ **Important Notes**

- Environment variable `CALENDLY_WEBHOOK_SIGNING_KEY` is NO LONGER USED
- Each webhook has its own unique signing key from Calendly
- This is more secure and supports multiple webhooks
- No code changes needed on your end - already committed

