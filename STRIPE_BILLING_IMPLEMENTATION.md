# 💳 STRIPE BILLING IMPLEMENTATION GUIDE

---

## 1. STRIPE SETUP

### Step 1: Create Stripe Account
1. Go to stripe.com
2. Sign up for business account
3. Get API keys from Dashboard → Developers → API Keys
4. Copy `Secret Key` and `Publishable Key`

### Step 2: Create Pricing Plans
In Stripe Dashboard:
1. Go to Products
2. Create products:
   - Starter ($29/month)
   - Professional ($99/month)
   - Enterprise (custom)
3. Copy Price IDs to `.env`

---

## 2. BACKEND IMPLEMENTATION

```javascript
// backend/src/routes/billing.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { getSupabase } = require('../lib/supabase');

/**
 * Create checkout session
 */
router.post('/checkout', authenticateSupabaseUser, async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Get or create Stripe customer
    let customer = await getOrCreateStripeCustomer(userId, userEmail);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      payment_method_options: {
        card: {
          three_d_secure: 'required' // ✅ Fraud prevention
        }
      }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get or create Stripe customer
 */
async function getOrCreateStripeCustomer(userId, email) {
  // Check if customer exists in database
  const { data: existing } = await getSupabase()
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (existing?.stripe_customer_id) {
    return { id: existing.stripe_customer_id };
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  });

  // Store in database
  await getSupabase()
    .from('stripe_customers')
    .insert({
      user_id: userId,
      stripe_customer_id: customer.id,
      email
    });

  return customer;
}

/**
 * Webhook handler (CRITICAL)
 */
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // ✅ CRITICAL: Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleChargeback(event.data.object);
        break;
    }

    res.json({received: true});
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle subscription changes
 */
async function handleSubscriptionChange(subscription) {
  const { customer, id, status, items } = subscription;
  const plan = items.data[0].price.lookup_key;

  // Get user from Stripe customer
  const { data: stripeCustomer } = await getSupabase()
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customer)
    .single();

  if (!stripeCustomer) return;

  // Update subscription
  await getSupabase()
    .from('subscriptions')
    .upsert({
      user_id: stripeCustomer.user_id,
      stripe_subscription_id: id,
      plan,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      updated_at: new Date()
    });

  console.log(`✅ Subscription ${id} updated to plan: ${plan}`);
}

/**
 * Handle payment failure
 */
async function handlePaymentFailed(invoice) {
  const { customer_email, subscription } = invoice;

  // Send dunning email
  await sendDunningEmail(customer_email, subscription);

  console.log(`⚠️ Payment failed for ${customer_email}`);
}

/**
 * Handle chargeback
 */
async function handleChargeback(charge) {
  const { customer, amount, reason } = charge;

  // Log chargeback
  await getSupabase()
    .from('chargebacks')
    .insert({
      stripe_customer_id: customer,
      amount,
      reason,
      created_at: new Date()
    });

  // Alert admin
  console.error(`🚨 CHARGEBACK: ${customer} - ${reason}`);
}

/**
 * Get subscription status
 */
router.get('/subscription', authenticateSupabaseUser, async (req, res) => {
  try {
    const { data: subscription } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    res.json(subscription || { plan: 'free', status: 'active' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel', authenticateSupabaseUser, async (req, res) => {
  try {
    const { data: subscription } = await getSupabase()
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', req.user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Cancel in Stripe
    await stripe.subscriptions.del(subscription.stripe_subscription_id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## 3. DATABASE SCHEMA

```sql
-- Stripe customers
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chargebacks
CREATE TABLE IF NOT EXISTS chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT,
  amount INTEGER,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  meeting_id SERIAL REFERENCES meetings(id) ON DELETE CASCADE,
  transcription_hours DECIMAL(10,2),
  cost_usd DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. FRONTEND IMPLEMENTATION

```javascript
// src/components/BillingCheckout.js
import { loadStripe } from '@stripe/js';

export function BillingCheckout({ priceId }) {
  const handleCheckout = async () => {
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    const { sessionId } = await response.json();
    const stripe = await loadStripe(process.env.REACT_APP_STRIPE_KEY);
    
    await stripe.redirectToCheckout({ sessionId });
  };

  return (
    <button onClick={handleCheckout} className="btn btn-primary">
      Upgrade Now
    </button>
  );
}
```

---

## 5. FEATURE GATING

```javascript
// src/hooks/useSubscription.js
export function useSubscription() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    fetch('/api/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setSubscription);
  }, []);

  const canUseFeature = (feature) => {
    const limits = {
      free: { meetings: 3, transcription_hours: 10 },
      starter: { meetings: 20, transcription_hours: 100 },
      professional: { meetings: 200, transcription_hours: 1000 },
      enterprise: { meetings: Infinity, transcription_hours: Infinity }
    };

    return subscription?.plan && limits[subscription.plan][feature];
  };

  return { subscription, canUseFeature };
}
```

---

## 6. TESTING

### Test Cards
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

### Test Webhook
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

---

## 7. SECURITY CHECKLIST

- [ ] Webhook signature verification
- [ ] 3D Secure enabled
- [ ] Idempotency keys used
- [ ] Rate limiting on endpoints
- [ ] HTTPS enforced
- [ ] Error handling for failed payments
- [ ] Chargeback monitoring
- [ ] Audit logging enabled
- [ ] PCI compliance verified

---

**Status:** Ready to implement ✅

