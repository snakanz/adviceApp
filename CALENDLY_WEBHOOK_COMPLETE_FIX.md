# Calendly Webhook Signing Key Fix - Complete Implementation

## 📋 **Summary**

Fixed the Calendly webhook signing key issue by:
1. Removing incorrect developer app key from webhook creation
2. Capturing Calendly's returned signing key
3. Storing signing key in database
4. Using database keys for webhook verification

## 🔧 **Code Changes (Committed)**

### Files Modified:
1. `backend/src/services/calendlyWebhookService.js`
   - Removed sending developer app key
   - Capturing Calendly's returned signing key
   - Storing in database

2. `backend/src/routes/calendar.js`
   - Storing webhook signing key in `calendar_connections`

3. `backend/src/routes/calendly-webhook.js`
   - Fetching signing keys from database
   - Verifying with correct key

### Commit: `02d8255`

## 📊 **Database Changes Required**

### Add Two Columns:

```sql
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS calendly_webhook_signing_key TEXT;

ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS webhook_signing_key TEXT;
```

**Column Purposes:**
- `calendar_connections.calendly_webhook_signing_key` - User's webhook signing key
- `calendly_webhook_subscriptions.webhook_signing_key` - Webhook subscription signing key

## 🚀 **Next Steps**

1. **Apply Database Changes**
   - Open Supabase SQL Editor
   - Run the ALTER TABLE statements above
   - Verify columns were added

2. **Wait for Render Deployment**
   - Code auto-deploys in ~2 minutes
   - Check deployment status in Render dashboard

3. **Test the Fix**
   - Disconnect Calendly in Settings
   - Reconnect Calendly (OAuth flow)
   - Check Render logs for signing key messages
   - Create test meeting in Calendly
   - Verify it syncs to Advicly within 5 seconds

## ✅ **Expected Behavior After Fix**

When you reconnect Calendly:
```
📡 Setting up Calendly webhook subscription...
🔑 Webhook signing key received from Calendly: ...
✅ Webhook ID stored in calendar_connections
🔑 Webhook signing key stored for verification
```

When a webhook arrives:
```
✅ Signature verified successfully with webhook key!
✅ Meeting saved from webhook
```

## 🔍 **Verification Query**

After reconnecting, run this to verify:

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
- `calendly_webhook_id`: Not NULL
- `calendly_webhook_signing_key`: Not NULL
- `is_active`: true

## ⚠️ **Important**

- Environment variable `CALENDLY_WEBHOOK_SIGNING_KEY` is NO LONGER USED for verification
- Each webhook has its own unique signing key from Calendly
- This is more secure and supports multiple webhooks

