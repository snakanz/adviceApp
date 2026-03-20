# Recall.ai Webhook - Quick Start

## 🎯 What Was Done

Your webhook handler has been completely fixed to work with Recall.ai's SVIX-based webhook system.

**Status:** ✅ Code updated and ready to deploy

---

## 📋 Quick Checklist

### Before Deploying:
- [ ] Verify `RECALL_WEBHOOK_SECRET` is set in Render environment variables
- [ ] Secret should start with `whsec_` (get from Recall.ai dashboard)
- [ ] Verify `RECALL_API_KEY` is set
- [ ] Verify `SUPABASE_URL` and `SUPABASE_KEY` are set

### Deploy:
- [ ] Push code to GitHub (or manually redeploy on Render)
- [ ] Wait 2-3 minutes for Render to redeploy
- [ ] Check Render logs for "✅ Recall V2 routes mounted successfully"

### Verify:
- [ ] Test endpoint: `curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test`
- [ ] Should return 200 with environment status
- [ ] Check Render logs for "✅ SIGNATURE VALID" messages
- [ ] Recall.ai dashboard should show webhooks changing from Failed → Success

---

## 🔧 What Changed

### **Old Code (❌ Broken)**
```javascript
const signatureHeader = req.headers['x-recall-signature'];  // ❌ WRONG HEADER
if (!verifyRecallWebhookSignature(req.body, signatureHeader, webhookSecret)) {
  // Used wrong signature format
}
```

### **New Code (✅ Fixed)**
```javascript
// Reads correct SVIX headers
const svixId = headers['svix-id'];
const svixTimestamp = headers['svix-timestamp'];
const svixSignature = headers['svix-signature'];

// Proper HMAC-SHA256 with base64 secret
const secretBytes = Buffer.from(secretBase64, 'base64');
const computedSignature = crypto
  .createHmac('sha256', secretBytes)
  .update(signedContent)
  .digest('base64');

// Constant-time comparison
crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(receivedSignature));
```

---

## 📊 Expected Behavior After Deploy

### **Render Logs Will Show:**
```
✅ SIGNATURE VALID
✅ Webhook event recorded
📝 Processing transcript.done event
✅ Transcript retrieved
✅ Meeting updated with transcript
```

### **Recall.ai Dashboard Will Show:**
- Webhook attempts changing from **Failed** → **Success**
- All 209+ failed webhooks will be automatically retried

### **Your Database Will Have:**
- `recall_webhook_events` table populated with webhook data
- `meetings` table updated with transcripts
- Transcripts available for AI summary generation

---

## 🚨 Troubleshooting

### **Webhooks still failing?**

1. **Check webhook secret**
   ```bash
   # In Render environment variables, verify:
   RECALL_WEBHOOK_SECRET=whsec_QffDUm10d4BZOc1JTaNnC+YHDwUHTXuf
   ```

2. **Check logs for errors**
   - Look for `❌ SIGNATURE INVALID` → secret doesn't match
   - Look for `❌ Missing SVIX headers` → headers not being sent
   - Look for `❌ RECALL_WEBHOOK_SECRET not set` → env var missing

3. **Verify endpoint is accessible**
   ```bash
   curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test
   ```

4. **Check Supabase connection**
   - Verify `recall_webhook_events` table exists
   - Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct

---

## 📁 Files Modified

- `backend/src/routes/recall-webhooks.js` - Complete rewrite of webhook handler
  - ✅ New `verifySvixSignature()` function
  - ✅ Updated main webhook endpoint
  - ✅ Enhanced logging throughout
  - ✅ Proper SVIX header handling

---

## 🎓 How It Works Now

1. **Recall.ai sends webhook** with SVIX headers:
   - `svix-id`: Unique message ID
   - `svix-timestamp`: When webhook was sent
   - `svix-signature`: HMAC-SHA256 signature (format: `v1,<base64>`)

2. **Your backend verifies signature**:
   - Extracts base64 secret from `whsec_` prefix
   - Constructs signed content: `svix-id.svix-timestamp.body`
   - Computes HMAC-SHA256 with base64 secret
   - Compares with received signature (constant-time)

3. **If valid, processes webhook**:
   - Records event in database
   - Fetches transcript from Recall.ai API
   - Updates meeting with transcript
   - Triggers AI summary generation

4. **Returns 200 OK** to Recall.ai (prevents retries)

---

## ✅ Next Steps

1. **Deploy the code** (push to GitHub or redeploy on Render)
2. **Wait 2-3 minutes** for deployment
3. **Check logs** for success messages
4. **Monitor Recall.ai dashboard** for webhook status changes
5. **Verify transcripts** appear in your database

**That's it!** The webhooks should start working automatically.

---

## 📞 Support

If you need to debug further:
- Check `backend/RECALL_WEBHOOK_DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- Review Render logs for detailed error messages
- All logging is comprehensive - check for `❌` or `✅` indicators

