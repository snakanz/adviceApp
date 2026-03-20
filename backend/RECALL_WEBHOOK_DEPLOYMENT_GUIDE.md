# Recall.ai Webhook Deployment Guide

## ✅ What Was Fixed

The webhook handler has been completely rewritten to properly handle **SVIX-format webhooks** from Recall.ai.

### **The Problem**
- Old code was looking for `x-recall-signature` header
- Recall.ai sends **SVIX format headers**: `svix-id`, `svix-timestamp`, `svix-signature`
- This mismatch caused all 209+ webhook attempts to fail with `401 Unauthorized`

### **The Solution**
- ✅ Updated `verifySvixSignature()` function to use correct SVIX headers
- ✅ Proper HMAC-SHA256 verification with base64 secret decoding
- ✅ Constant-time signature comparison to prevent timing attacks
- ✅ Comprehensive logging at every step for debugging
- ✅ Proper raw body handling with `express.raw()` middleware

---

## 🚀 Deployment Steps

### **Step 1: Verify Environment Variables**

Make sure your Render backend has these environment variables set:

```bash
RECALL_WEBHOOK_SECRET=whsec_QffDUm10d4BZOc1JTaNnC+YHDwUHTXuf
RECALL_API_KEY=your_recall_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

**To get the webhook secret:**
1. Go to https://recall.ai/dashboard
2. Click **Webhooks** → **Endpoints**
3. Click your endpoint (ep_34i9E64FzZQzR98eaIpNltRt3UN)
4. Scroll to **Signing Secret** section
5. Copy the secret (starts with `whsec_`)

### **Step 2: Deploy to Render**

The code changes are already in place. Now deploy:

**Option A: Automatic (if connected to GitHub)**
```bash
git add backend/src/routes/recall-webhooks.js
git commit -m "Fix: Update Recall webhook handler for SVIX signature verification"
git push origin main
# Render will automatically redeploy
```

**Option B: Manual Redeploy on Render**
1. Go to Render Dashboard → Backend Service
2. Click the three dots (⋯) → **Redeploy**
3. Wait 2-3 minutes for deployment

### **Step 3: Verify Deployment**

Check the Render logs:
```
✅ Recall V2 routes mounted successfully
```

Test the webhook endpoint:
```bash
curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test
```

Expected response:
```json
{
  "success": true,
  "message": "Recall.ai webhook endpoint is accessible",
  "environment": {
    "webhookSecretConfigured": true,
    "apiKeyConfigured": true,
    "supabaseConfigured": true
  }
}
```

---

## 📊 What Happens Next

Once deployed, Recall.ai will **automatically retry all 209 failed webhooks**.

### **Expected Log Output**

You should see in Render logs:

```
╔════════════════════════════════════════════════════════════╗
║         RECALL.AI WEBHOOK RECEIVED                         ║
╚════════════════════════════════════════════════════════════╝

📨 ALL REQUEST HEADERS:
   svix-id: msg_34lS62CrglRCDI6Kc1PWIdcDgV
   svix-timestamp: 1761918396
   svix-signature: v1,sLw4Vni1BhiXXOUgnBsuq87x0Xz5Qk4z85Q1lDaCiuMWo=

🔑 Webhook Secret: ✅ Configured

🔐 Verifying SVIX signature...
🔐 SVIX SIGNATURE VERIFICATION
================================
📋 Headers received:
   svix-id: msg_34lS62CrglRCDI6Kc1PWIdcDgV
   svix-timestamp: 1761918396
   svix-signature: v1,sLw4Vni1BhiXXOUgnBsuq87x0Xz5Qk4z85Q1lDaCiuMWo=
   webhook-secret: ✅ Present

📝 Signed content (first 100 chars): msg_34lS62CrglRCDI6Kc1PWIdcDgV.1761918396.{"data":...

🔑 Secret (base64): QffDUm10d4BZOc1JTaNnC...
🔑 Secret bytes length: 32

✅ Computed signature: sLw4Vni1BhiXXOUgnBsuq87x0Xz5Qk4z85Q1lDaCiuMWo=
📌 Received signature: sLw4Vni1BhiXXOUgnBsuq87x0Xz5Qk4z85Q1lDaCiuMWo=
📌 Version: v1

✅ SIGNATURE VALID
================================

✅ Signature verified successfully!

📦 Parsing payload...
✅ Payload parsed
   Webhook ID: msg_34lS62CrglRCDI6Kc1PWIdcDgV
   Bot ID: e4b22b2d-d490-4874-a086-322922f07950
   Event Type: transcript.done
   Data: {...}

🔍 Checking for duplicate webhooks...
✅ New webhook (not a duplicate)

💾 Recording webhook event in database...
✅ Webhook event recorded

🎯 Processing event type: transcript.done

📥 FETCHING TRANSCRIPT FROM RECALL.AI
=====================================
Bot ID: e4b22b2d-d490-4874-a086-322922f07950
API Key: ✅ Present

🔍 Step 1: Fetching bot details...
✅ Bot found: e4b22b2d-d490-4874-a086-322922f07950
   Recording ID: 4cff97e4-f0c7-4915-b5a0-983238758f28
   Status: done

🔍 Step 2: Fetching transcript...
✅ Transcript retrieved
   Length: 2847 characters
   Preview: [Meeting transcript content...]
=====================================

✅ WEBHOOK PROCESSING COMPLETE
```

---

## 🔍 Troubleshooting

### **If webhooks still fail:**

1. **Check webhook secret matches exactly**
   - Go to Recall.ai dashboard → Webhooks → Endpoints → Your endpoint
   - Copy the exact signing secret
   - Verify it matches in Render environment variables

2. **Check logs for specific errors**
   - Look for `❌ SIGNATURE INVALID` - means secret doesn't match
   - Look for `❌ Missing SVIX headers` - means headers aren't being sent
   - Look for `❌ RECALL_WEBHOOK_SECRET not set` - environment variable missing

3. **Verify Supabase connection**
   - Check `SUPABASE_URL` and `SUPABASE_KEY` are set
   - Verify `recall_webhook_events` table exists

4. **Test endpoint manually**
   ```bash
   curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test
   ```

---

## 📝 Code Changes Summary

**File: `backend/src/routes/recall-webhooks.js`**

- ✅ Replaced `verifyRecallWebhookSignature()` with `verifySvixSignature()`
- ✅ Updated to read `svix-id`, `svix-timestamp`, `svix-signature` headers
- ✅ Proper base64 secret decoding from `whsec_` prefix
- ✅ HMAC-SHA256 with base64 digest (not hex)
- ✅ Constant-time comparison with `crypto.timingSafeEqual()`
- ✅ Comprehensive logging at every verification step
- ✅ Enhanced `fetchTranscriptFromRecall()` with detailed logging
- ✅ Updated main webhook endpoint with full debugging output
- ✅ Test endpoint now shows environment configuration status

---

## ✅ Verification Checklist

- [ ] Environment variables set in Render
- [ ] Code deployed to Render
- [ ] Render logs show "Recall V2 routes mounted successfully"
- [ ] Test endpoint returns 200 with environment status
- [ ] Recall.ai dashboard shows webhook attempts (should change from Failed to Success)
- [ ] Render logs show "✅ SIGNATURE VALID" messages
- [ ] Transcripts appearing in database
- [ ] Meetings updated with transcript content

---

## 🎯 Next Steps

1. Deploy the code
2. Wait 2-3 minutes for Render to redeploy
3. Check Render logs for success messages
4. Recall.ai will automatically retry failed webhooks
5. Monitor logs to see transcripts being processed
6. Verify meetings are updated with transcript content

**Questions?** Check the logs in Render dashboard for detailed debugging information.

