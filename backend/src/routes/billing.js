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

    const { priceId, successUrl } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log('Extracted data:', { priceId, successUrl, userId, userEmail });

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
    // Determine success URL based on context:
    // - If successUrl provided (e.g., '/meetings'), user is upgrading from dashboard
    // - Otherwise, user is in onboarding flow
    const finalSuccessUrl = successUrl
      ? `${process.env.FRONTEND_URL}${successUrl}?upgraded=true&session_id={CHECKOUT_SESSION_ID}`
      : `${process.env.FRONTEND_URL}/onboarding?step=complete&plan=paid&session_id={CHECKOUT_SESSION_ID}`;

    const finalCancelUrl = successUrl
      ? `${process.env.FRONTEND_URL}${successUrl}` // Return to dashboard if upgrading
      : `${process.env.FRONTEND_URL}/onboarding?step=subscription`; // Return to onboarding if new user

    console.log('Creating checkout session with:', {
      customer: stripeCustomerId,
      priceId,
      mode: 'subscription',
      frontendUrl: process.env.FRONTEND_URL,
      successUrl: finalSuccessUrl,
      cancelUrl: finalCancelUrl
    });

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      allow_promotion_codes: true // Enable promo code field at checkout
      // Note: 3D Secure is automatically handled by Stripe Checkout when required
    });

    console.log(`✅ Checkout session created successfully!`);
    console.log('Session ID:', session.id);
    console.log('Session URL:', session.url);

    // Return both sessionId and url for direct redirect (avoids ad blocker issues)
    res.json({
      sessionId: session.id,
      url: session.url
    });
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

    // First, ensure user exists in users table (required for foreign key constraint)
    const { data: existingUser, error: userCheckError } = await getSupabase()
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist - create them first
      console.log('⚠️ User not found in users table for subscription, creating:', userId);

      try {
        const UserService = require('../services/userService');
        await UserService.getOrCreateUser({
          id: req.user.id,
          email: req.user.email,
          user_metadata: {
            full_name: req.user.name || req.user.email.split('@')[0]
          },
          app_metadata: {
            provider: req.user.provider || 'email'
          }
        });
        console.log('✅ Created user record before subscription');
      } catch (createError) {
        console.error('❌ Error creating user for subscription:', createError);
        return res.status(500).json({
          error: 'Failed to create user record',
          details: createError.message
        });
      }
    }

    // Check if user already has a subscription
    const { data: existingSubscription, error: checkError } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // Real error (not "not found")
      console.error('Error checking existing subscription:', checkError);
      return res.status(500).json({ error: 'Failed to check existing subscription' });
    }

    if (existingSubscription) {
      // User already has a subscription - return it
      console.log(`✅ User ${userId} already has subscription: ${existingSubscription.plan}`);
      return res.json({
        success: true,
        message: 'Subscription already exists',
        subscription: existingSubscription
      });
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
      return res.status(500).json({ error: 'Failed to create free subscription', details: error.message });
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

    // Count meetings with SUCCESSFUL Recall bot transcription (fair counting)
    // Only count meetings where user got actual value:
    // 1. Has recall_bot_id and completed status
    // 2. Has meaningful transcript content (100+ chars)
    // 3. Was NOT a waiting room timeout or no-participant failure
    const { data: transcribedMeetings } = await getSupabase()
      .from('meetings')
      .select('id, transcript, recall_error')
      .eq('user_id', userId)
      .not('recall_bot_id', 'is', null)
      .in('recall_status', ['completed', 'done']);

    // Filter to only count meetings with meaningful transcripts
    const fairCount = (transcribedMeetings || []).filter(meeting => {
      const transcriptLength = meeting.transcript?.length || 0;
      const recallError = meeting.recall_error?.toLowerCase() || '';

      // Must have meaningful transcript (100+ chars)
      if (transcriptLength < 100) return false;

      // Exclude waiting room timeouts and no-participant failures
      if (recallError.includes('waiting_room')) return false;
      if (recallError.includes('no_participant')) return false;
      if (recallError.includes('empty_call')) return false;

      return true;
    }).length;

    const transcribed = fairCount;
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
 * GET /api/billing/subscription-details
 * Get detailed subscription info from Stripe (amount, next billing date, etc.)
 */
router.get('/subscription-details', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!stripe) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get subscription from database
    const { data: subscription } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no subscription or free plan, return basic info
    if (!subscription || subscription.plan === 'free') {
      return res.json({
        isPaid: false,
        plan: 'free',
        status: 'active'
      });
    }

    // Get Stripe subscription details if we have a subscription ID
    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
          { expand: ['items.data.price.product', 'default_payment_method'] }
        );

        const priceItem = stripeSubscription.items.data[0];
        const price = priceItem?.price;
        const product = price?.product;

        // Format amount (Stripe amounts are in pence/cents)
        const amount = price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : null;
        const currency = price?.currency?.toUpperCase() || 'GBP';
        const interval = price?.recurring?.interval || 'month';

        // Get next billing date
        const nextBillingDate = stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : null;

        // Check if subscription is set to cancel at period end
        const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

        return res.json({
          isPaid: true,
          plan: subscription.plan || 'professional',
          status: stripeSubscription.status,
          amount: amount,
          currency: currency,
          interval: interval,
          productName: typeof product === 'object' ? product.name : 'Professional Plan',
          nextBillingDate: nextBillingDate,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: cancelAtPeriodEnd,
          stripeSubscriptionId: stripeSubscription.id
        });
      } catch (stripeError) {
        console.error('Error fetching Stripe subscription:', stripeError);
        // Fall back to database info if Stripe call fails
        return res.json({
          isPaid: true,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          error: 'Could not fetch latest billing details'
        });
      }
    }

    // No Stripe subscription ID, return database info
    res.json({
      isPaid: subscription.plan !== 'free',
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    });

  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/customer-portal
 * Create a Stripe Customer Portal session for managing subscription
 */
router.post('/customer-portal', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { returnUrl } = req.body;

    if (!stripe) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get Stripe customer ID
    const { data: customer } = await getSupabase()
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (!customer?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/settings?section=billing`
    });

    console.log(`✅ Customer portal session created for user ${userId}`);

    res.json({ url: portalSession.url });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * NOTE: Stripe webhook handler has been moved to a separate file
 * (routes/stripe-webhook.js) and is mounted BEFORE express.json() middleware
 * in index.js to ensure raw body is available for signature verification.
 *
 * The webhook endpoint is now at: POST /api/billing/webhook
 * But it's handled by the stripe-webhook.js router, not this file.
 */

module.exports = router;

