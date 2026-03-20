# 🚀 NEXT STEPS: Complete Stripe Setup

**Status:** ✅ Code changes deployed to GitHub  
**Commit:** `c921fb4`  
**Cloudflare:** Auto-deploying now (~2 minutes)

---

## ✅ What Was Fixed

### 1. **Pricing Page Buttons** ✅
- Free plan: Only "Try for free" button
- Professional plan: Only "Select Plan" button + "Cancel anytime"

### 2. **Payment Step Redesigned** ✅
- Changed from "trial" messaging to "payment" messaging
- Removed "Skip for Now" button (payment now required)
- Added support for monthly (£70) and annual (£56) pricing
- Shows correct price based on selected plan

### 3. **Upgrade Modal Fixed** ✅
- Added validation for missing price ID
- Shows user-friendly error instead of backend error

### 4. **Environment Variables** ✅
- Updated `.env.example` with Stripe variables
- Created comprehensive deployment guide

---

## 🚨 CRITICAL: You Must Complete These Steps

### **Step 1: Create Stripe Products** (10 min)

1. Go to: https://dashboard.stripe.com/
2. Switch to **Test Mode** (toggle in top right)
3. Navigate to: **Products** → **Add Product**

**Monthly Product:**
- Name: `Advicly Professional - Monthly`
- Price: `70 GBP`
- Billing: `Monthly` (recurring)
- **Copy the Price ID** → Save as `MONTHLY_PRICE_ID`

**Annual Product:**
- Name: `Advicly Professional - Annual`
- Price: `672 GBP`
- Billing: `Yearly` (recurring)
- **Copy the Price ID** → Save as `ANNUAL_PRICE_ID`

**Get API Keys:**
- Navigate to: **Developers** → **API Keys**
- Copy **Publishable key** (pk_test_...)
- Copy **Secret key** (sk_test_...)

---

### **Step 2: Configure Cloudflare Pages** (5 min)

1. Go to: https://dash.cloudflare.com/
2. **Workers & Pages** → **adviceapp** → **Settings** → **Environment Variables**
3. Add for **Production**:

```bash
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
REACT_APP_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX (monthly)
REACT_APP_STRIPE_PRICE_ID_ANNUAL=price_XXXXXXXXXXXXX (annual)
```

4. **Save** → Go to **Deployments** → **Retry deployment**

---

### **Step 3: Configure Render** (5 min)

1. Go to: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/env
2. Add/Update:

```bash
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXX
STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
```

3. **Save Changes** (triggers redeploy)

---

### **Step 4: Setup Webhook** (5 min)

1. Go to: https://dashboard.stripe.com/webhooks
2. **Add endpoint**
3. URL: `https://adviceapp-9rgw.onrender.com/api/billing/webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. **Add endpoint** → **Reveal** signing secret
6. Copy secret (whsec_...)
7. Add to Render:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX
   ```

---

## 🧪 Test After Setup (15 min)

### **Test 1: Free Plan**
1. Visit: https://adviceapp.pages.dev/pricing
2. Click "Try for free"
3. Complete signup
4. Verify: No payment step, shows "5 of 5 left"

### **Test 2: Paid Plan (Monthly)**
1. Visit: https://adviceapp.pages.dev/pricing
2. Click "Select Plan" (Monthly)
3. Complete signup
4. **Payment step should show:**
   - Title: "Complete Your Payment"
   - Price: "£70/month"
   - Button: "Continue to Payment"
   - NO "Skip" button
5. Use test card: `4242 4242 4242 4242`
6. Verify: No meeting limit after payment

### **Test 3: Paid Plan (Annual)**
1. Toggle to "Annual" on pricing page
2. Click "Select Plan"
3. Payment step should show "£56/month" + "Billed annually (£672/year)"
4. Complete payment

### **Test 4: Upgrade Flow**
1. Login as free user
2. Click "Upgrade to Professional"
3. Verify: No "Price ID required" error
4. Complete payment

---

## 📊 Expected Results

✅ Pricing page shows correct buttons  
✅ Free signup: 3 steps (no payment)  
✅ Paid signup: 4 steps (payment required)  
✅ Payment step shows correct pricing  
✅ No "Skip" option for paid plans  
✅ Upgrade modal works without errors  

---

## 🐛 Troubleshooting

**Old buttons still showing?**
→ Hard refresh: Cmd+Shift+R or Ctrl+Shift+R

**"Price ID required" error?**
→ Check Cloudflare environment variables are set

**Payment step not showing?**
→ Check URL has `?plan=paid` parameter

---

## 📚 Full Documentation

See `DEPLOYMENT_GUIDE_STRIPE_SETUP.md` for complete step-by-step instructions.

---

## ⏱️ Total Time Required

- Stripe setup: ~25 minutes
- Wait for deployments: ~5 minutes
- Testing: ~15 minutes

**Total: ~45 minutes**

---

## ✅ Success Checklist

- [ ] Stripe products created (Monthly + Annual)
- [ ] Cloudflare environment variables set
- [ ] Render environment variables set
- [ ] Webhook configured
- [ ] Frontend deployed
- [ ] Backend deployed
- [ ] Free plan tested
- [ ] Paid plan tested (Monthly)
- [ ] Paid plan tested (Annual)
- [ ] Upgrade flow tested

---

**Ready to start?** Follow Steps 1-4 above, then test! 🚀

