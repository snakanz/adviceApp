# Stripe Subscription Setup Checklist

## Pre-Implementation Checklist

### 1. Stripe Account Setup
- [ ] Create Stripe account at https://stripe.com
- [ ] Verify email
- [ ] Complete business information
- [ ] Enable live mode (when ready for production)

### 2. Create Product & Price
- [ ] Go to https://dashboard.stripe.com/products
- [ ] Click "Create product"
- [ ] Name: "Advicly Pro"
- [ ] Description: "Professional financial advisor management platform"
- [ ] Click "Add pricing"
- [ ] Billing period: Monthly
- [ ] Price: £70.00
- [ ] Currency: GBP
- [ ] Copy Price ID (format: `price_XXXXXXXXXXXXX`)

### 3. Get API Keys
- [ ] Go to https://dashboard.stripe.com/apikeys
- [ ] Copy Publishable key (starts with `pk_`)
- [ ] Copy Secret key (starts with `sk_`)
- [ ] **IMPORTANT:** Use test keys first, then switch to live keys

### 4. Set Up Webhook
- [ ] Go to https://dashboard.stripe.com/webhooks
- [ ] Click "Add endpoint"
- [ ] Endpoint URL: `https://your-backend-url.com/api/billing/webhook`
- [ ] Select events:
  - [ ] customer.subscription.created
  - [ ] customer.subscription.updated
  - [ ] customer.subscription.deleted
  - [ ] invoice.payment_succeeded
  - [ ] invoice.payment_failed
- [ ] Click "Add endpoint"
- [ ] Copy signing secret (starts with `whsec_`)

### 5. Environment Variables - Frontend

**File:** `.env` (or `.env.local`)

```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
REACT_APP_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX
REACT_APP_API_BASE_URL=http://localhost:3001
```

### 6. Environment Variables - Backend

**File:** `backend/.env`

```
STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX
FRONTEND_URL=http://localhost:3000
```

### 7. Database Migration

- [ ] Open Supabase dashboard
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Copy contents of `backend/migrations/026_create_billing_tables.sql`
- [ ] Run the migration
- [ ] Verify tables created:
  - [ ] `stripe_customers`
  - [ ] `subscriptions`
  - [ ] `chargebacks`

### 8. Install Dependencies

**Backend:**
```bash
npm install stripe
```

**Frontend:**
Already included in package.json (Stripe.js loaded via CDN)

### 9. Verify Implementation

- [ ] Check `src/pages/Onboarding/Step7_SubscriptionPlan.js` exists
- [ ] Check `backend/src/routes/billing.js` exists
- [ ] Check `backend/src/routes/index.js` has billing routes mounted
- [ ] Check `backend/src/routes/auth.js` updated (step 7)

### 10. Test Locally

**Start backend:**
```bash
cd backend
npm start
```

**Start frontend:**
```bash
npm start
```

**Test Stripe Webhook (optional):**
```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

### 11. Test Onboarding Flow

- [ ] Sign up with test account
- [ ] Complete steps 1-6 (role, profile, calendar)
- [ ] Reach Step 7 (Subscription)
- [ ] Click "Start 7-Day Free Trial"
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Verify checkout completes
- [ ] Check database for subscription record
- [ ] Verify webhook fires (check Stripe Dashboard)

### 12. Test Skip Option

- [ ] Sign up with another test account
- [ ] Complete steps 1-6
- [ ] Click "Skip for Now"
- [ ] Verify free trial created in database
- [ ] Check trial_ends_at is 7 days from now

### 13. Production Deployment

- [ ] Switch to live Stripe keys
- [ ] Update environment variables in production
- [ ] Update webhook URL to production backend
- [ ] Test with real payment method (small amount)
- [ ] Monitor Stripe Dashboard for transactions
- [ ] Set up email notifications for failed payments

### 14. Post-Launch Monitoring

- [ ] Monitor Stripe Dashboard daily
- [ ] Check webhook delivery status
- [ ] Monitor failed payments
- [ ] Set up Stripe alerts for:
  - [ ] Failed payments
  - [ ] Chargebacks
  - [ ] Webhook failures
- [ ] Review subscription metrics weekly

## Test Card Numbers

**Use these with test keys only:**

| Card | Number | Use Case |
|------|--------|----------|
| Visa | 4242 4242 4242 4242 | Successful payment |
| Visa | 4000 0000 0000 0002 | Payment declined |
| Visa | 4000 0025 0000 3155 | Requires 3D Secure |
| Visa | 4000 0000 0000 9995 | Insufficient funds |

**Expiry:** Any future date (e.g., 12/25)
**CVC:** Any 3 digits (e.g., 123)

## Troubleshooting

### Stripe.js Not Loading
- Check `REACT_APP_STRIPE_PUBLIC_KEY` is set
- Verify key starts with `pk_`
- Check browser console for errors

### Checkout Session Not Creating
- Verify `REACT_APP_STRIPE_PRICE_ID` is correct
- Check backend logs for errors
- Verify Stripe keys are correct in backend

### Webhook Not Firing
- Check webhook URL is accessible
- Verify signing secret matches
- Check Stripe Dashboard > Webhooks > Events
- Look for failed deliveries

### Database Tables Not Created
- Verify migration ran successfully
- Check Supabase SQL Editor for errors
- Verify RLS policies are enabled

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Support: https://support.stripe.com
- Advicly Docs: See `STRIPE_SUBSCRIPTION_ONBOARDING_IMPLEMENTATION.md`

## Next Steps After Setup

1. ✅ Complete all checklist items
2. ⏳ Test complete onboarding flow
3. ⏳ Deploy to staging environment
4. ⏳ Perform UAT (User Acceptance Testing)
5. ⏳ Deploy to production
6. ⏳ Monitor for issues
7. ⏳ Collect user feedback

