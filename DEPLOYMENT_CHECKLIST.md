# 🚀 Deployment Checklist - Stripe Payment Integration

## ✅ Pre-Deployment Checklist

### 1. Cloudflare Pages Environment Variables

**Location:** https://dash.cloudflare.com/ → Your Project → Settings → Environment variables → **Production**

**Required Variables (6 total):**

```
✅ REACT_APP_SUPABASE_URL
✅ REACT_APP_SUPABASE_ANON_KEY
✅ REACT_APP_API_BASE_URL
✅ REACT_APP_STRIPE_PUBLIC_KEY
✅ REACT_APP_STRIPE_PRICE_ID
✅ REACT_APP_STRIPE_PRICE_ID_ANNUAL
```

**Exact Values:**

| Variable | Value |
|----------|-------|
| `REACT_APP_SUPABASE_URL` | `https://xjqjzievgepqpgtggcjx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJhbGc...` (Get from Supabase Dashboard → Project Settings → API) |
| `REACT_APP_API_BASE_URL` | `https://adviceapp-9rgw.onrender.com` |
| `REACT_APP_STRIPE_PUBLIC_KEY` | `pk_test_...` (Get from Stripe Dashboard → Developers → API keys → Publishable key) |
| `REACT_APP_STRIPE_PRICE_ID` | `price_1SPnun58eL7gey1h3Grxuo4T` |
| `REACT_APP_STRIPE_PRICE_ID_ANNUAL` | `price_1SQCkS58eL7gey1hMqV8qURW` |

**⚠️ CRITICAL CHECKS:**

- [ ] Variables are in **Production** tab (NOT Preview)
- [ ] Variable names are EXACT (no typos, spaces, or case differences)
- [ ] All 6 variables are present
- [ ] Values have no leading/trailing spaces

---

### 2. Render Backend Environment Variables

**Location:** https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730 → Environment

**Required Variables (2 total):**

```
✅ STRIPE_SECRET_KEY
✅ STRIPE_WEBHOOK_SECRET
```

**Values:**

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` (Get from Stripe Dashboard → Developers → API keys → Secret key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (Get from Stripe Dashboard → Developers → Webhooks) |

---

## 🔄 Deployment Process

### Step 1: Verify Environment Variables

Run locally to test the verification script:

```bash
npm run verify-env
```

**Expected output:**
```
✅ All required environment variables are present!
```

If you see errors, the variables are not set in your local environment (which is fine - they should be in Cloudflare Pages).

---

### Step 2: Commit and Push Changes

```bash
git add -A
git commit -m "Add environment variable verification and documentation"
git push origin main
```

---

### Step 3: Monitor Cloudflare Deployment

1. Go to: https://dash.cloudflare.com/
2. Select your project
3. Click **Deployments** tab
4. Watch for new deployment to appear
5. Click on the deployment to see build logs

**Expected build output:**
```
=== Environment Variables Verification ===

✅ REACT_APP_SUPABASE_URL
✅ REACT_APP_SUPABASE_ANON_KEY
✅ REACT_APP_API_BASE_URL
✅ REACT_APP_STRIPE_PUBLIC_KEY
✅ REACT_APP_STRIPE_PRICE_ID
✅ REACT_APP_STRIPE_PRICE_ID_ANNUAL

✅ All required environment variables are present!
```

**If build fails with missing variables:**
```
❌ ERROR: Missing required environment variables!
```
→ Go back to Step 1 and verify variables are in **Production** environment

---

### Step 4: Wait for Deployment Success

- Status should change from "Building" → "Success"
- Typical build time: 2-3 minutes
- **Do NOT test until status shows "Success"**

---

## 🧪 Testing Process

### Step 1: Clear Browser Cache

**Option A: Hard Refresh**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

**Option B: Incognito/Private Window** (Recommended)
- This ensures you're testing the fresh deployment

---

### Step 2: Open Developer Console

1. Open https://adviceapp.pages.dev
2. Press `F12` or `Cmd + Option + I` (Mac) / `Ctrl + Shift + I` (Windows)
3. Go to **Console** tab
4. Keep it open for the next steps

---

### Step 3: Test Upgrade Flow

1. Log in to your account
2. Click **"Upgrade to Professional"** button
3. **Watch the console logs**

**Expected Success Output:**
```
=== UPGRADE MODAL DEBUG ===
Environment variables check:
- REACT_APP_STRIPE_PRICE_ID: price_1SPnun58e... ✅
- REACT_APP_STRIPE_PUBLIC_KEY: pk_test_51S0ea... ✅
- API_BASE_URL: https://adviceapp-9rgw.onrender.com ✅
- STRIPE_PUBLIC_KEY constant: pk_test_51S0ea... ✅

Creating checkout session...
Request payload: { priceId: 'price_1SPnun58eL7gey1h3Grxuo4T' }
Checkout session created: SUCCESS
Session ID: cs_test_...
Redirecting to Stripe Checkout...
```

**If Still Showing MISSING:**
```
- REACT_APP_STRIPE_PRICE_ID: MISSING ❌
- REACT_APP_STRIPE_PUBLIC_KEY: MISSING ❌
```

**Troubleshooting:**
1. Check deployment status is "Success"
2. Verify deployment timestamp is AFTER you added variables
3. Hard refresh browser again
4. Check variables are in Production (not Preview)
5. Check for typos in variable names

---

### Step 4: Complete Test Payment

Once redirected to Stripe Checkout:

**Use Test Card:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

**Expected Result:**
- Payment succeeds
- Redirected back to your app
- Subscription is created in Stripe Dashboard

---

## 🐛 Troubleshooting Guide

### Issue: Build Fails with "Missing environment variables"

**Cause:** Variables not set in Cloudflare Pages Production environment

**Solution:**
1. Go to Cloudflare Pages → Settings → Environment variables
2. Make sure you're in **Production** tab
3. Add all 6 required variables
4. Retry deployment

---

### Issue: Build Succeeds but Variables Still "MISSING" in Browser

**Cause:** Browser showing cached version OR deployment completed before variables were added

**Solution:**
1. Check deployment timestamp in Cloudflare
2. If deployment was BEFORE you added variables, trigger new deployment
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
4. Or test in incognito window

---

### Issue: "Available env vars" Shows Only 3 Variables

**Console shows:**
```
Available env vars: ['REACT_APP_SUPABASE_ANON_KEY', 'REACT_APP_API_BASE_URL', 'REACT_APP_SUPABASE_URL']
```

**Cause:** Stripe variables were not included in the build

**Solution:**
1. Verify variables are in Cloudflare Pages **Production** environment
2. Trigger new deployment
3. Wait for "Success" status
4. Test again in incognito window

---

### Issue: Backend Returns 500 Error

**Console shows:**
```
Response status: 500
Response data: { error: "..." }
```

**Solution:**
1. Check Render backend logs: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/logs
2. Look for detailed error message
3. Verify `STRIPE_SECRET_KEY` is set in Render
4. Check backend is running (status: "Live")

---

## 📊 Success Criteria

### ✅ Deployment Successful When:

- [ ] Cloudflare build shows "Success" status
- [ ] Build logs show all 6 environment variables present
- [ ] Browser console shows Stripe variables with values (not "MISSING")
- [ ] Clicking "Upgrade" redirects to Stripe Checkout
- [ ] Test payment completes successfully
- [ ] User is redirected back to app after payment

---

## 📞 Quick Links

- **Cloudflare Dashboard:** https://dash.cloudflare.com/
- **Render Dashboard:** https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730
- **Stripe Dashboard:** https://dashboard.stripe.com/test/dashboard
- **App URL:** https://adviceapp.pages.dev
- **Backend URL:** https://adviceapp-9rgw.onrender.com

---

## 📝 Notes

- **Build Verification:** The build now includes automatic environment variable verification
- **Build will fail** if any required variables are missing (this is intentional!)
- **Skip verification:** Use `npm run build:skip-verify` to build without verification (not recommended)
- **Manual verification:** Run `npm run verify-env` to check variables locally

---

**Last Updated:** 2025-11-05  
**Latest Commit:** Will be updated after next commit

