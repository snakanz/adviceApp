# 🔧 WEBHOOK HEALTH CHECK FIX - DEPLOYED

**Commit:** `368b43d`
**Status:** ✅ **LIVE ON RENDER**
**Deployed:** 2025-11-13 15:45:00 UTC

---

## 🔴 **The Problem**

The webhook health check was failing with this error:

```
❌ Error verifying webhook: Calendly API error: 400 - 
{"details":[{"message":"is missing","parameter":"user"}],...}

❌ Error listing webhook subscriptions: Calendly API error (400): 
{"details":[{"message":"is missing","parameter":"organization"}],...}
```

This prevented webhooks from being automatically verified and recreated when they expired, breaking the entire Calendly sync system.

---

## ✅ **The Root Cause**

In `webhookHealthService.js` line 57-59, the code was making a request to Calendly API with:

```javascript
// BROKEN - Missing user parameter
const webhooks = await calendlyService.makeRequest(
  `/webhook_subscriptions?organization=${encodeURIComponent(connection.calendly_organization_uri)}&scope=user`
);
```

**The Issue:** When using `scope=user`, the Calendly API v2 requires BOTH `organization` AND `user` parameters. The code was only passing `organization`.

---

## 🔧 **The Fix**

Updated `webhookHealthService.js` to pass BOTH parameters:

```javascript
// FIXED - Now includes both organization and user parameters
const webhooks = await calendlyService.makeRequest(
  `/webhook_subscriptions?organization=${encodeURIComponent(connection.calendly_organization_uri)}&user=${encodeURIComponent(connection.calendly_user_uri)}&scope=user`
);
```

**Key Change:** Added `&user=${encodeURIComponent(connection.calendly_user_uri)}` to the URL.

---

## 📊 **Files Modified**

- `backend/src/services/webhookHealthService.js` (line 57-59)

---

## ✅ **Expected Behavior After Fix**

✅ Webhook health checks run without 400 errors
✅ Webhooks are verified in Calendly successfully
✅ Expired webhooks are automatically recreated
✅ Calendly meetings sync in real-time
✅ System stays connected when user logs out and back in

---

## 🧪 **How to Verify**

1. Go to https://adviceapp.pages.dev
2. Settings → Calendar
3. Ensure Calendly is connected
4. Check Render logs for: `✅ Webhook found in Calendly` (no 400 errors)
5. Meetings should sync from Calendly automatically

---

## 📝 **Technical Details**

**Calendly API v2 Requirement:**
- When listing webhooks with `scope=user`, BOTH parameters are required:
  - `organization`: The organization URI
  - `user`: The user URI
- Passing only one parameter causes a 400 Bad Request error

**This fix reverts to the working implementation from commit `797400f`** which had this same fix applied.

---

**Status:** ✅ **PRODUCTION READY**

