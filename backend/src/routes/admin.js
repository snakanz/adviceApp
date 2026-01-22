const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * Helper function to verify admin access
 * Requires ADMIN_API_KEY environment variable to be set
 * Returns true if authorized, false otherwise
 */
function verifyAdminAccess(req, res) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY;

  // SECURITY: Require ADMIN_API_KEY to be explicitly set - no default fallback
  if (!expectedKey) {
    console.error('❌ ADMIN_API_KEY environment variable not configured');
    res.status(503).json({ error: 'Admin API not configured - ADMIN_API_KEY environment variable required' });
    return false;
  }

  if (!adminKey || adminKey !== expectedKey) {
    console.warn('⚠️ Unauthorized admin access attempt');
    res.status(401).json({ error: 'Unauthorized - Invalid or missing admin key' });
    return false;
  }

  return true;
}

/**
 * POST /api/admin/update-subscription
 * Admin endpoint to manually update a subscription
 *
 * SECURITY: Requires x-admin-key header matching ADMIN_API_KEY env var
 */
router.post('/update-subscription', async (req, res) => {
  try {
    // Verify admin access first
    if (!verifyAdminAccess(req, res)) return;

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
 * SECURITY: Requires x-admin-key header matching ADMIN_API_KEY env var
 */
router.post('/cleanup-calendly-all-users', async (req, res) => {
  try {
    // Verify admin access - no default fallback key
    if (!verifyAdminAccess(req, res)) return;

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
 * SECURITY: Requires x-admin-key header matching ADMIN_API_KEY env var
 */
router.post('/wipe-all-data', async (req, res) => {
  try {
    // Verify admin access - no default fallback key
    if (!verifyAdminAccess(req, res)) return;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🧹 COMPLETE DATA WIPE - ALL USERS                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const results = {
      meetings_deleted: 0,
      clients_deleted: 0,
      transcript_action_items_deleted: 0,
      pending_transcript_action_items_deleted: 0,
      calendar_connections_deleted: 0,
      webhook_subscriptions_deleted: 0,
      webhook_events_deleted: 0,
      subscriptions_deleted: 0,
      tenants_deleted: 0,
      users_deleted: 0,
      errors: []
    };

    const supabase = getSupabase();

    // Use raw SQL for reliable deletion
    try {
      // Step 1: Delete all meetings
      console.log('1️⃣ Deleting all meetings...');
      const { data: meetingsData, error: meetingsError } = await supabase.rpc('exec_sql', {
        sql: 'DELETE FROM meetings; SELECT COUNT(*) as count FROM meetings;'
      }).catch(() => null);

      // Fallback: Try direct delete
      const { count: meetingsCount } = await supabase
        .from('meetings')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.meetings_deleted = meetingsCount || 0;
      console.log(`✅ Deleted ${results.meetings_deleted} meetings`);
    } catch (error) {
      console.error('❌ Error deleting meetings:', error.message);
      results.errors.push(`Meetings: ${error.message}`);
    }

    // Step 2: Delete all clients
    console.log('2️⃣ Deleting all clients...');
    try {
      const { count: clientsCount } = await supabase
        .from('clients')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.clients_deleted = clientsCount || 0;
      console.log(`✅ Deleted ${results.clients_deleted} clients`);
    } catch (error) {
      console.error('❌ Error deleting clients:', error.message);
      results.errors.push(`Clients: ${error.message}`);
    }

    // Step 3: Delete all transcript action items
    console.log('3️⃣ Deleting all transcript action items...');
    try {
      const { count: actionItemsCount } = await supabase
        .from('transcript_action_items')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.transcript_action_items_deleted = actionItemsCount || 0;
      console.log(`✅ Deleted ${results.transcript_action_items_deleted} transcript action items`);
    } catch (error) {
      console.error('❌ Error deleting transcript action items:', error.message);
      results.errors.push(`Transcript Action Items: ${error.message}`);
    }

    // Step 4: Delete all pending transcript action items
    console.log('4️⃣ Deleting all pending transcript action items...');
    try {
      const { count: pendingCount } = await supabase
        .from('pending_transcript_action_items')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.pending_transcript_action_items_deleted = pendingCount || 0;
      console.log(`✅ Deleted ${results.pending_transcript_action_items_deleted} pending action items`);
    } catch (error) {
      console.error('❌ Error deleting pending action items:', error.message);
      results.errors.push(`Pending Action Items: ${error.message}`);
    }

    // Step 5: Delete all calendar connections
    console.log('5️⃣ Deleting all calendar connections...');
    try {
      const { count: connectionsCount } = await supabase
        .from('calendar_connections')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.calendar_connections_deleted = connectionsCount || 0;
      console.log(`✅ Deleted ${results.calendar_connections_deleted} calendar connections`);
    } catch (error) {
      console.error('❌ Error deleting calendar connections:', error.message);
      results.errors.push(`Calendar Connections: ${error.message}`);
    }

    // Step 6: Delete all webhook subscriptions
    console.log('6️⃣ Deleting all webhook subscriptions...');
    try {
      const { count: webhookSubsCount } = await supabase
        .from('calendly_webhook_subscriptions')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.webhook_subscriptions_deleted = webhookSubsCount || 0;
      console.log(`✅ Deleted ${results.webhook_subscriptions_deleted} webhook subscriptions`);
    } catch (error) {
      console.error('❌ Error deleting webhook subscriptions:', error.message);
      results.errors.push(`Webhook Subscriptions: ${error.message}`);
    }

    // Step 7: Delete all webhook events
    console.log('7️⃣ Deleting all webhook events...');
    try {
      const { count: webhookEventsCount } = await supabase
        .from('calendly_webhook_events')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.webhook_events_deleted = webhookEventsCount || 0;
      console.log(`✅ Deleted ${results.webhook_events_deleted} webhook events`);
    } catch (error) {
      console.error('❌ Error deleting webhook events:', error.message);
      results.errors.push(`Webhook Events: ${error.message}`);
    }

    // Step 8: Delete all subscriptions
    console.log('8️⃣ Deleting all subscriptions...');
    try {
      const { count: subsCount } = await supabase
        .from('subscriptions')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.subscriptions_deleted = subsCount || 0;
      console.log(`✅ Deleted ${results.subscriptions_deleted} subscriptions`);
    } catch (error) {
      console.error('❌ Error deleting subscriptions:', error.message);
      results.errors.push(`Subscriptions: ${error.message}`);
    }

    // Step 9: Delete all tenants
    console.log('9️⃣ Deleting all tenants...');
    try {
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.tenants_deleted = tenantsCount || 0;
      console.log(`✅ Deleted ${results.tenants_deleted} tenants`);
    } catch (error) {
      console.error('❌ Error deleting tenants:', error.message);
      results.errors.push(`Tenants: ${error.message}`);
    }

    // Step 10: Delete all users (from custom users table)
    console.log('🔟 Deleting all users from custom users table...');
    try {
      const { count: usersCount } = await supabase
        .from('users')
        .delete()
        .gte('id', 0)
        .select('id', { count: 'exact' });

      results.users_deleted = usersCount || 0;
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

