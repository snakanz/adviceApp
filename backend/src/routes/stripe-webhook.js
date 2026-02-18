const express = require('express');
const router = express.Router();

// Initialize Stripe
let stripe;
try {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  stripe = require('stripe')(secretKey);
  console.log('✅ Stripe initialized for webhook handler');
} catch (error) {
  console.error('❌ Failed to initialize Stripe for webhooks:', error.message);
}

const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint - receives raw body for signature verification
 * 
 * IMPORTANT: This route MUST be mounted BEFORE express.json() middleware
 * to ensure the raw body is available for signature verification.
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!stripe) {
    console.error('❌ Stripe is not initialized');
    return res.status(500).json({ error: 'Stripe not initialized' });
  }

  let event;

  try {
    // Verify webhook signature using raw body
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ Webhook signature verified: ${event.type}`);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log(`📥 Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

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

      default:
        console.log(`ℹ️  Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle checkout session completed
 * This is the first event after successful payment
 */
async function handleCheckoutCompleted(session) {
  try {
    console.log(`🎉 Checkout completed for session ${session.id}`);

    const { customer, subscription: subscriptionId } = session;

    if (!subscriptionId) {
      console.warn('⚠️  No subscription ID in checkout session');
      return;
    }

    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase is not available');
      return;
    }

    // Get user from Stripe customer
    const { data: stripeCustomer, error: customerError } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .single();

    if (customerError || !stripeCustomer) {
      console.warn(`⚠️  No user found for Stripe customer ${customer}:`, customerError?.message);
      return;
    }

    // Fetch the full subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const plan = subscription.items.data[0].price.lookup_key || 'professional';

    // Update subscription in database
    const { error: upsertError } = await getSupabase()
      .from('subscriptions')
      .upsert({
        user_id: stripeCustomer.user_id,
        stripe_subscription_id: subscriptionId,
        plan,
        status: subscription.status,
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        updated_at: new Date()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('❌ Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log(`✅ Subscription ${subscriptionId} created for user ${stripeCustomer.user_id} - plan: ${plan}, status: ${subscription.status}`);
  } catch (error) {
    console.error('❌ Error handling checkout completion:', error);
    throw error;
  }
}

/**
 * Handle subscription changes
 */
async function handleSubscriptionChange(subscription) {
  const { customer, id, status, items, trial_end, current_period_start, current_period_end } = subscription;
  const plan = items.data[0].price.lookup_key || 'professional';

  try {
    console.log(`🔄 Subscription ${status}: ${id} - plan: ${plan}`);

    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase is not available');
      return;
    }

    // Get user from Stripe customer
    const { data: stripeCustomer, error: customerError } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .single();

    if (customerError || !stripeCustomer) {
      console.warn(`⚠️  No user found for Stripe customer ${customer}:`, customerError?.message);
      return;
    }

    // Update subscription
    const { error: updateError } = await getSupabase()
      .from('subscriptions')
      .upsert({
        user_id: stripeCustomer.user_id,
        stripe_subscription_id: id,
        plan,
        status,
        trial_ends_at: trial_end ? new Date(trial_end * 1000).toISOString() : null,
        current_period_start: new Date(current_period_start * 1000),
        current_period_end: new Date(current_period_end * 1000),
        updated_at: new Date()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
      throw updateError;
    }

    console.log(`✅ Subscription updated for user ${stripeCustomer.user_id}`);
  } catch (error) {
    console.error('❌ Error handling subscription change:', error);
    throw error;
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription) {
  const { customer, id } = subscription;

  try {
    console.log(`❌ Subscription cancelled: ${id}`);

    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase is not available');
      return;
    }

    // Get user from Stripe customer
    const { data: stripeCustomer, error: customerError } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .single();

    if (customerError || !stripeCustomer) {
      console.warn(`⚠️  No user found for Stripe customer ${customer}:`, customerError?.message);
      return;
    }

    // Update subscription status to cancelled
    const { error: updateError } = await getSupabase()
      .from('subscriptions')
      .update({
        status: 'cancelled',
        plan: 'free',
        stripe_subscription_id: null,
        updated_at: new Date()
      })
      .eq('user_id', stripeCustomer.user_id);

    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
      throw updateError;
    }

    console.log(`✅ Subscription cancelled for user ${stripeCustomer.user_id}`);
  } catch (error) {
    console.error('❌ Error handling subscription cancellation:', error);
    throw error;
  }
}

/**
 * Handle successful payment
 * Sends Meta CAPI Purchase event on first real payment (trial → paid conversion)
 */
async function handlePaymentSucceeded(invoice) {
  console.log(`💰 Payment succeeded for invoice ${invoice.id}`);

  try {
    // Only fire for subscription invoices
    if (!invoice.subscription) return;

    // Skip $0 invoices (trial period)
    if (invoice.amount_paid === 0) {
      console.log('ℹ️  Skipping $0 invoice (trial period)');
      return;
    }

    if (!isSupabaseAvailable()) return;

    // Look up user via stripe_customers
    const { data: stripeCustomer } = await getSupabase()
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (!stripeCustomer) return;

    // Get user data and check deduplication flag
    const { data: userData } = await getSupabase()
      .from('users')
      .select('email, fbc, meta_purchase_sent, onboarding_client_ip, onboarding_client_user_agent')
      .eq('id', stripeCustomer.user_id)
      .single();

    if (!userData || userData.meta_purchase_sent) {
      if (userData?.meta_purchase_sent) {
        console.log('ℹ️  Purchase event already sent for this user — skipping');
      }
      return;
    }

    // Send Purchase event to Meta CAPI
    const { sendPurchase } = require('../services/metaConversionsApi');
    const amountInPounds = invoice.amount_paid / 100; // Stripe amounts are in pence
    await sendPurchase({
      email: userData.email,
      fbc: userData.fbc,
      clientIp: userData.onboarding_client_ip,
      clientUserAgent: userData.onboarding_client_user_agent,
      value: amountInPounds,
      currency: (invoice.currency || 'gbp').toUpperCase()
    });

    // Mark as sent to prevent duplicate events on renewals
    await getSupabase()
      .from('users')
      .update({ meta_purchase_sent: true })
      .eq('id', stripeCustomer.user_id);

  } catch (metaError) {
    console.error('⚠️  Meta CAPI Purchase failed (non-fatal):', metaError.message);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  console.log(`⚠️  Payment failed for invoice ${invoice.id}`);
  // Additional logic can be added here (e.g., send notification to user)
}

module.exports = router;

