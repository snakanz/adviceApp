# 🔧 Calendly Webhook Token Refresh Fix

**Status:** ✅ **IMPLEMENTED**  
**Date:** 2025-11-14  
**Issue:** Calendly webhooks fail after inactivity due to expired access tokens

---

## 🔴 The Problem

When a user leaves their Advicly account logged out for a period of time, the Calendly webhook health check fails with:

```
Status: 401
Message: "The access token is invalid"
```

This happens because:
1. Calendly access tokens expire (typically after 1 hour)
2. The webhook health check runs on a schedule
3. The health check was using the **raw, potentially expired token** from the database
4. All API calls failed with 401 Unauthorized

---

## ✅ The Root Cause

In `webhookHealthService.js`, both `checkAndRepairWebhook()` and `recreateWebhook()` methods were:

```javascript
// ❌ BEFORE: Using raw token without checking expiration
const webhookService = new CalendlyWebhookService(connection.access_token);
```

The `connection.access_token` could be expired, but there was no refresh logic.

---

## 🔧 The Solution

Updated both methods to use `CalendlyService.getUserAccessToken()` which:

1. **Checks token expiration** - Compares `token_expires_at` with current time
2. **Auto-refreshes if needed** - Uses refresh token to get a new access token
3. **Updates database** - Stores the new token and expiration time
4. **Returns fresh token** - Guaranteed to be valid for API calls

```javascript
// ✅ AFTER: Using refreshed token
const accessToken = await CalendlyService.getUserAccessToken(userId);

if (!accessToken) {
  throw new Error('Could not obtain valid Calendly access token');
}

const webhookService = new CalendlyWebhookService(accessToken);
```

---

## 📝 Files Modified

**`backend/src/services/webhookHealthService.js`**

### Changes in `checkAndRepairWebhook()` (lines 30, 52-59):
- Added `token_expires_at` to database query
- Call `CalendlyService.getUserAccessToken(userId)` before creating webhook service
- Added error handling if token cannot be obtained

### Changes in `recreateWebhook()` (lines 118-123):
- Call `CalendlyService.getUserAccessToken(userId)` before creating webhook service
- Added error handling if token cannot be obtained

---

## ✅ Expected Behavior

✅ Webhook health checks succeed even after inactivity  
✅ Expired tokens are automatically refreshed  
✅ Webhooks are verified and recreated as needed  
✅ Calendly meetings sync in real-time  
✅ System stays connected across user sessions  

---

## 🧪 How to Test

1. Connect Calendly account in Settings
2. Wait for token to expire (or manually set `token_expires_at` to past time in database)
3. Trigger webhook health check (happens automatically on schedule)
4. Check Render logs for: `✅ Webhook found in Calendly` (no 401 errors)
5. Verify meetings sync from Calendly

---

## 🔗 Related Code

- `CalendlyService.getUserAccessToken()` - Token refresh logic (calendlyService.js:610-670)
- `CalendlyOAuthService.refreshAccessToken()` - OAuth token refresh (calendlyOAuth.js:78-102)
- `WebhookHealthService` - Webhook health monitoring (webhookHealthService.js)

