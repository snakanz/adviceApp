# Stripe Webhook Configuration Guide

## ⚠️ IMPORTANT: You Need to Configure Stripe Webhooks

The webhook handler code is now deployed, but you need to configure Stripe to send events to your backend.

---

## 🔧 Setup Instructions

### **Step 1: Go to Stripe Dashboard**

1. Open: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"** button

---

### **Step 2: Configure Webhook Endpoint**

**Endpoint URL:**
```
https://adviceapp-9rgw.onrender.com/api/billing/webhook
```

**Events to Listen For:**

Select these events (click "Select events" button):

- ✅ `checkout.session.completed` - **CRITICAL** (creates subscription immediately)
- ✅ `customer.subscription.created` - Creates/updates subscription
- ✅ `customer.subscription.updated` - Updates subscription status
- ✅ `customer.subscription.deleted` - Handles cancellations
- ✅ `invoice.payment_succeeded` - Logs successful payments
- ✅ `invoice.payment_failed` - Handles failed payments

---

### **Step 3: Get Webhook Signing Secret**

After creating the endpoint, Stripe will show you a **Signing Secret** that looks like:

```
whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Copy this secret!** You'll need it in the next step.

---

### **Step 4: Add Webhook Secret to Render**

1. Go to: https://dashboard.render.com/
2. Select your service: **adviceApp** (srv-d1mjml7fte5s73ccl730)
3. Click **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add:
   ```
   Key: STRIPE_WEBHOOK_SECRET
   Value: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Click **"Save Changes"**
7. Service will automatically redeploy

---

## 🧪 Test the Webhook

### **Option 1: Use Stripe CLI (Recommended for Testing)**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local backend
stripe listen --forward-to http://localhost:3001/api/billing/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

### **Option 2: Test with Real Payment**

1. Go to: https://adviceapp.pages.dev/onboarding
2. Complete onboarding steps
3. Click "Upgrade to Professional"
4. Use test card: `4242 4242 4242 4242`
5. Complete payment
6. Check Stripe Dashboard → Webhooks → Your endpoint
7. Should see successful webhook deliveries

---

## 📊 Verify Webhook is Working

### **Check Stripe Dashboard:**

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your endpoint
3. Check **"Recent deliveries"** section
4. Should see events with ✅ green checkmarks

### **Check Render Logs:**

1. Go to: https://dashboard.render.com/
2. Select **adviceApp** service
3. Click **"Logs"** tab
4. Look for:
   ```
   🎉 Checkout completed for session cs_test_xxx
   ✅ Subscription sub_xxx created for user xxx - plan: pro, status: active
   ```

### **Check Supabase Database:**

```sql
SELECT * FROM subscriptions 
WHERE stripe_subscription_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Should see subscriptions with:
- `plan: 'pro'`
- `status: 'active'`
- `stripe_subscription_id: 'sub_xxx'`

---

## 🔒 Security Notes

### **Webhook Signature Verification**

The backend automatically verifies webhook signatures using:

```javascript
const event = stripe.webhooks.constructEvent(
  req.body, 
  req.headers['stripe-signature'], 
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**This prevents:**
- Fake webhook requests
- Replay attacks
- Unauthorized access

**Never skip signature verification in production!**

---

## 🐛 Troubleshooting

### **Problem: Webhook returns 400 error**

**Cause:** Signature verification failed

**Solution:**
1. Check `STRIPE_WEBHOOK_SECRET` is correct in Render
2. Make sure you're using the signing secret from the webhook endpoint (not API keys)
3. Verify the endpoint URL is exactly: `https://adviceapp-9rgw.onrender.com/api/billing/webhook`

---

### **Problem: Webhook returns 500 error**

**Cause:** Error processing webhook

**Solution:**
1. Check Render logs for error details
2. Verify Supabase connection is working
3. Check `stripe_customers` table has the customer record

---

### **Problem: Subscription not created in database**

**Cause:** Webhook not configured or failing

**Solution:**
1. Verify webhook endpoint is configured in Stripe
2. Check webhook deliveries in Stripe Dashboard
3. Check Render logs for webhook processing errors
4. Verify `STRIPE_WEBHOOK_SECRET` environment variable is set

---

## 📝 Webhook Event Flow

```
User completes payment
    ↓
Stripe sends: checkout.session.completed
    ↓
Backend receives webhook at /api/billing/webhook
    ↓
Verifies signature with STRIPE_WEBHOOK_SECRET
    ↓
Calls handleCheckoutCompleted()
    ↓
Fetches subscription from Stripe API
    ↓
Creates subscription in Supabase:
  - user_id
  - stripe_subscription_id
  - plan: 'pro'
  - status: 'active'
    ↓
Returns 200 OK to Stripe
    ↓
User redirected to dashboard
    ↓
Dashboard shows "Professional Plan - Active"
```

---

## ✅ Checklist

Before testing the payment flow, make sure:

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Endpoint URL: `https://adviceapp-9rgw.onrender.com/api/billing/webhook`
- [ ] Events selected: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- [ ] Webhook signing secret copied
- [ ] `STRIPE_WEBHOOK_SECRET` added to Render environment variables
- [ ] Backend redeployed with new environment variable
- [ ] Test webhook delivery shows ✅ success

---

## 🎯 Next Steps

1. **Configure webhook in Stripe Dashboard** (5 minutes)
2. **Add webhook secret to Render** (2 minutes)
3. **Wait for backend to redeploy** (~3-5 minutes)
4. **Test the complete payment flow** (5 minutes)
5. **Verify subscription created in Supabase** (1 minute)

**Total time: ~15-20 minutes**

---

**Once the webhook is configured, the entire payment flow will work perfectly!** 🚀

