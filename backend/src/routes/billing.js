const express = require('express');
const router = express.Router();

// Enhanced Stripe initialization with error logging
let stripe;
try {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  console.log('=== STRIPE INITIALIZATION ===');
  console.log('STRIPE_SECRET_KEY exists:', !!secretKey);
  console.log('STRIPE_SECRET_KEY prefix:', secretKey ? secretKey.substring(0, 7) : 'MISSING');
  console.log('STRIPE_SECRET_KEY length:', secretKey ? secretKey.length : 0);

  if (!secretKey) {
    console.error('ERROR: STRIPE_SECRET_KEY is not set in environment variables!');
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    console.error('ERROR: STRIPE_SECRET_KEY has invalid format!');
    throw new Error('STRIPE_SECRET_KEY has invalid format');
  }

  stripe = require('stripe')(secretKey);
  console.log('Stripe initialized successfully');
} catch (error) {
  console.error('FATAL: Failed to initialize Stripe:', error.message);
  console.error('Stack:', error.stack);
  // Don't throw here - let the routes handle it
}

const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * POST /api/billing/checkout
 * Create a Stripe checkout session for subscription
 */
router.post('/checkout', authenticateSupabaseUser, async (req, res) => {
  console.log('=== CHECKOUT REQUEST RECEIVED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('User ID:', req.user?.id);
  console.log('User Email:', req.user?.email);
  console.log('Request body:', req.body);

  try {
    // Check if Stripe is initialized
    if (!stripe) {
      console.error('ERROR: Stripe is not initialized!');
      return res.status(500).json({
        error: 'Payment system is not configured. Stripe initialization failed.',
        details: 'STRIPE_SECRET_KEY may be missing or invalid'
      });
    }

    const { priceId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log('Extracted data:', { priceId, userId, userEmail });

    if (!priceId) {
      console.error('ERROR: Missing priceId in request');
      return res.status(400).json({ error: 'Price ID is required' });
    }

    if (!isSupabaseAvailable()) {
      console.error('ERROR: Supabase is not available');
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    console.log('Checking for existing Stripe customer...');

    // Get or create Stripe customer
    let stripeCustomerId;
    const { data: existingCustomer } = await getSupabase()
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (existingCustomer) {
      console.log('Found existing Stripe customer:', existingCustomer.stripe_customer_id);
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      console.log('Creating new Stripe customer...');
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId }
      });

      stripeCustomerId = customer.id;
      console.log('Created Stripe customer:', stripeCustomerId);

      // Save to database
      await getSupabase()
        .from('stripe_customers')
        .insert({
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          email: userEmail
        });
      console.log('Saved customer to database');
    }

    // Create checkout session
    console.log('Creating checkout session with:', {
      customer: stripeCustomerId,
      priceId,
      mode: 'subscription',
      frontendUrl: process.env.FRONTEND_URL
    });

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/onboarding?step=complete&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/onboarding?step=subscription`,
      billing_address_collection: 'required',
      payment_method_types: ['card']
      // Note: 3D Secure is automatically handled by Stripe Checkout when required
    });

    console.log(`✅ Checkout session created successfully!`);
    console.log('Session ID:', session.id);
    console.log('Session URL:', session.url);

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('=== CHECKOUT ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);

    // Send detailed error response
    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

/**
 * POST /api/billing/create-trial
 * Create a free trial subscription without payment (5 free meetings model)
 */
router.post('/create-trial', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Create free tier subscription (5 free meetings)
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: 'free',
        status: 'active',
        free_meetings_limit: 5,
        free_meetings_used: 0,
        current_period_start: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating free subscription:', error);
      return res.status(500).json({ error: 'Failed to create free subscription' });
    }

    console.log(`✅ Free tier created for user ${userId} with 5 free meetings`);

    res.json({
      success: true,
      message: 'Free tier created successfully (5 free meetings)',
      subscription: data
    });
  } catch (error) {
    console.error('Error in create-trial:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/meeting-stats
 * Get meeting usage statistics for free tier users
 */
router.get('/meeting-stats', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get subscription
    const { data: subscription } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if user has active paid subscription
    const isPaid = subscription &&
                   (subscription.status === 'active' || subscription.status === 'trialing') &&
                   subscription.plan !== 'free';

    if (isPaid) {
      return res.json({
        transcribed: 'unlimited',
        remaining: 'unlimited',
        hasAccess: true,
        isPaid: true,
        plan: subscription.plan,
        status: subscription.status
      });
    }

    // Count meetings with successful Recall bot transcription
    const { count } = await getSupabase()
      .from('meetings')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .not('recall_bot_id', 'is', null)
      .in('recall_status', ['completed', 'done']);

    const transcribed = count || 0;
    const freeLimit = subscription?.free_meetings_limit || 5;
    const remaining = Math.max(0, freeLimit - transcribed);
    const hasAccess = transcribed < freeLimit;

    // Update free_meetings_used in subscription if it's out of sync
    if (subscription && subscription.free_meetings_used !== transcribed) {
      await getSupabase()
        .from('subscriptions')
        .update({ free_meetings_used: transcribed })
        .eq('user_id', userId);
    }

    res.json({
      transcribed,
      remaining,
      hasAccess,
      isPaid: false,
      freeLimit,
      plan: subscription?.plan || 'free',
      status: subscription?.status || 'active'
    });

  } catch (error) {
    console.error('Error fetching meeting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/billing/subscription
 * Get current subscription status
 */
router.get('/subscription', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: subscription, error } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // No subscription found - return free tier
      return res.json({ plan: 'free', status: 'active' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle subscription changes
 */
async function handleSubscriptionChange(subscription) {
  const { customer, id, status, items, trial_end } = subscription;
  const plan = items.data[0].price.lookup_key || 'pro';

  try {
    // Get user from Stripe customer
    const { data: stripeCustomer } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .single();

    if (!stripeCustomer) {
      console.warn(`No user found for Stripe customer ${customer}`);
      return;
    }

    // Update subscription
    await getSupabase()
      .from('subscriptions')
      .upsert({
        user_id: stripeCustomer.user_id,
        stripe_subscription_id: id,
        plan,
        status,
        trial_ends_at: trial_end ? new Date(trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        updated_at: new Date()
      });

    console.log(`✅ Subscription ${id} updated to plan: ${plan}, status: ${status}`);
  } catch (error) {
    console.error('Error handling subscription change:', error);
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription) {
  try {
    const { customer, id } = subscription;

    const { data: stripeCustomer } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .single();

    if (!stripeCustomer) return;

    await getSupabase()
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date() })
      .eq('stripe_subscription_id', id);

    console.log(`✅ Subscription ${id} cancelled`);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

/**
 * Handle payment success
 */
async function handlePaymentSucceeded(invoice) {
  console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
}

/**
 * Handle payment failure
 */
async function handlePaymentFailed(invoice) {
  console.log(`⚠️ Payment failed for invoice ${invoice.id}`);
}

module.exports = router;

