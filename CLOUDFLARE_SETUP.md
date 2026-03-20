# Cloudflare Pages Environment Variables Setup

## 🎯 Required Environment Variables for Production

You **MUST** set these environment variables in Cloudflare Pages for the app to work correctly.

### 📍 Where to Set Them

1. Go to: https://dash.cloudflare.com/
2. Select your **adviceApp** project
3. Click **Settings** → **Environment variables**
4. Make sure you're in the **Production** tab (NOT Preview)
5. Click **Add variable** for each one below

---

## ✅ Required Variables

### **Supabase Configuration**

| Variable Name | Value | Where to Get It |
|---------------|-------|-----------------|
| `REACT_APP_SUPABASE_URL` | `https://xjqjzievgepqpgtggcjx.supabase.co` | Supabase Dashboard → Project Settings → API |
| `REACT_APP_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase Dashboard → Project Settings → API → anon/public key |

### **Backend API Configuration**

| Variable Name | Value |
|---------------|-------|
| `REACT_APP_API_BASE_URL` | `https://adviceapp-9rgw.onrender.com` |

### **Stripe Configuration** ⚠️ CRITICAL FOR PAYMENTS

| Variable Name | Value | Where to Get It |
|---------------|-------|-----------------|
| `REACT_APP_STRIPE_PUBLIC_KEY` | `pk_test_...` | Stripe Dashboard → Developers → API keys → Publishable key (Test mode) |
| `REACT_APP_STRIPE_PRICE_ID` | `price_1SPnun58eL7gey1h3Grxuo4T` | Stripe Dashboard → Products → Monthly plan → Pricing → Copy price ID |
| `REACT_APP_STRIPE_PRICE_ID_ANNUAL` | `price_1SQCkS58eL7gey1hMqV8qURW` | Stripe Dashboard → Products → Annual plan → Pricing → Copy price ID |

---

## 🔍 How to Verify Variables Are Set Correctly

### **Step 1: Check in Cloudflare Dashboard**

1. Go to Settings → Environment variables → **Production** tab
2. You should see **6 variables** listed:
   - ✅ `REACT_APP_SUPABASE_URL`
   - ✅ `REACT_APP_SUPABASE_ANON_KEY`
   - ✅ `REACT_APP_API_BASE_URL`
   - ✅ `REACT_APP_STRIPE_PUBLIC_KEY`
   - ✅ `REACT_APP_STRIPE_PRICE_ID`
   - ✅ `REACT_APP_STRIPE_PRICE_ID_ANNUAL`

### **Step 2: Verify Variable Names (No Typos!)**

**CRITICAL:** Variable names must be EXACT. Copy/paste these:

```
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_API_BASE_URL
REACT_APP_STRIPE_PUBLIC_KEY
REACT_APP_STRIPE_PRICE_ID
REACT_APP_STRIPE_PRICE_ID_ANNUAL
```

**Common mistakes to avoid:**
- ❌ Extra spaces: `REACT_APP_STRIPE_PRICE_ID ` (space at end)
- ❌ Wrong separator: `REACT-APP-STRIPE-PRICE-ID` (dashes instead of underscores)
- ❌ Wrong case: `react_app_stripe_price_id` (must be uppercase)
- ❌ Missing prefix: `STRIPE_PRICE_ID` (must start with `REACT_APP_`)

### **Step 3: Trigger New Deployment**

After adding/verifying variables:

1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Select **"Retry deployment"**
4. Wait for status to show **"Success"** (usually 2-3 minutes)

### **Step 4: Test in Browser**

Once deployment is successful:

1. Open https://adviceapp.pages.dev in **Incognito/Private mode**
2. Open Developer Console (F12)
3. Click "Upgrade to Professional"
4. Look for logs starting with `=== UPGRADE MODAL DEBUG ===`

**Expected output (SUCCESS):**
```
=== UPGRADE MODAL DEBUG ===
Environment variables check:
- REACT_APP_STRIPE_PRICE_ID: price_1SPnun58e... ✅
- REACT_APP_STRIPE_PUBLIC_KEY: pk_test_51S0ea... ✅
```

**If you still see MISSING:**
```
- REACT_APP_STRIPE_PRICE_ID: MISSING ❌
```
→ The variables are not in the Production environment or deployment hasn't completed

---

## 🚨 Important Notes

### **Why Variables Must Be Set BEFORE Build**

React (Create React App) environment variables work differently than backend variables:

- **Backend (Render):** Variables are read at **runtime** ✅
- **Frontend (React):** Variables are **baked into the JavaScript bundle** at **build time** ⚠️

This means:
1. Cloudflare Pages reads environment variables during the build
2. It replaces `process.env.REACT_APP_*` with actual values in the code
3. The built JavaScript contains hardcoded values
4. **Adding variables AFTER build = they won't be in the bundle!**

**Solution:** Always trigger a new deployment after adding/changing variables!

### **Production vs Preview Environments**

Cloudflare Pages has two environments:

- **Production:** Used for deployments from your main branch
- **Preview:** Used for pull requests and other branches

**Make sure variables are in the Production environment!**

---

## 📋 Deployment Checklist

Before testing payments:

- [ ] All 6 environment variables are set in Cloudflare Pages
- [ ] Variables are in the **Production** environment (not just Preview)
- [ ] Variable names are exact (no typos, correct case, correct underscores)
- [ ] New deployment has been triggered AFTER adding variables
- [ ] Deployment status shows "Success"
- [ ] Browser has been hard refreshed (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Tested in incognito/private window to avoid cache issues

---

## 🔧 Troubleshooting

### Issue: Variables still show "MISSING" in console

**Possible causes:**
1. Variables are in Preview environment, not Production
2. Deployment hasn't completed yet
3. Browser is showing cached version
4. Typo in variable name

**Solutions:**
1. Verify variables are in Production tab
2. Wait for deployment to complete
3. Hard refresh or use incognito mode
4. Delete and re-add variables with exact names

### Issue: Deployment fails

**Check build logs:**
1. Go to Deployments tab
2. Click on the failed deployment
3. Check logs for errors
4. Common issues: missing dependencies, build script errors

### Issue: Can't find Environment Variables in Cloudflare

**Navigation:**
1. Cloudflare Dashboard → Pages
2. Select your project (adviceApp)
3. Settings (top navigation)
4. Environment variables (left sidebar)

---

## 📞 Support Links

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Environment Variables Guide:** https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
- **Stripe Dashboard:** https://dashboard.stripe.com/test/apikeys
- **Supabase Dashboard:** https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx

---

**Last Updated:** 2025-11-05  
**Latest Commit:** 956a2cb

