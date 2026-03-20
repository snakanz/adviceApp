# 🚀 Calendly Webhook Production Fixes - Deployment Guide

## 📋 Executive Summary

This document describes the **7 critical fixes** implemented to make your Calendly webhook integration production-ready and prevent 500 errors, timeouts, and webhook disablement.

---

## 🔴 **CRITICAL ISSUES FIXED**

### **Issue #1: ❌ Signature Verification Used Parsed JSON Instead of Raw Body**
**Problem:** Computing HMAC over re-stringified JSON instead of raw request bytes
**Impact:** Signature verification always failed with `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`
**Fix:** ✅ Now uses raw body bytes for HMAC computation

### **Issue #2: ❌ Webhook Route Used express.json() Middleware**
**Problem:** Body parser discarded raw bytes before signature verification
**Impact:** Raw body not available for signature verification
**Fix:** ✅ Created separate webhook route mounted BEFORE express.json()

### **Issue #3: ❌ Signature Header Parsing Was Incorrect**
**Problem:** Treated entire header as signature instead of parsing `t=` and `s=` parts
**Impact:** Signature verification always failed
**Fix:** ✅ Correctly parses Calendly signature format: `t=TIMESTAMP,s=sha256=HEX`

### **Issue #4: ❌ Webhook Handler Did Heavy Work Synchronously**
**Problem:** Response sent AFTER processing (API calls, DB queries)
**Impact:** Timeouts cause webhook disablement
**Fix:** ✅ Returns 200 immediately, processes asynchronously

### **Issue #5: ❌ Unhandled Exceptions Bubbled to HTTP Layer**
**Problem:** No validation of payload fields, errors caused 500 responses
**Impact:** Malformed payloads crashed webhook handler
**Fix:** ✅ Comprehensive validation and error handling (never throws)

### **Issue #6: ❌ No Idempotency for Webhook Retries**
**Problem:** Event ID stored AFTER processing, retries created duplicates
**Impact:** Duplicate meetings on Calendly retries
**Fix:** ✅ Stores event ID BEFORE processing (atomic claim)

### **Issue #7: ❌ Database Errors Returned 503**
**Problem:** Returned 503 when DB unavailable, causing Calendly to retry
**Impact:** DB outages caused webhook disablement
**Fix:** ✅ Returns 200 even if DB down (logs error for manual recovery)

---

## 📁 **FILES CHANGED**

### **New Files Created:**
1. **`backend/src/routes/calendly-webhook.js`** (NEW)
   - Production-ready webhook handler with raw body support
   - Mounted BEFORE express.json() middleware
   - All 7 fixes implemented

2. **`backend/CALENDLY_WEBHOOK_FIXES.md`** (THIS FILE)
   - Deployment guide and documentation

### **Files Modified:**
1. **`backend/src/index.js`**
   - Added Calendly webhook route mounting BEFORE express.json()
   - Lines 101-108 (new webhook mounting)

2. **`backend/src/routes/calendly.js`**
   - Marked old webhook handler as DEPRECATED
   - Kept for backward compatibility but not used
   - Added comments pointing to new handler

---

## 🎯 **DEPLOYMENT STEPS**

### **Step 1: Verify Environment Variables**

Ensure `CALENDLY_WEBHOOK_SIGNING_KEY` is set in your environment:

```bash
# Check if signing key is configured
echo $CALENDLY_WEBHOOK_SIGNING_KEY
```

If not set, you'll need to:
1. Go to Calendly → Integrations → Webhooks
2. Find your webhook subscription
3. Copy the signing key
4. Add to Render environment variables

### **Step 2: Deploy to Render**

```bash
# Commit changes
git add backend/src/routes/calendly-webhook.js
git add backend/src/index.js
git add backend/src/routes/calendly.js
git add backend/CALENDLY_WEBHOOK_FIXES.md

git commit -m "Fix Calendly webhook: raw body signature verification, async processing, idempotency

- FIX #1: Use raw body for HMAC signature verification
- FIX #2: Mount webhook route BEFORE express.json() middleware
- FIX #3: Correctly parse Calendly signature header (t=,s=)
- FIX #4: Return 200 immediately, process async (prevent timeouts)
- FIX #5: Comprehensive error handling (no unhandled exceptions)
- FIX #6: Idempotency - store event ID before processing
- FIX #7: Return 200 even if DB down (graceful degradation)

Production-ready pattern following Calendly best practices"

git push origin main
```

### **Step 3: Wait for Deployment**

```bash
# Wait ~90 seconds for Render deployment
sleep 90
```

### **Step 4: Delete Existing Webhook from Calendly**

**CRITICAL:** You must delete the existing webhook that's causing 409 errors:

1. Go to https://calendly.com
2. Log in as **nelson.greenwood@sjpp.co.uk**
3. Click profile → **Account** → **Integrations** → **API & Webhooks**
4. Find webhook with URL: `https://adviceapp-9rgw.onrender.com/api/calendly/webhook`
5. Click **Delete**

### **Step 5: Reconnect Calendly**

1. Go to https://adviceapp-9rgw.onrender.com/settings/calendar
2. **Disconnect** Calendly (if connected)
3. **Reconnect** Calendly
4. System will automatically create new webhook subscription

### **Step 6: Verify Webhook Works**

Test the webhook by scheduling a test meeting:

1. Create a test Calendly event
2. Check Render logs for webhook processing:

```bash
# Expected log output:
╔════════════════════════════════════════════════════════════╗
║         CALENDLY WEBHOOK RECEIVED                          ║
╚════════════════════════════════════════════════════════════╝

📦 Raw body length: XXX bytes
✅ Signature verified successfully!
📥 Webhook event: { event: 'invitee.created', created_at: '...' }
🔄 Processing webhook event: invitee.created
✅ Meeting saved from webhook: ...
✅ Webhook event processed: invitee.created
```

---

## 🔍 **VERIFICATION CHECKLIST**

After deployment, verify:

- [ ] Deployment completed successfully on Render
- [ ] Old webhook deleted from Calendly web interface
- [ ] Calendly reconnected in app
- [ ] New webhook subscription created (check Render logs)
- [ ] Test meeting scheduled successfully
- [ ] Webhook received and processed (check logs)
- [ ] Meeting appears in database
- [ ] No 500 errors in logs
- [ ] No signature verification errors

---

## 📊 **MONITORING**

### **Key Metrics to Watch:**

1. **Webhook Response Time**
   - Should be <100ms (returns 200 immediately)
   - Processing happens async after response

2. **Error Rate**
   - Should be 0% for 4xx/5xx responses
   - All errors logged but return 200

3. **Idempotency**
   - Check `calendly_webhook_events` table for duplicates
   - Should have unique constraint on (event_id, event_type)

4. **Database Availability**
   - Webhooks return 200 even if DB down
   - Check logs for "Database unavailable" warnings

### **Log Patterns to Monitor:**

**✅ Success:**
```
✅ Signature verified successfully!
✅ Meeting saved from webhook: ...
✅ Webhook event processed: invitee.created
```

**⚠️ Warnings (non-fatal):**
```
⚠️  CALENDLY_WEBHOOK_SIGNING_KEY not configured
⚠️  Meeting already exists, updating instead
⏭️  Webhook event already processed, skipping (idempotency)
```

**❌ Errors (logged but webhook still returns 200):**
```
❌ Invalid webhook signature
❌ Database unavailable - webhook will be lost
❌ Error handling invitee.created: ...
```

---

## 🛠️ **TROUBLESHOOTING**

### **Problem: Webhook still getting 409 errors**

**Solution:** Old webhook still exists in Calendly
1. Delete webhook from Calendly web interface
2. Disconnect and reconnect Calendly in app

### **Problem: Signature verification fails**

**Possible Causes:**
1. `CALENDLY_WEBHOOK_SIGNING_KEY` not set or incorrect
2. Webhook created with different signing key

**Solution:**
1. Check environment variable in Render
2. Get signing key from Calendly webhook settings
3. Update environment variable
4. Restart service

### **Problem: Webhooks not being processed**

**Check:**
1. Is webhook route mounted BEFORE express.json()? (check index.js line 101)
2. Is calendly-webhook.js file deployed?
3. Are there errors in Render logs?

**Solution:**
```bash
# Check if webhook route is loaded
grep "Calendly webhook route" render-logs.txt

# Should see:
# ✅ Calendly webhook route mounted successfully
```

### **Problem: Duplicate meetings created**

**Cause:** Idempotency not working (event ID not stored)

**Check:**
```sql
-- Check if events are being stored
SELECT * FROM calendly_webhook_events 
ORDER BY processed_at DESC 
LIMIT 10;
```

**Solution:** Ensure `calendly_webhook_events` table exists with unique constraint

---

## 📚 **TECHNICAL DETAILS**

### **Signature Verification Algorithm**

Calendly uses HMAC-SHA256 with this format:

```
Header: Calendly-Webhook-Signature: t=1234567890,s=sha256=abc123...

Signed Content: timestamp + "." + raw_body
HMAC: HMAC-SHA256(signing_key, signed_content)
```

### **Request Flow**

```
1. Calendly sends webhook → POST /api/calendly/webhook
2. express.raw() preserves raw body as Buffer
3. Verify HMAC signature over raw bytes
4. Return 200 immediately (< 100ms)
5. Parse JSON and process async (fire-and-forget)
6. Store event ID in DB (idempotency)
7. Fetch event details from Calendly API
8. Save/update meeting in database
```

### **Error Handling Strategy**

```
┌─────────────────────────────────────┐
│  Webhook Request Received           │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Verify Signature                   │
│  ❌ Invalid → Return 401            │
│  ✅ Valid → Continue                │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Return 200 IMMEDIATELY             │
│  (Prevents timeout/disablement)     │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Process Async (try/catch all)      │
│  ❌ Error → Log, don't throw        │
│  ✅ Success → Update DB             │
└─────────────────────────────────────┘
```

---

## 🎓 **BEST PRACTICES IMPLEMENTED**

1. ✅ **Fast Response** - Return 200 in <100ms
2. ✅ **Raw Body Verification** - HMAC over exact bytes received
3. ✅ **Idempotency** - Atomic event claiming prevents duplicates
4. ✅ **Graceful Degradation** - Return 200 even if DB down
5. ✅ **Comprehensive Validation** - Check all payload fields
6. ✅ **No Unhandled Exceptions** - All errors caught and logged
7. ✅ **Async Processing** - Heavy work after response sent
8. ✅ **Structured Logging** - Clear success/warning/error patterns

---

## 📞 **SUPPORT**

If you encounter issues after deployment:

1. Check Render logs for error patterns
2. Verify environment variables are set
3. Confirm webhook exists in Calendly
4. Test with a new meeting booking
5. Check database for `calendly_webhook_events` entries

---

## ✅ **SUCCESS CRITERIA**

Deployment is successful when:

- ✅ No 500 errors in webhook endpoint
- ✅ No signature verification failures
- ✅ Webhooks processed in <100ms
- ✅ No duplicate meetings created
- ✅ Meetings sync in real-time
- ✅ Webhook not disabled by Calendly

---

**Last Updated:** 2025-01-11
**Version:** 1.0.0
**Status:** Ready for Production Deployment

