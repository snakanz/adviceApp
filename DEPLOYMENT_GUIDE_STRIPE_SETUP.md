# 🚀 Deployment Guide: Stripe Payment Setup

## Overview

This guide will help you complete the deployment of the Advicly payment system with Stripe integration.

**Two Plan Options:**
1. **Free Plan** - 5 free AI-transcribed meetings, then upgrade required
2. **Professional Plan** - Unlimited AI-transcribed meetings (£70/month or £56/month billed annually)

---

## ✅ Step 1: Create Stripe Products & Prices

### 1.1 Login to Stripe Dashboard

Go to: https://dashboard.stripe.com/

**Important:** Use **Test Mode** for testing, then switch to **Live Mode** for production.

### 1.2 Create Monthly Product

1. Navigate to: **Products** → **Add Product**
2. Fill in:
   - **Name:** `Advicly Professional - Monthly`
   - **Description:** `Unlimited AI-transcribed meetings and premium features`
   - **Pricing Model:** `Standard pricing`
   - **Price:** `70 GBP`
   - **Billing Period:** `Monthly`
   - **Recurring:** ✅ Yes
3. Click **Save product**
4. **Copy the Price ID** (format: `price_XXXXXXXXXXXXX`)
   - Save this as: `MONTHLY_PRICE_ID`

### 1.3 Create Annual Product

1. Navigate to: **Products** → **Add Product**
2. Fill in:
   - **Name:** `Advicly Professional - Annual`
   - **Description:** `Unlimited AI-transcribed meetings and premium features (save 20%)`
   - **Pricing Model:** `Standard pricing`
   - **Price:** `672 GBP` (£56/month × 12 months)
   - **Billing Period:** `Yearly`
   - **Recurring:** ✅ Yes
3. Click **Save product**
4. **Copy the Price ID** (format: `price_XXXXXXXXXXXXX`)
   - Save this as: `ANNUAL_PRICE_ID`

### 1.4 Get API Keys

1. Navigate to: **Developers** → **API Keys**
2. Copy:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

---

## ✅ Step 2: Configure Backend Environment Variables (Render)

### 2.1 Go to Render Dashboard

URL: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/env

### 2.2 Add/Update Environment Variables

Add these variables (or update if they already exist):

```bash
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXX
STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
```

**Note:** We'll add `STRIPE_WEBHOOK_SECRET` in Step 4 after setting up the webhook.

### 2.3 Save Changes

Click **"Save Changes"** - This will trigger an automatic backend redeploy (~2-3 minutes).

---

## ✅ Step 3: Configure Frontend Environment Variables (Cloudflare Pages)

### 3.1 Go to Cloudflare Pages Dashboard

1. Login to Cloudflare: https://dash.cloudflare.com/
2. Navigate to: **Workers & Pages** → **adviceapp** (or your project name)
3. Go to: **Settings** → **Environment Variables**

### 3.2 Add Environment Variables

Add these variables for **Production** environment:

```bash
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
REACT_APP_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX (monthly price ID)
REACT_APP_STRIPE_PRICE_ID_ANNUAL=price_XXXXXXXXXXXXX (annual price ID)
```

**Important:** Make sure to use the correct values:
- `REACT_APP_STRIPE_PUBLIC_KEY` = Publishable key from Stripe (starts with `pk_`)
- `REACT_APP_STRIPE_PRICE_ID` = Monthly price ID from Step 1.2
- `REACT_APP_STRIPE_PRICE_ID_ANNUAL` = Annual price ID from Step 1.3

### 3.3 Trigger Redeploy

After saving environment variables:
1. Go to **Deployments** tab
2. Click **"Retry deployment"** on the latest deployment
   - OR push a new commit to trigger automatic deployment

**Deployment time:** ~1-2 minutes

---

## ✅ Step 4: Setup Stripe Webhook

### 4.1 Create Webhook Endpoint

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Fill in:
   - **Endpoint URL:** `https://adviceapp-9rgw.onrender.com/api/billing/webhook`
   - **Description:** `Advicly Billing Webhook`
   - **Events to listen for:** Select these events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `checkout.session.completed`

4. Click **"Add endpoint"**

### 4.2 Get Webhook Signing Secret

1. Click on the newly created webhook endpoint
2. Click **"Reveal"** next to **Signing secret**
3. Copy the secret (starts with `whsec_`)

### 4.3 Add Webhook Secret to Render

1. Go back to: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/env
2. Add new environment variable:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX
   ```
3. Click **"Save Changes"** (triggers redeploy)

---

## ✅ Step 5: Verify Deployment

### 5.1 Check Frontend Deployment

1. Go to Cloudflare Pages dashboard
2. Check latest deployment status (should be green ✅)
3. Visit: https://adviceapp.pages.dev/pricing

**Expected Results:**
- Free plan shows only **"Try for free"** button
- Professional plan shows only **"Select Plan"** button + "Cancel anytime" text
- Billing toggle works (Monthly £70 / Annual £56)

### 5.2 Check Backend Deployment

1. Go to Render dashboard
2. Check service status (should be green ✅)
3. Check logs for any errors

### 5.3 Test Environment Variables

Open browser console on https://adviceapp.pages.dev and run:

```javascript
console.log('Stripe Public Key:', process.env.REACT_APP_STRIPE_PUBLIC_KEY ? '✅ Set' : '❌ Missing');
console.log('Monthly Price ID:', process.env.REACT_APP_STRIPE_PRICE_ID ? '✅ Set' : '❌ Missing');
console.log('Annual Price ID:', process.env.REACT_APP_STRIPE_PRICE_ID_ANNUAL ? '✅ Set' : '❌ Missing');
```

**All three should show ✅ Set**

---

## ✅ Step 6: Test Payment Flow

### 6.1 Test Free Plan Signup

1. Go to: https://adviceapp.pages.dev/pricing
2. Click **"Try for free"** on Free plan
3. Complete registration with a new email
4. Complete onboarding:
   - Business Profile
   - Calendar Setup
   - Complete (auto-creates free subscription)
5. Verify:
   - ✅ Sidebar shows "5 of 5 left" (or "4 of 5 left" if you have meetings)
   - ✅ No payment step shown
   - ✅ Can access app immediately

### 6.2 Test Paid Plan Signup (Monthly)

1. Go to: https://adviceapp.pages.dev/pricing
2. Click **"Select Plan"** on Professional plan (Monthly)
3. Complete registration with a new email
4. Complete onboarding:
   - Business Profile
   - Calendar Setup
   - **Payment Step** (should appear)
5. On payment step:
   - ✅ Shows "Complete Your Payment" title
   - ✅ Shows "£70/month" price
   - ✅ Shows "Billed monthly" text
   - ✅ Shows "Continue to Payment" button
   - ✅ NO "Skip for Now" button
6. Click **"Continue to Payment"**
7. Use Stripe test card: **4242 4242 4242 4242**
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
8. Complete payment
9. Verify:
   - ✅ Redirected back to app
   - ✅ No meeting limit shown in sidebar (unlimited)
   - ✅ Can access app

### 6.3 Test Paid Plan Signup (Annual)

1. Go to: https://adviceapp.pages.dev/pricing
2. Toggle to **"Annual"** billing
3. Click **"Select Plan"** on Professional plan
4. Complete registration with a new email
5. Complete onboarding (same as monthly)
6. On payment step:
   - ✅ Shows "£56/month" price
   - ✅ Shows "Billed annually (£672/year)" text
7. Complete payment with test card
8. Verify subscription created

### 6.4 Test Upgrade Flow (Free → Paid)

1. Login as a free user
2. Click **"Upgrade to Professional"** in sidebar
3. Verify:
   - ✅ Modal opens with pricing comparison
   - ✅ "Upgrade to Professional" button works
   - ✅ NO "Price ID is required" error
4. Complete payment with test card
5. Verify:
   - ✅ Meeting limit removed from sidebar
   - ✅ Subscription updated in database

---

## 🧪 Stripe Test Cards

Use these cards in **Test Mode** only:

| Card Number | Use Case |
|-------------|----------|
| `4242 4242 4242 4242` | ✅ Successful payment |
| `4000 0000 0000 0002` | ❌ Payment declined |
| `4000 0027 6000 3184` | 🔒 Requires 3D Secure authentication |
| `4000 0000 0000 9995` | ❌ Insufficient funds |

**For all cards:**
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## 🔍 Troubleshooting

### Issue: "Price ID is required" error

**Cause:** Environment variable not set in Cloudflare Pages

**Fix:**
1. Go to Cloudflare Pages → Settings → Environment Variables
2. Verify `REACT_APP_STRIPE_PRICE_ID` is set
3. Redeploy frontend

### Issue: Pricing page still shows old buttons

**Cause:** Browser cache or deployment not complete

**Fix:**
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Check Cloudflare deployment status
3. Clear browser cache

### Issue: Payment step not showing for paid plans

**Cause:** Session storage not persisting selected plan

**Fix:**
1. Check browser console for errors
2. Verify URL has `?plan=paid` parameter after registration
3. Check session storage: `sessionStorage.getItem('selectedPlan')`

### Issue: Webhook not receiving events

**Cause:** Webhook secret mismatch or endpoint URL incorrect

**Fix:**
1. Verify webhook URL: `https://adviceapp-9rgw.onrender.com/api/billing/webhook`
2. Check webhook secret in Render matches Stripe
3. Check Render logs for webhook errors

---

## 📊 Monitoring

### Check Stripe Dashboard

- **Payments:** https://dashboard.stripe.com/payments
- **Subscriptions:** https://dashboard.stripe.com/subscriptions
- **Customers:** https://dashboard.stripe.com/customers
- **Webhooks:** https://dashboard.stripe.com/webhooks

### Check Render Logs

```bash
# View recent logs
https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/logs
```

Look for:
- ✅ `Checkout session created for user`
- ✅ `Webhook received: checkout.session.completed`
- ✅ `Subscription created for user`

---

## 🎉 Success Checklist

- [ ] Stripe products created (Monthly + Annual)
- [ ] Backend environment variables set (Render)
- [ ] Frontend environment variables set (Cloudflare)
- [ ] Webhook endpoint configured
- [ ] Frontend deployed successfully
- [ ] Backend deployed successfully
- [ ] Free plan signup works
- [ ] Paid plan signup works (Monthly)
- [ ] Paid plan signup works (Annual)
- [ ] Upgrade flow works
- [ ] No "Price ID required" errors
- [ ] Pricing page buttons correct

---

## 🚀 Going Live (Production)

When ready to accept real payments:

1. **Switch Stripe to Live Mode**
   - Create products in Live Mode
   - Get Live API keys
2. **Update Environment Variables**
   - Replace all `pk_test_` with `pk_live_`
   - Replace all `sk_test_` with `sk_live_`
   - Update price IDs to live price IDs
3. **Update Webhook**
   - Create new webhook in Live Mode
   - Update `STRIPE_WEBHOOK_SECRET` with live secret
4. **Test with Real Card**
   - Use a real card to verify payment flow
   - Immediately refund the test payment

---

**Need Help?** Check the Stripe documentation: https://stripe.com/docs

