# 🔄 Calendly Reconnect Flow — Current vs Improved

## COMPARISON: Current Implementation vs Recommended Improvements

### SCENARIO 1: User Reconnects Calendly (Same Account)

#### ❌ CURRENT BEHAVIOR
```
1. User clicks "Reconnect Calendly"
2. Redirected to Calendly OAuth screen
3. User authorizes (even if tokens still valid)
4. Backend exchanges code for NEW tokens
5. Webhook creation attempted
   - If webhook exists: 409 error
   - Existing webhook fetched and reused
   - BUT: Old webhook still exists in Calendly
6. New tokens stored in database
7. Result: Multiple webhooks in Calendly account
```

**Problems**:
- ❌ Unnecessary OAuth redirect (tokens might be valid)
- ❌ Multiple webhooks accumulate in Calendly
- ❌ Confusing for users (why re-authorize?)
- ❌ Potential for stale webhooks

#### ✅ IMPROVED BEHAVIOR
```
1. User clicks "Reconnect Calendly"
2. Backend checks for existing tokens
3. Attempts token refresh (no user interaction)
   - If successful: Skip OAuth, use refreshed tokens
   - If failed: Redirect to OAuth
4. Webhook cleanup:
   - List all webhooks for organization
   - Delete old webhook with our callback URL
   - Create fresh webhook
5. Store webhook ID + signing key
6. Result: One active webhook, tokens refreshed
```

**Benefits**:
- ✅ No unnecessary OAuth redirects
- ✅ Only one webhook per organization
- ✅ Cleaner Calendly account
- ✅ Better user experience

---

### SCENARIO 2: User Disconnects Calendly

#### ❌ CURRENT BEHAVIOR
```
1. User clicks "Disconnect Calendly"
2. Tokens cleared from database
3. Result: Webhook still exists in Calendly
         Orphaned webhook continues to receive events
         Wasted API calls
```

**Problems**:
- ❌ Orphaned webhooks in Calendly
- ❌ Wasted API quota
- ❌ Confusing account state
- ❌ No cleanup

#### ✅ IMPROVED BEHAVIOR
```
1. User clicks "Disconnect Calendly"
2. Backend fetches webhook ID from database
3. Calls Calendly API to DELETE webhook
4. Clears tokens from database
5. Sets is_active = false
6. Result: Clean state, no orphaned webhooks
```

**Benefits**:
- ✅ Webhook deleted from Calendly
- ✅ No orphaned resources
- ✅ Clean account state
- ✅ Proper cleanup

---

### SCENARIO 3: Multiple Reconnections

#### ❌ CURRENT BEHAVIOR
```
Reconnect 1: Webhook A created
Reconnect 2: Webhook B created (A still exists)
Reconnect 3: Webhook C created (A, B still exist)
Result: 3 webhooks in Calendly, only 1 active
```

**Problems**:
- ❌ Webhook accumulation
- ❌ Wasted API quota
- ❌ Confusing account state
- ❌ Potential for duplicate events

#### ✅ IMPROVED BEHAVIOR
```
Reconnect 1: Webhook A created
Reconnect 2: Delete A, create B
Reconnect 3: Delete B, create C
Result: Only 1 webhook in Calendly at all times
```

**Benefits**:
- ✅ Always exactly one webhook
- ✅ No accumulation
- ✅ Clean state
- ✅ Predictable behavior

---

## CODE COMPARISON

### Token Refresh

**CURRENT** (lines 2154-2157 in calendar.js):
```javascript
// Directly exchanges code for tokens
const tokenData = await oauthService.exchangeCodeForToken(code);
const accessToken = tokenData.access_token;
const refreshToken = tokenData.refresh_token;
```

**IMPROVED**:
```javascript
// Try refresh first
if (existingConnection?.refresh_token) {
  try {
    const refreshedTokens = await oauthService.refreshAccessToken(
      existingConnection.refresh_token
    );
    accessToken = refreshedTokens.access_token;
    refreshToken = refreshedTokens.refresh_token || existingConnection.refresh_token;
  } catch (refreshError) {
    // Fall back to full OAuth
    const tokenData = await oauthService.exchangeCodeForToken(code);
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
  }
}
```

### Webhook Creation

**CURRENT** (lines 2291-2294 in calendar.js):
```javascript
// Creates webhook without cleanup
const webhookResult = await webhookService.ensureWebhookSubscription(
  calendlyUser.current_organization,
  calendlyUser.uri
);
```

**IMPROVED** (in calendlyWebhookService.js):
```javascript
// Delete old webhooks first
const existingWebhooks = await this.listWebhookSubscriptions(organizationUri);
for (const webhook of existingWebhooks) {
  if (webhook.callback_url === this.webhookUrl) {
    await this.deleteWebhookSubscription(webhook.uri);
  }
}

// Create fresh webhook
const webhook = await this.createWebhookSubscription(organizationUri, userUri);
```

### Disconnect

**CURRENT**:
```javascript
// No disconnect endpoint exists
// Tokens just cleared from database
```

**IMPROVED** (new endpoint in calendly.js):
```javascript
router.post('/disconnect', authenticateSupabaseUser, async (req, res) => {
  // Delete webhook from Calendly
  const webhookService = new CalendlyWebhookService(connection.access_token);
  await webhookService.deleteWebhookSubscription(connection.calendly_webhook_id);
  
  // Clear tokens from database
  await supabase.from('calendar_connections').update({
    access_token: null,
    refresh_token: null,
    calendly_webhook_id: null,
    is_active: false
  }).eq('user_id', userId);
});
```

---

## METRICS COMPARISON

| Metric | Current | Improved |
|--------|---------|----------|
| OAuth redirects on reconnect | 1 (always) | 0-1 (if refresh fails) |
| Webhooks per org | 1-N (accumulates) | 1 (always) |
| Cleanup on disconnect | ❌ No | ✅ Yes |
| Token refresh support | ✅ Service exists | ✅ Called in OAuth |
| Error logging | ⚠️ Partial | ✅ Comprehensive |
| Idempotent | ⚠️ Partial | ✅ Full |

---

## IMPLEMENTATION EFFORT

| Improvement | Time | Complexity | Impact |
|-------------|------|-----------|--------|
| Token Refresh | 5 min | Low | High |
| Webhook Cleanup | 10 min | Medium | High |
| Disconnect Endpoint | 10 min | Low | Medium |
| Error Logging | 5 min | Low | Medium |
| **TOTAL** | **30 min** | **Low-Medium** | **High** |

---

## RISK ASSESSMENT

### Current Implementation
- ✅ Low risk (already working)
- ⚠️ Webhook accumulation (operational issue)
- ⚠️ No cleanup (orphaned resources)

### Improved Implementation
- ✅ Low risk (backward compatible)
- ✅ Handles edge cases
- ✅ Cleaner state management
- ✅ Better error handling

