const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * POST /api/admin/update-subscription
 * Temporary admin endpoint to manually update a subscription
 * 
 * SECURITY: This should be removed or properly secured in production
 */
router.post('/update-subscription', async (req, res) => {
  try {
    const { userId, plan, status } = req.body;
    
    if (!userId || !plan) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and plan are required' 
      });
    }
    
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }
    
    console.log(`🔄 Admin: Updating subscription for user ${userId} to plan: ${plan}`);
    
    // Update subscription
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .update({
        plan,
        status: status || 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('❌ Error updating subscription:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Subscription updated successfully');
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return res.status(500).json({ error: verifyError.message });
    }
    
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: verifyData
    });
    
  } catch (error) {
    console.error('❌ Error in update-subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cleanup-calendly-all-users
 * ADMIN ENDPOINT: Clean up all Calendly data for ALL users
 * This removes all Calendly connections, meetings, and webhook subscriptions
 *
 * SECURITY: This is a destructive operation - should be properly secured in production
 */
router.post('/cleanup-calendly-all-users', async (req, res) => {
  try {
    // Simple security check - in production, use proper authentication
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_API_KEY || 'admin-cleanup-key';
    if (adminKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    console.log('🧹 Starting Calendly cleanup for ALL users...');

    const results = {
      meetings_deleted: 0,
      webhook_events_deleted: 0,
      webhook_subscriptions_deleted: 0,
      connections_deleted: 0
    };

    const supabase = getSupabase();

    // Step 1: Delete all Calendly meetings
    console.log('1️⃣ Deleting all Calendly meetings...');
    const { data: deletedMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .delete()
      .eq('meeting_source', 'calendly')
      .select();

    if (meetingsError) {
      console.error('❌ Error deleting meetings:', meetingsError);
    } else {
      results.meetings_deleted = deletedMeetings?.length || 0;
      console.log(`✅ Deleted ${results.meetings_deleted} Calendly meetings`);
    }

    // Step 2: Delete all webhook events
    console.log('2️⃣ Deleting all webhook events...');
    const { data: deletedEvents, error: eventsError } = await supabase
      .from('calendly_webhook_events')
      .delete()
      .select();

    if (eventsError) {
      console.error('❌ Error deleting webhook events:', eventsError);
    } else {
      results.webhook_events_deleted = deletedEvents?.length || 0;
      console.log(`✅ Deleted ${results.webhook_events_deleted} webhook events`);
    }

    // Step 3: Delete all webhook subscriptions
    console.log('3️⃣ Deleting all webhook subscriptions...');
    const { data: deletedSubscriptions, error: subscriptionsError } = await supabase
      .from('calendly_webhook_subscriptions')
      .delete()
      .select();

    if (subscriptionsError) {
      console.error('❌ Error deleting webhook subscriptions:', subscriptionsError);
    } else {
      results.webhook_subscriptions_deleted = deletedSubscriptions?.length || 0;
      console.log(`✅ Deleted ${results.webhook_subscriptions_deleted} webhook subscriptions`);
    }

    // Step 4: Delete all Calendly calendar connections
    console.log('4️⃣ Deleting all Calendly calendar connections...');
    const { data: deletedConnections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('provider', 'calendly')
      .select();

    if (connectionsError) {
      console.error('❌ Error deleting connections:', connectionsError);
    } else {
      results.connections_deleted = deletedConnections?.length || 0;
      console.log(`✅ Deleted ${results.connections_deleted} calendar connections`);
    }

    console.log('✅ Calendly cleanup complete for ALL users');

    res.json({
      success: true,
      message: 'Calendly data cleaned up successfully for all users',
      results
    });

  } catch (error) {
    console.error('❌ Error in cleanup-calendly-all-users:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

