const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const CalendlyService = require('../services/calendlyService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

const router = express.Router();

console.log('🔄 Calendly routes loaded successfully');

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Test Calendly connection
router.get('/test-connection', authenticateUser, async (req, res) => {
  try {
    const calendlyService = new CalendlyService();
    const result = await calendlyService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing Calendly connection:', error);
    res.status(500).json({ 
      connected: false, 
      error: 'Failed to test connection',
      details: error.message 
    });
  }
});

// Get Calendly connection status
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const calendlyService = new CalendlyService();
    const isConfigured = calendlyService.isConfigured();

    if (!isConfigured) {
      return res.json({
        connected: false,
        configured: false,
        message: 'Calendly personal access token not configured'
      });
    }

    // Test the connection
    const connectionTest = await calendlyService.testConnection();

    return res.json({
      connected: connectionTest.connected,
      configured: true,
      user: connectionTest.user?.name || 'Unknown',
      message: connectionTest.connected ? 'Calendly integration working!' : connectionTest.error
    });

    // // Test the connection
    // const connectionTest = await calendlyService.testConnection();
    // res.json({
    //   connected: connectionTest.connected,
    //   configured: true,
    //   user: connectionTest.user || null,
    //   error: connectionTest.error || null
    // });
  } catch (error) {
    console.error('Error checking Calendly status:', error);
    res.status(500).json({
      connected: false,
      configured: false,
      error: 'Failed to check status',
      details: error.message
    });
  }
});

// Enhanced Calendly sync with comprehensive feedback
router.post('/sync', authenticateUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const calendlyService = new CalendlyService();
    const userId = req.user.id;

    console.log(`🔄 Starting enhanced Calendly sync for user ${userId}`);

    // Get sync status before sync
    const { data: beforeStatus } = await getSupabase()
      .rpc('get_calendly_sync_status', { user_id: userId });

    // Perform the sync
    const syncResult = await calendlyService.syncMeetingsToDatabase(userId);

    // Get sync status after sync
    const { data: afterStatus } = await getSupabase()
      .rpc('get_calendly_sync_status', { user_id: userId });

    // Calculate improvements
    const improvement = {
      meetings_added: syncResult.synced || 0,
      total_before: beforeStatus?.total_calendly_meetings || 0,
      total_after: afterStatus?.total_calendly_meetings || 0,
      sync_health_before: beforeStatus?.sync_health || 'unknown',
      sync_health_after: afterStatus?.sync_health || 'unknown'
    };

    console.log(`✅ Calendly sync completed:`, improvement);

    res.json({
      success: true,
      message: `Successfully synced ${syncResult.synced} Calendly meetings`,
      sync_result: syncResult,
      improvement,
      recommendations: generateSyncRecommendations(afterStatus)
    });
  } catch (error) {
    console.error('Error syncing Calendly meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync Calendly meetings',
      details: error.message,
      troubleshooting: {
        check_token: 'Verify CALENDLY_PERSONAL_ACCESS_TOKEN is set correctly',
        check_permissions: 'Ensure token has read access to scheduled events',
        check_network: 'Verify network connectivity to Calendly API'
      }
    });
  }
});

// Helper function to generate sync recommendations
function generateSyncRecommendations(syncStatus) {
  const recommendations = [];

  if (!syncStatus) {
    recommendations.push('Unable to assess sync status - check database connectivity');
    return recommendations;
  }

  if (syncStatus.total_calendly_meetings === 0) {
    recommendations.push('No Calendly meetings found - verify your Calendly account has scheduled events');
  }

  if (syncStatus.sync_health === 'critical') {
    recommendations.push('Critical sync issues detected - consider running a full resync');
  } else if (syncStatus.sync_health === 'warning') {
    recommendations.push('Some sync issues detected - monitor for recurring problems');
  }

  if (syncStatus.recent_calendly_meetings === 0) {
    recommendations.push('No recent Calendly meetings - this may be normal if you haven\'t had meetings recently');
  }

  if (recommendations.length === 0) {
    recommendations.push('Calendly sync is healthy - no action needed');
  }

  return recommendations;
}

// Get Calendly meetings for user
router.get('/meetings', authenticateUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', req.user.id)
      .eq('meeting_source', 'calendly')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false });

    if (error) {
      console.error('Error fetching Calendly meetings:', error);
      return res.status(500).json({ error: 'Failed to fetch Calendly meetings' });
    }

    // Format meetings for frontend compatibility
    const formattedMeetings = (meetings || []).map(meeting => ({
      id: meeting.googleeventid,
      title: meeting.title,
      starttime: meeting.starttime,
      endtime: meeting.endtime,
      summary: meeting.summary,
      attendees: meeting.attendees,
      meeting_source: meeting.meeting_source,
      calendly_event_uri: meeting.calendly_event_uri,
      client_email: meeting.client_email
    }));

    res.json(formattedMeetings);
  } catch (error) {
    console.error('Error fetching Calendly meetings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Calendly meetings',
      details: error.message 
    });
  }
});

// Debug endpoint to check specific client meetings
router.get('/debug/client/:email', authenticateUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const clientEmail = decodeURIComponent(req.params.email);
    console.log(`🔍 Debugging meetings for client: ${clientEmail}`);

    // Get all meetings for this client email
    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', req.user.id)
      .eq('meeting_source', 'calendly')
      .ilike('client_email', `%${clientEmail}%`)
      .order('starttime', { ascending: false });

    if (error) {
      console.error('Error fetching client meetings:', error);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    res.json({
      client_email: clientEmail,
      total_meetings: meetings?.length || 0,
      meetings: meetings?.map(m => ({
        id: m.id,
        title: m.title,
        starttime: m.starttime,
        endtime: m.endtime,
        is_deleted: m.is_deleted,
        sync_status: m.sync_status,
        googleeventid: m.googleeventid,
        calendly_event_uuid: m.calendly_event_uuid,
        client_email: m.client_email
      })) || []
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      error: 'Failed to debug client meetings',
      details: error.message
    });
  }
});

// Get integration statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: stats, error } = await getSupabase()
      .from('integration_status')
      .select('*')
      .eq('userid', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching integration stats:', error);
      return res.status(500).json({ error: 'Failed to fetch integration stats' });
    }

    res.json(stats || {
      userid: req.user.id,
      google_meetings: 0,
      calendly_meetings: 0,
      manual_meetings: 0,
      total_meetings: 0,
      last_sync: null
    });
  } catch (error) {
    console.error('Error fetching integration stats:', error);
    res.status(500).json({
      error: 'Failed to fetch integration stats',
      details: error.message
    });
  }
});

// Get automatic sync scheduler status
router.get('/scheduler/status', authenticateUser, async (req, res) => {
  try {
    const syncScheduler = require('../services/syncScheduler');
    const status = syncScheduler.getStatus();

    res.json({
      success: true,
      scheduler: status
    });
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduler status',
      details: error.message
    });
  }
});

// Manually trigger automatic sync (for testing or immediate needs)
router.post('/scheduler/trigger', authenticateUser, async (req, res) => {
  try {
    const syncScheduler = require('../services/syncScheduler');

    // Trigger sync in background (don't wait for completion)
    syncScheduler.triggerManualSync().catch(error => {
      console.error('Error in manual scheduler trigger:', error);
    });

    res.json({
      success: true,
      message: 'Automatic sync triggered in background'
    });
  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({
      error: 'Failed to trigger scheduler',
      details: error.message
    });
  }
});

// =====================================================
// WEBHOOK ENDPOINTS
// =====================================================

/**
 * Verify Calendly webhook signature
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['calendly-webhook-signature'];
  const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  if (!webhookSigningKey) {
    console.warn('⚠️  CALENDLY_WEBHOOK_SIGNING_KEY not configured - skipping signature verification');
    return true; // Allow in development if not configured
  }

  if (!signature) {
    console.error('❌ No webhook signature provided');
    return false;
  }

  try {
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSigningKey)
      .update(payload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('❌ Invalid webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Calendly Webhook Handler
 * Handles real-time updates from Calendly
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📥 Received Calendly webhook:', {
      event: req.body.event,
      created_at: req.body.created_at
    });

    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    if (!isSupabaseAvailable()) {
      console.error('❌ Database unavailable for webhook processing');
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const { event, payload } = req.body;

    switch (event) {
      case 'invitee.created':
        await handleInviteeCreated(payload);
        break;
      case 'invitee.canceled':
        await handleInviteeCanceled(payload);
        break;
      default:
        console.log(`⚠️  Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Error processing Calendly webhook:', error);
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Test endpoint for webhook setup
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    success: true,
    message: 'Calendly webhook endpoint is accessible',
    url: `${req.protocol}://${req.get('host')}/api/calendly/webhook`,
    instructions: [
      '1. Go to Calendly Integrations > Webhooks',
      '2. Create a new webhook subscription',
      '3. Set URL to the webhook URL above',
      '4. Subscribe to events: invitee.created, invitee.canceled',
      '5. Copy the signing key to CALENDLY_WEBHOOK_SIGNING_KEY env variable'
    ]
  });
});

// Helper functions for webhook handlers
async function handleInviteeCreated(payload) {
  try {
    console.log('✅ New meeting scheduled via webhook:', payload.event);
    const calendlyService = new CalendlyService();
    const eventUri = payload.event;
    const eventUuid = eventUri.split('/').pop();

    // Check if webhook event already processed (deduplication)
    const { data: existingWebhookEvent } = await getSupabase()
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .single();

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping');
      return;
    }

    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);
    const event = eventData.resource;

    const { data: users } = await getSupabase()
      .from('users')
      .select('id')
      .limit(1);

    if (!users || users.length === 0) {
      console.error('❌ No users found in database');
      return;
    }

    const userId = users[0].id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);

    // Mark as synced via webhook
    meetingData.synced_via_webhook = true;

    const { error } = await getSupabase()
      .from('meetings')
      .insert(meetingData);

    if (error) {
      console.error('❌ Error inserting meeting from webhook:', error);
    } else {
      console.log('✅ Meeting created from webhook:', meetingData.title);

      // Record webhook event
      await getSupabase()
        .from('calendly_webhook_events')
        .insert({
          event_id: eventUuid,
          event_type: 'invitee.created',
          payload: payload,
          user_id: userId
        });

      // Update user's last sync time
      await getSupabase()
        .from('users')
        .update({
          last_calendly_sync: new Date().toISOString(),
          calendly_webhook_enabled: true
        })
        .eq('id', userId);
    }
  } catch (error) {
    console.error('❌ Error handling invitee.created:', error);
  }
}

async function handleInviteeCanceled(payload) {
  try {
    console.log('🗑️  Meeting cancelled via webhook:', payload.event);
    const eventUri = payload.event;
    const eventUuid = eventUri.split('/').pop();
    const calendlyEventId = `calendly_${eventUuid}`;

    // Check if webhook event already processed (deduplication)
    const { data: existingWebhookEvent } = await getSupabase()
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .single();

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping');
      return;
    }

    // Get user ID from the meeting
    const { data: meeting } = await getSupabase()
      .from('meetings')
      .select('userid')
      .eq('googleeventid', calendlyEventId)
      .single();

    const { error } = await getSupabase()
      .from('meetings')
      .update({
        is_deleted: true,
        sync_status: 'canceled',
        synced_via_webhook: true,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', calendlyEventId);

    if (error) {
      console.error('❌ Error marking meeting as deleted:', error);
    } else {
      console.log('✅ Meeting marked as canceled via webhook:', calendlyEventId);

      if (meeting?.userid) {
        // Record webhook event
        await getSupabase()
          .from('calendly_webhook_events')
          .insert({
            event_id: eventUuid,
            event_type: 'invitee.canceled',
            payload: payload,
            user_id: parseInt(meeting.userid)
          });

        // Update user's last sync time
        await getSupabase()
          .from('users')
          .update({
            last_calendly_sync: new Date().toISOString(),
            calendly_webhook_enabled: true
          })
          .eq('id', parseInt(meeting.userid));
      }
    }
  } catch (error) {
    console.error('❌ Error handling invitee.canceled:', error);
  }
}

module.exports = router;
