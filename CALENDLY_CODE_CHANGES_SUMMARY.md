# Calendly User-Scoped Webhooks - Code Changes Summary

## 1. CalendlyWebhookService.js

### Method Signature Change
```javascript
// BEFORE
async ensureWebhookSubscription(organizationUri, userUri)

// AFTER
async ensureWebhookSubscription(organizationUri, userUri, userId)
```

### Database Query Change
```javascript
// BEFORE - Query by organization
const { data: existingWebhook } = await supabase
  .from('calendly_webhook_subscriptions')
  .select('*')
  .eq('organization_uri', organizationUri)
  .single();

// AFTER - Query by user
const { data: existingWebhook } = await supabase
  .from('calendly_webhook_subscriptions')
  .select('*')
  .eq('user_id', userId)
  .eq('scope', 'user')
  .eq('is_active', true)
  .maybeSingle();
```

### Webhook Creation Change
```javascript
// BEFORE - Organization scope
webhook = await this.createWebhookSubscription(
  organizationUri, 
  userUri, 
  'organization'
);

// AFTER - User scope
webhook = await this.createWebhookSubscription(
  organizationUri, 
  userUri, 
  'user'  // ✅ User-scoped
);
```

### Database Insert Change
```javascript
// BEFORE
await supabase.from('calendly_webhook_subscriptions').insert({
  organization_uri: organizationUri,
  scope: 'organization',
  webhook_subscription_uri: webhook.uri,
  webhook_signing_key: signingKey,
  is_active: true
});

// AFTER
await supabase.from('calendly_webhook_subscriptions').insert({
  user_id: userId,  // ✅ NEW
  organization_uri: organizationUri,
  user_uri: userUri,  // ✅ NEW
  webhook_subscription_uri: webhook.uri,
  webhook_signing_key: signingKey,
  scope: 'user',  // ✅ Changed to 'user'
  is_active: true
});
```

## 2. calendar.js (OAuth Callback)

### Webhook Creation Call
```javascript
// BEFORE
const webhookResult = await webhookService.ensureWebhookSubscription(
  calendlyUser.current_organization,
  calendlyUser.uri
);

// AFTER
const webhookResult = await webhookService.ensureWebhookSubscription(
  calendlyUser.current_organization,
  calendlyUser.uri,
  userId  // ✅ Pass user ID
);
```

## 3. calendly-webhook.js (Webhook Handler)

### Signature Verification
```javascript
// BEFORE - Query all webhooks
const { data: webhooks } = await supabase
  .from('calendly_webhook_subscriptions')
  .select('webhook_signing_key')
  .eq('is_active', true);

// AFTER - Query user-scoped webhooks only
let webhookUserId = null;
const { data: webhooks } = await supabase
  .from('calendly_webhook_subscriptions')
  .select('webhook_signing_key, user_id, user_uri')
  .eq('is_active', true)
  .eq('scope', 'user');  // ✅ Only user-scoped

// Track which user this webhook belongs to
for (const webhook of webhooks) {
  if (verifySignature(...)) {
    webhookUserId = webhook.user_id;  // ✅ Extract user ID
    break;
  }
}
```

### Event Handler Calls
```javascript
// BEFORE
await handler(payload);

// AFTER
await handler(payload, webhookUserId);  // ✅ Pass user ID
```

### Event Handler Signatures
```javascript
// BEFORE
async function handleInviteeCreated(payload)
async function handleInviteeCanceled(payload)
async function handleInviteeUpdated(payload)

// AFTER
async function handleInviteeCreated(payload, webhookUserId)
async function handleInviteeCanceled(payload, webhookUserId)
async function handleInviteeUpdated(payload, webhookUserId)
```

### User Lookup in Handlers
```javascript
// BEFORE - Look up user by Calendly URI
const calendlyUserUri = payload.created_by;
const { data: connection } = await supabase
  .from('calendar_connections')
  .select('user_id')
  .eq('calendly_user_uri', calendlyUserUri)
  .maybeSingle();
const userId = connection.user_id;

// AFTER - Use webhookUserId directly
const userId = webhookUserId;  // ✅ Already verified
```

## 4. calendly.js (Disconnect Endpoint)

### Webhook Query Change
```javascript
// BEFORE - Query by organization
const existingWebhooks = await webhookService
  .listWebhookSubscriptions(organizationUri, 'organization');

// AFTER - Query by user
const existingWebhooks = await webhookService
  .listWebhookSubscriptions(userUri, 'user');  // ✅ User-scoped
```

### Database Cleanup Change
```javascript
// BEFORE
await supabase
  .from('calendly_webhook_subscriptions')
  .delete()
  .eq('organization_uri', connection.calendly_organization_uri);

// AFTER
await supabase
  .from('calendly_webhook_subscriptions')
  .delete()
  .eq('user_id', userId)  // ✅ Only this user
  .eq('scope', 'user');  // ✅ Only user-scoped
```

## 5. Database Migration (028_user_scoped_calendly_webhooks.sql)

```sql
-- Add user_id column
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add scope column
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'organization' 
CHECK (scope IN ('user', 'organization'));

-- Add user_uri column
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS user_uri TEXT;

-- Create indexes for per-user lookups
CREATE INDEX IF NOT EXISTS idx_calendly_webhooks_user_id 
ON calendly_webhook_subscriptions(user_id) 
WHERE is_active = true;
```

## Summary of Changes

| Component | Change | Reason |
|-----------|--------|--------|
| Webhook Creation | Add `userId` parameter | Identify which user owns webhook |
| Webhook Scope | Change to 'user' | Per-user instead of organization-level |
| Database Query | Query by `user_id` | Find user's specific webhook |
| Signature Verification | Extract `webhookUserId` | Route event to correct user |
| Event Handlers | Accept `webhookUserId` | Use correct user for meeting creation |
| Disconnect | Delete by `user_id` | Only remove this user's webhook |

All changes maintain backward compatibility while enabling proper multi-tenant support.

