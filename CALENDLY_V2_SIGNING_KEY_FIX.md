# 🔑 Calendly v2 Webhook Signing Key Fix

## Problem
Calendly v2 API was **NOT returning the `signing_key`** in the webhook creation response, despite documentation suggesting it should. This caused:
- ❌ Webhook signature verification to fail
- ❌ Meetings not syncing to frontend
- ❌ Database storing `webhook_signing_key: null`

## Root Cause
Calendly v2 API documentation is misleading. The `signing_key` field is **OPTIONAL** and only returned if you explicitly send it when creating the webhook. The API echoes back the key you provide.

## Solution
**Generate the signing key client-side and send it to Calendly:**

```javascript
const crypto = require('crypto');

// Generate 32-byte random signing key
const signingKey = crypto.randomBytes(32).toString('hex');

// Send it when creating webhook
const requestBody = {
  url: this.webhookUrl,
  events: ['invitee.created', 'invitee.canceled'],
  organization: organizationUri,
  scope: scope,
  signing_key: signingKey  // ✅ Send our generated key
};
```

## Changes Made
**File: `backend/src/services/calendlyWebhookService.js`**
- Generate 32-byte random signing key using `crypto.randomBytes(32).toString('hex')`
- Include `signing_key` in webhook creation request body
- Store the generated key for webhook signature verification
- Fallback to generated key if Calendly doesn't echo it back

## Deployment
- **Commit:** `be8d050`
- **Status:** ✅ Deployed to Render
- **Tests:** ✅ All 17 tests passing

## Next Steps
1. Reconnect Calendly integration to trigger v2 webhook creation with signing key
2. Create a test meeting in Calendly app
3. Verify webhook fires and signature verification succeeds
4. Meeting should appear in Advicly frontend within 10 seconds

## Testing
```bash
npm test
# Test Suites: 3 passed, 3 total
# Tests: 17 passed, 17 total
```

All webhook signature verification tests passing ✅

