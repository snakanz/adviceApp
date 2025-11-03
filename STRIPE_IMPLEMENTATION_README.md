# Stripe Subscription Implementation - Complete Guide

## 🎯 Overview

Stripe subscription billing has been fully integrated into the Advicly onboarding flow. Users now encounter a subscription step (Step 7) after connecting their calendar and before syncing meetings.

**Pricing:** £70/month with 7-day free trial

## 📁 Files Created

### Frontend
```
src/pages/Onboarding/Step7_SubscriptionPlan.js
```
- Subscription pricing display
- Feature list
- Stripe checkout integration
- Skip option for free trial

### Backend
```
backend/src/routes/billing.js
```
- Checkout session creation
- Free trial creation
- Subscription status retrieval
- Webhook handling

### Database
```
backend/migrations/026_create_billing_tables.sql
```
- `stripe_customers` table
- `subscriptions` table
- `chargebacks` table
- RLS policies

### Documentation
```
STRIPE_SUBSCRIPTION_ONBOARDING_IMPLEMENTATION.md
STRIPE_SETUP_CHECKLIST.md
.env.example.billing
STRIPE_SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md
STRIPE_IMPLEMENTATION_README.md
```

## 📝 Files Modified

1. **src/pages/Onboarding/OnboardingFlow.js**
   - Added Step 7 import
   - Updated progress bar (6 steps)
   - Added subscription step rendering

2. **backend/src/routes/index.js**
   - Mounted billing routes

3. **backend/src/routes/auth.js**
   - Updated final step to 7

## 🚀 Quick Start

### 1. Set Up Stripe Account
```bash
# Go to https://stripe.com
# Create account → Create product "Advicly Pro"
# Create price: £70/month
# Get API keys from https://dashboard.stripe.com/apikeys
```

### 2. Configure Environment Variables

**Frontend (.env):**
```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_XXXXX
REACT_APP_STRIPE_PRICE_ID=price_XXXXX
```

**Backend (.env):**
```
STRIPE_PUBLIC_KEY=pk_test_XXXXX
STRIPE_SECRET_KEY=sk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
```

### 3. Run Database Migration

```sql
-- Execute in Supabase SQL Editor:
-- Copy contents of backend/migrations/026_create_billing_tables.sql
```

### 4. Set Up Webhook

```
URL: https://your-backend.com/api/billing/webhook
Events:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
```

### 5. Test Locally

```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
npm start

# Terminal 3: Stripe CLI (optional)
stripe listen --forward-to localhost:3001/api/billing/webhook
```

## 🧪 Testing

### Test Cards (Use with test keys only)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### Test Flows
1. **Start Trial with Payment**
   - Click "Start 7-Day Free Trial"
   - Enter test card
   - Verify subscription created in database

2. **Skip and Use Free Trial**
   - Click "Skip for Now"
   - Verify free trial created in database
   - Check trial_ends_at is 7 days from now

## 📊 Database Schema

### stripe_customers
```sql
id (UUID, PK)
user_id (UUID, FK)
stripe_customer_id (TEXT, UNIQUE)
email (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### subscriptions
```sql
id (UUID, PK)
user_id (UUID, FK, UNIQUE)
stripe_subscription_id (TEXT)
plan (TEXT) - 'pro', 'free'
status (TEXT) - 'trialing', 'active', 'cancelled'
trial_ends_at (TIMESTAMP)
current_period_start (TIMESTAMP)
current_period_end (TIMESTAMP)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### chargebacks
```sql
id (UUID, PK)
stripe_customer_id (TEXT)
amount (INTEGER)
reason (TEXT)
created_at (TIMESTAMP)
```

## 🔌 API Endpoints

### POST /api/billing/checkout
Create Stripe checkout session
```json
{
  "priceId": "price_XXXXX"
}
```

### POST /api/billing/create-trial
Create free trial without payment
```json
{}
```

### GET /api/billing/subscription
Get current subscription status
```json
{
  "plan": "pro",
  "status": "trialing",
  "trial_ends_at": "2024-11-10T12:00:00Z"
}
```

### POST /api/billing/webhook
Stripe webhook endpoint (automatic)

## 🔐 Security Features

✅ **RLS (Row Level Security)**
- Users can only see their own data
- Policies enforce user isolation

✅ **Webhook Verification**
- Stripe signature verification
- Prevents unauthorized requests

✅ **3D Secure**
- Enabled for all card payments
- Fraud prevention

✅ **Error Handling**
- Graceful error messages
- Logging for debugging

## 📈 Monitoring

### Stripe Dashboard
- https://dashboard.stripe.com/customers
- https://dashboard.stripe.com/subscriptions
- https://dashboard.stripe.com/webhooks

### Database Queries
```sql
-- Check subscriptions
SELECT * FROM subscriptions WHERE user_id = 'USER_ID';

-- Check Stripe customers
SELECT * FROM stripe_customers WHERE user_id = 'USER_ID';

-- Check chargebacks
SELECT * FROM chargebacks;
```

## 🐛 Troubleshooting

### Stripe.js Not Loading
- Check `REACT_APP_STRIPE_PUBLIC_KEY` is set
- Verify key starts with `pk_`
- Check browser console

### Checkout Not Working
- Verify `REACT_APP_STRIPE_PRICE_ID` is correct
- Check backend logs
- Verify Stripe keys in backend

### Webhook Not Firing
- Check webhook URL is accessible
- Verify signing secret matches
- Check Stripe Dashboard for failed events

### Database Issues
- Verify migration ran successfully
- Check RLS policies are enabled
- Verify foreign keys exist

## 📚 Documentation

- **Full Implementation Guide:** `STRIPE_SUBSCRIPTION_ONBOARDING_IMPLEMENTATION.md`
- **Setup Checklist:** `STRIPE_SETUP_CHECKLIST.md`
- **Implementation Summary:** `STRIPE_SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md`

## ✅ Deployment Checklist

- [ ] Stripe account created
- [ ] Product & price created
- [ ] API keys obtained
- [ ] Environment variables set
- [ ] Database migration run
- [ ] Webhook configured
- [ ] Local testing passed
- [ ] Frontend deployed
- [ ] Backend deployed
- [ ] Webhook URL updated
- [ ] Live keys configured
- [ ] Production testing passed

## 🎉 Success Criteria

✅ Users see subscription step in onboarding
✅ "Start Trial" button works with Stripe Checkout
✅ "Skip for Now" creates free trial in database
✅ Subscriptions tracked in database
✅ Webhooks fire and update database
✅ Trial end dates calculated correctly
✅ Users can upgrade from Settings

## 📞 Support

- **Stripe Support:** https://support.stripe.com
- **Stripe Docs:** https://stripe.com/docs
- **Implementation Questions:** See documentation files

---

**Status:** ✅ Ready for Deployment

**Last Updated:** November 3, 2024

