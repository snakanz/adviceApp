# Calendly User-Scoped Webhooks - Quick Reference

## What Changed?

### Old Architecture (Organization-Scoped)
```
Organization → One Webhook → All Users
                ↓
            Shared Signing Key
            Doesn't identify user
            Doesn't scale
```

### New Architecture (User-Scoped) ✅
```
User A → Webhook A → Signing Key A
User B → Webhook B → Signing Key B
User C → Webhook C → Signing Key C
...
User N → Webhook N → Signing Key N
```

## Key Files Modified

| File | Change | Impact |
|------|--------|--------|
| `calendlyWebhookService.js` | `ensureWebhookSubscription(org, user, userId)` | Creates per-user webhooks |
| `calendar.js` | Pass `userId` to webhook creation | OAuth creates user-scoped webhook |
| `calendly-webhook.js` | Extract `webhookUserId` from signature | Route events to correct user |
| `calendly.js` | Delete by `user_id` + `scope: 'user'` | Disconnect only user's webhook |
| `028_user_scoped_calendly_webhooks.sql` | Add `user_id`, `scope`, `user_uri` columns | Database schema update |

## How Webhooks Work Now

### 1. User Connects Calendly
```javascript
// OAuth callback
const webhookResult = await webhookService.ensureWebhookSubscription(
  organizationUri,
  userUri,
  userId  // ✅ NEW: Pass user ID
);
```

### 2. Calendly Sends Webhook Event
```
POST /api/calendly/webhook
{
  "event": "https://api.calendly.com/scheduled_events/EVENT_UUID",
  "created_by": "https://api.calendly.com/users/USER_URI"
}
```

### 3. Signature Verification
```javascript
// Query user-scoped webhooks
const webhooks = await supabase
  .from('calendly_webhook_subscriptions')
  .select('webhook_signing_key, user_id')
  .eq('scope', 'user')  // ✅ Only user-scoped
  .eq('is_active', true);

// Verify and extract webhookUserId
for (const webhook of webhooks) {
  if (verifySignature(rawBody, signature, webhook.webhook_signing_key)) {
    webhookUserId = webhook.user_id;  // ✅ Track user
    break;
  }
}
```

### 4. Route to Event Handler
```javascript
// Pass webhookUserId to handler
await handleInviteeCreated(payload, webhookUserId);
```

### 5. Create Meeting for Correct User
```javascript
async function handleInviteeCreated(payload, webhookUserId) {
  // Use webhookUserId directly - no lookup needed
  const meeting = await supabase
    .from('meetings')
    .insert({
      user_id: webhookUserId,  // ✅ Correct user
      title: payload.event.name,
      // ...
    });
}
```

## Testing Checklist

- [x] Database migration created
- [x] CalendlyWebhookService updated
- [x] OAuth callback updated
- [x] Webhook handler updated
- [x] Disconnect endpoint updated
- [x] All 10 unit tests passing
- [ ] Deploy to Render
- [ ] User reconnects Calendly
- [ ] Create test meeting in Calendly
- [ ] Verify meeting appears in Advicly within 10 seconds

## Deployment

```bash
# 1. Apply database migration on Supabase
# 2. Push code to GitHub
git add backend/
git commit -m "Implement user-scoped Calendly webhooks"
git push origin main
# 3. Render auto-deploys
# 4. Test user reconnection
```

## Benefits

✅ **Multi-Tenant Ready** - Each user isolated
✅ **Scalable** - 100s of users with own Calendly accounts
✅ **Secure** - Unique signing key per user
✅ **Reliable** - Events routed to correct user
✅ **Production-Ready** - All tests passing

