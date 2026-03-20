# Stripe Subscription Integration - Onboarding Implementation

## Overview

This document outlines the implementation of Stripe subscription billing integrated into the Advicly onboarding flow. Users now see a subscription step (Step 7) after calendar setup and before initial sync.

## Implementation Summary

### Frontend Changes

**New Component:** `src/pages/Onboarding/Step7_SubscriptionPlan.js`
- Displays pricing: £70/month
- Highlights 7-day free trial (no credit card required)
- Shows included features
- Two action buttons:
  - "Start 7-Day Free Trial" → Stripe Checkout
  - "Skip for Now" → Creates free trial in database

**Updated:** `src/pages/Onboarding/OnboardingFlow.js`
- Added Step 7 (Subscription Plan)
- Updated progress bar: "Step X of 6" (was "Step X of 3")
- Progress calculation: `((currentStep - 1) / 6) * 100%`
- Step 4 now shows subscription (was Step 3 for sync)
- Step 5 now shows sync (was Step 3)
- Step 6 now shows completion (was Step 4)

### Backend Changes

**New Route:** `backend/src/routes/billing.js`
- `POST /api/billing/checkout` - Create Stripe checkout session
- `POST /api/billing/create-trial` - Create free trial without payment
- `GET /api/billing/subscription` - Get subscription status
- `POST /api/billing/webhook` - Handle Stripe webhook events

**Updated:** `backend/src/routes/index.js`
- Mounted billing routes at `/api/billing`

**Updated:** `backend/src/routes/auth.js`
- Updated onboarding completion step from 6 to 7

### Database Changes

**New Migration:** `backend/migrations/026_create_billing_tables.sql`

Creates three tables:

1. **stripe_customers**
   - Maps users to Stripe customer IDs
   - Prevents duplicate Stripe customers
   - Stores email for Stripe

2. **subscriptions**
   - Tracks subscription status (trialing, active, cancelled)
   - Stores trial end date
   - Stores current billing period
   - Stores plan type (pro, etc.)

3. **chargebacks**
   - Fraud monitoring
   - Tracks disputed charges

All tables have RLS (Row Level Security) policies enabled.

## Setup Instructions

### 1. Create Stripe Account & Products

1. Go to https://dashboard.stripe.com
2. Create a product called "Advicly Pro"
3. Create a price: £70/month (recurring)
4. Copy the Price ID (format: `price_XXXXXXXXXXXXX`)

### 2. Set Environment Variables

**Frontend (.env):**
```
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_YOUR_KEY
REACT_APP_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX
```

**Backend (.env):**
```
STRIPE_PUBLIC_KEY=pk_live_YOUR_KEY
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
```

### 3. Run Database Migration

Execute the SQL migration in Supabase:
```sql
-- Run: backend/migrations/026_create_billing_tables.sql
```

### 4. Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Create new endpoint:
   - URL: `https://your-backend.com/api/billing/webhook`
   - Events: 
     - customer.subscription.created
     - customer.subscription.updated
     - customer.subscription.deleted
     - invoice.payment_succeeded
     - invoice.payment_failed
3. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 5. Install Stripe Package (if not already installed)

```bash
npm install stripe
```

## Onboarding Flow

```
Step 1: Account Creation (Google/Email OAuth)
Step 2: Role Selection
Step 3: Business Profile
Step 4: Calendar Intro
Step 5: Calendar Provider Selection
Step 6: Calendar OAuth Connection
Step 7: ⭐ SUBSCRIPTION PLAN (NEW)
        ├─ Show pricing: £70/month
        ├─ Highlight: 7-day free trial
        ├─ Show features
        └─ Two options:
           ├─ Start Trial → Stripe Checkout
           └─ Skip for Now → Free trial in DB
Step 8: Initial Sync
Step 9: Completion
```

## User Flows

### Flow 1: User Starts Trial with Payment

1. User clicks "Start 7-Day Free Trial"
2. Redirected to Stripe Checkout
3. Enters payment details
4. Stripe creates subscription with 7-day trial
5. Webhook updates database
6. User redirected to onboarding completion
7. After 7 days, auto-charged £70/month

### Flow 2: User Skips Payment

1. User clicks "Skip for Now"
2. Free trial created in database (7 days)
3. User continues to sync step
4. Dashboard shows "Trial ends in X days"
5. Email reminder sent 1 day before expiry
6. User can upgrade from Settings anytime

## Database Schema

### stripe_customers
```sql
id (UUID, PK)
user_id (UUID, FK → users)
stripe_customer_id (TEXT, UNIQUE)
email (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### subscriptions
```sql
id (UUID, PK)
user_id (UUID, FK → users, UNIQUE)
stripe_subscription_id (TEXT)
plan (TEXT) - 'pro', 'free', etc.
status (TEXT) - 'trialing', 'active', 'cancelled'
trial_ends_at (TIMESTAMP)
current_period_start (TIMESTAMP)
current_period_end (TIMESTAMP)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

## Testing

### Test Stripe Keys
Use Stripe test keys for development:
- Public: `pk_test_XXXXX`
- Secret: `sk_test_XXXXX`

### Test Card Numbers
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

### Test Webhook
Use Stripe CLI to test webhooks locally:
```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

## Monitoring

### Check Subscription Status
```bash
GET /api/billing/subscription
```

### View Stripe Dashboard
- Customers: https://dashboard.stripe.com/customers
- Subscriptions: https://dashboard.stripe.com/subscriptions
- Webhooks: https://dashboard.stripe.com/webhooks

## Troubleshooting

### Webhook Not Firing
- Check webhook URL is correct
- Verify signing secret matches
- Check Stripe Dashboard for failed deliveries

### Checkout Session Not Creating
- Verify Stripe keys are correct
- Check Price ID exists in Stripe
- Verify user has valid email

### Trial Not Creating
- Check database migration ran successfully
- Verify RLS policies allow inserts
- Check backend logs for errors

## Next Steps

1. ✅ Frontend component created
2. ✅ Backend routes created
3. ✅ Database migration created
4. ⏳ Run database migration in Supabase
5. ⏳ Set environment variables
6. ⏳ Create Stripe product & price
7. ⏳ Set up webhook
8. ⏳ Test complete flow
9. ⏳ Deploy to production

## Files Modified/Created

**Created:**
- `src/pages/Onboarding/Step7_SubscriptionPlan.js`
- `backend/src/routes/billing.js`
- `backend/migrations/026_create_billing_tables.sql`
- `.env.example.billing`
- `STRIPE_SUBSCRIPTION_ONBOARDING_IMPLEMENTATION.md`

**Modified:**
- `src/pages/Onboarding/OnboardingFlow.js`
- `backend/src/routes/index.js`
- `backend/src/routes/auth.js`

