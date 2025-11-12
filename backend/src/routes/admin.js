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

/**
 * POST /api/admin/wipe-all-data
 * ADMIN ENDPOINT: Complete data wipe for ALL users
 * This is a DESTRUCTIVE operation that deletes:
 * - All meetings
 * - All clients
 * - All action items
 * - All calendar connections
 * - All webhooks
 * - All subscriptions
 * - All tenants
 * - All users (from custom users table, NOT auth.users)
 *
 * SECURITY: This is extremely destructive - should be properly secured in production
 */
router.post('/wipe-all-data', async (req, res) => {
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

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🧹 COMPLETE DATA WIPE - ALL USERS                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const results = {
      meetings_deleted: 0,
      clients_deleted: 0,
      action_items_deleted: 0,
      calendar_connections_deleted: 0,
      webhook_subscriptions_deleted: 0,
      webhook_events_deleted: 0,
      subscriptions_deleted: 0,
      tenants_deleted: 0,
      users_deleted: 0,
      errors: []
    };

    const supabase = getSupabase();

    // Step 1: Delete all meetings
    console.log('1️⃣ Deleting all meetings...');
    try {
      const { data: deletedMeetings, error: meetingsError } = await supabase
        .from('meetings')
        .delete()
        .gt('id', 0)
        .select();

      if (meetingsError) throw meetingsError;
      results.meetings_deleted = deletedMeetings?.length || 0;
      console.log(`✅ Deleted ${results.meetings_deleted} meetings`);
    } catch (error) {
      console.error('❌ Error deleting meetings:', error.message);
      results.errors.push(`Meetings: ${error.message}`);
    }

    // Step 2: Delete all action items
    console.log('2️⃣ Deleting all action items...');
    try {
      const { data: deletedActionItems, error: actionItemsError } = await supabase
        .from('action_items')
        .delete()
        .gt('id', 0)
        .select();

      if (actionItemsError) throw actionItemsError;
      results.action_items_deleted = deletedActionItems?.length || 0;
      console.log(`✅ Deleted ${results.action_items_deleted} action items`);
    } catch (error) {
      console.error('❌ Error deleting action items:', error.message);
      results.errors.push(`Action Items: ${error.message}`);
    }

    // Step 3: Delete all clients
    console.log('3️⃣ Deleting all clients...');
    try {
      const { data: deletedClients, error: clientsError } = await supabase
        .from('clients')
        .delete()
        .not('id', 'is', null)
        .select();

      if (clientsError) throw clientsError;
      results.clients_deleted = deletedClients?.length || 0;
      console.log(`✅ Deleted ${results.clients_deleted} clients`);
    } catch (error) {
      console.error('❌ Error deleting clients:', error.message);
      results.errors.push(`Clients: ${error.message}`);
    }

    // Step 4: Delete all calendar connections
    console.log('4️⃣ Deleting all calendar connections...');
    try {
      const { data: deletedConnections, error: connectionsError } = await supabase
        .from('calendar_connections')
        .delete()
        .not('id', 'is', null)
        .select();

      if (connectionsError) throw connectionsError;
      results.calendar_connections_deleted = deletedConnections?.length || 0;
      console.log(`✅ Deleted ${results.calendar_connections_deleted} calendar connections`);
    } catch (error) {
      console.error('❌ Error deleting calendar connections:', error.message);
      results.errors.push(`Calendar Connections: ${error.message}`);
    }

    // Step 5: Delete all webhook subscriptions
    console.log('5️⃣ Deleting all webhook subscriptions...');
    try {
      const { data: deletedSubscriptions, error: subscriptionsError } = await supabase
        .from('calendly_webhook_subscriptions')
        .delete()
        .not('id', 'is', null)
        .select();

      if (subscriptionsError) throw subscriptionsError;
      results.webhook_subscriptions_deleted = deletedSubscriptions?.length || 0;
      console.log(`✅ Deleted ${results.webhook_subscriptions_deleted} webhook subscriptions`);
    } catch (error) {
      console.error('❌ Error deleting webhook subscriptions:', error.message);
      results.errors.push(`Webhook Subscriptions: ${error.message}`);
    }

    // Step 6: Delete all webhook events
    console.log('6️⃣ Deleting all webhook events...');
    try {
      const { data: deletedEvents, error: eventsError } = await supabase
        .from('calendly_webhook_events')
        .delete()
        .not('id', 'is', null)
        .select();

      if (eventsError) throw eventsError;
      results.webhook_events_deleted = deletedEvents?.length || 0;
      console.log(`✅ Deleted ${results.webhook_events_deleted} webhook events`);
    } catch (error) {
      console.error('❌ Error deleting webhook events:', error.message);
      results.errors.push(`Webhook Events: ${error.message}`);
    }

    // Step 7: Delete all subscriptions
    console.log('7️⃣ Deleting all subscriptions...');
    try {
      const { data: deletedSubs, error: subsError } = await supabase
        .from('subscriptions')
        .delete()
        .not('id', 'is', null)
        .select();

      if (subsError) throw subsError;
      results.subscriptions_deleted = deletedSubs?.length || 0;
      console.log(`✅ Deleted ${results.subscriptions_deleted} subscriptions`);
    } catch (error) {
      console.error('❌ Error deleting subscriptions:', error.message);
      results.errors.push(`Subscriptions: ${error.message}`);
    }

    // Step 8: Delete all tenants
    console.log('8️⃣ Deleting all tenants...');
    try {
      const { data: deletedTenants, error: tenantsError } = await supabase
        .from('tenants')
        .delete()
        .not('id', 'is', null)
        .select();

      if (tenantsError) throw tenantsError;
      results.tenants_deleted = deletedTenants?.length || 0;
      console.log(`✅ Deleted ${results.tenants_deleted} tenants`);
    } catch (error) {
      console.error('❌ Error deleting tenants:', error.message);
      results.errors.push(`Tenants: ${error.message}`);
    }

    // Step 9: Delete all users (from custom users table)
    console.log('9️⃣ Deleting all users from custom users table...');
    try {
      const { data: deletedUsers, error: usersError } = await supabase
        .from('users')
        .delete()
        .not('id', 'is', null)
        .select();

      if (usersError) throw usersError;
      results.users_deleted = deletedUsers?.length || 0;
      console.log(`✅ Deleted ${results.users_deleted} users from custom table`);
    } catch (error) {
      console.error('❌ Error deleting users:', error.message);
      results.errors.push(`Users: ${error.message}`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         ✅ DATA WIPE COMPLETE                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    res.json({
      success: true,
      message: 'Complete data wipe successful',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in wipe-all-data:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

