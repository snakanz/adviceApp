# 🧩 Calendly OAuth + Webhook Reconnect Flow — Implementation Status

## ✅ CURRENT IMPLEMENTATION STATUS

Your codebase **already implements most of the idempotent reconnect flow**. Here's what's working:

### 1️⃣ **Check Existing DB Record** ✅ IMPLEMENTED
- **File**: `backend/src/routes/calendar.js` (lines 2235-2240)
- **Status**: Checks for existing `calendar_connections` record before creating new one
- **Code**:
```javascript
const { data: existingConnection } = await getSupabase()
  .from('calendar_connections')
  .select('id')
  .eq('user_id', userId)
  .eq('provider', 'calendly')
  .single();
```

### 2️⃣ **Token Refresh** ✅ IMPLEMENTED
- **File**: `backend/src/services/calendlyService.js` (lines 618-635)
- **Status**: Refreshes tokens before sync if needed
- **Note**: Not called during OAuth callback, only during sync operations

### 3️⃣ **Retrieve Calendly User Info** ✅ IMPLEMENTED
- **File**: `backend/src/routes/calendar.js` (lines 2160-2161)
- **Status**: Fetches user info and stores `calendly_user_uri` + `calendly_organization_uri`
- **Stores**: Both URIs in `calendar_connections` table

### 4️⃣ **Check Existing Webhooks** ✅ IMPLEMENTED
- **File**: `backend/src/services/calendlyWebhookService.js` (lines 158-171)
- **Method**: `listWebhookSubscriptions()`
- **Status**: Lists all webhooks for organization

### 5️⃣ **Create Webhook if Needed** ✅ IMPLEMENTED
- **File**: `backend/src/services/calendlyWebhookService.js` (lines 197-301)
- **Method**: `ensureWebhookSubscription()`
- **Handles 409 Conflict**: Yes (lines 230-260)
- **Stores Signing Key**: Yes (line 269)

### 6️⃣ **Update DB** ✅ IMPLEMENTED
- **File**: `backend/src/routes/calendar.js` (lines 2303-2317)
- **Status**: Stores webhook ID + signing key in `calendar_connections`
- **Columns**: `calendly_webhook_id`, `calendly_webhook_signing_key`

## ⚠️ GAPS & IMPROVEMENTS NEEDED

### Gap #1: Token Refresh During OAuth Reconnect
**Current**: OAuth callback doesn't attempt token refresh first
**Needed**: Before full OAuth, try refreshing existing tokens
**Impact**: Reduces unnecessary re-authorizations

### Gap #2: Webhook Cleanup on Reconnect
**Current**: Creates new webhook without deleting old ones
**Needed**: Delete stale webhooks before creating new ones
**Impact**: Prevents webhook accumulation

### Gap #3: Disconnect Flow
**Current**: No proper cleanup when user disconnects
**Needed**: DELETE webhook from Calendly + clear DB tokens
**Impact**: Prevents orphaned webhooks

### Gap #4: Error Handling & Logging
**Current**: Some errors logged, but not comprehensive
**Needed**: Full error payload logging for debugging
**Impact**: Better visibility into failures

## 📊 DATABASE SCHEMA STATUS

### calendar_connections Table ✅
```sql
-- All required columns present:
- calendly_user_uri TEXT
- calendly_organization_uri TEXT
- calendly_webhook_id TEXT
- calendly_webhook_signing_key TEXT (added via migration 027)
- access_token TEXT
- refresh_token TEXT
```

### calendly_webhook_subscriptions Table ✅
```sql
-- All required columns present:
- organization_uri TEXT
- webhook_subscription_uri TEXT
- webhook_signing_key TEXT (added via migration 027)
- is_active BOOLEAN
```

## 🎯 RECOMMENDED NEXT STEPS

1. **Add Token Refresh to OAuth Callback** (5 min)
   - Try refresh before full OAuth
   - Skip re-authorization if tokens still valid

2. **Implement Webhook Cleanup** (10 min)
   - Delete old webhooks on reconnect
   - Keep only one active webhook per org

3. **Add Disconnect Endpoint** (10 min)
   - DELETE webhook from Calendly
   - Clear tokens from DB

4. **Enhance Error Logging** (5 min)
   - Log full Calendly API responses
   - Add request/response debugging

5. **Add Idempotency Tests** (15 min)
   - Test reconnect multiple times
   - Verify no duplicate webhooks created
   - Verify tokens properly refreshed

## 🔗 KEY FILES

- `backend/src/routes/calendar.js` - OAuth callback (lines 2132-2393)
- `backend/src/services/calendlyWebhookService.js` - Webhook management
- `backend/src/services/calendlyOAuth.js` - OAuth token exchange
- `backend/src/routes/calendly-webhook.js` - Webhook verification
- `backend/migrations/027_add_calendly_webhook_signing_key.sql` - Schema

