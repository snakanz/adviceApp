const express = require('express');
const crypto = require('crypto');
const CalendlyService = require('../services/calendlyService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

const router = express.Router();

console.log('🔄 Calendly routes loaded successfully');

// Test Calendly connection
router.get('/test-connection', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's Calendly access token
    const accessToken = await CalendlyService.getUserAccessToken(userId);

    if (!accessToken) {
      return res.json({
        connected: false,
        error: 'No Calendly connection found. Please connect your Calendly account first.'
      });
    }

    const calendlyService = new CalendlyService(accessToken);
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

// Get Calendly connection status - Check USER-SPECIFIC connection, not global backend token
router.get('/status', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        connected: false,
        error: 'Database service unavailable'
      });
    }

    // Check if user has an active Calendly connection in the database
    const { data: connection, error } = await req.supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Calendly connection:', error);
      return res.status(500).json({
        connected: false,
        error: 'Failed to check connection status'
      });
    }

    // If no active connection found
    if (!connection) {
      return res.json({
        connected: false,
        configured: false,
        message: 'No active Calendly connection found'
      });
    }

    // Connection exists - verify the token is still valid by testing it
    try {
      const CalendlyOAuthService = require('../services/calendlyOAuth');
      const oauthService = new CalendlyOAuthService();
      const testResult = await oauthService.testConnection(connection.access_token);

      return res.json({
        connected: testResult.connected,
        configured: true,
        user: testResult.user?.name || connection.account_email || 'Unknown',
        email: connection.account_email,
        message: testResult.connected ? 'Calendly integration working!' : testResult.error
      });
    } catch (tokenError) {
      console.error('Error testing Calendly token:', tokenError);
      // Token might be expired, but connection exists
      return res.json({
        connected: false,
        configured: true,
        email: connection.account_email,
        message: 'Calendly token may have expired. Please reconnect.',
        error: tokenError.message
      });
    }
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
router.post('/sync', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const userId = req.user.id;

    console.log(`🔄 Starting enhanced Calendly sync for user ${userId}`);

    // Fetch user's Calendly access token
    const accessToken = await CalendlyService.getUserAccessToken(userId);

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'No Calendly connection found',
        message: 'Please connect your Calendly account first in Settings.'
      });
    }

    const calendlyService = new CalendlyService(accessToken);

    // Get sync status before sync
    const { data: beforeStatus } = await req.supabase
      .rpc('get_calendly_sync_status', { user_id: userId });

    // Perform the sync
    const syncResult = await calendlyService.syncMeetingsToDatabase(userId);

    // Get sync status after sync
    const { data: afterStatus } = await req.supabase
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
        check_connection: 'Verify your Calendly account is connected in Settings',
        check_permissions: 'Ensure your Calendly OAuth token has read access to scheduled events',
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
router.get('/meetings', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: meetings, error } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('meeting_source', 'calendly')
      .eq('is_deleted', false)
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
router.get('/debug/client/:email', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const clientEmail = decodeURIComponent(req.params.email);
    console.log(`🔍 Debugging meetings for client: ${clientEmail}`);

    // Get all meetings for this client email
    const { data: meetings, error } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('user_id', req.user.id)
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
router.get('/stats', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: stats, error } = await req.supabase
      .from('integration_status')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching integration stats:', error);
      return res.status(500).json({ error: 'Failed to fetch integration stats' });
    }

    res.json(stats || {
      user_id: req.user.id,
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

// DISABLED: Scheduler endpoints (replaced with webhook-only sync)
// The system now uses webhooks exclusively for real-time updates
// Manual sync is still available via POST /api/calendly/sync endpoint
// router.get('/scheduler/status', ...) - REMOVED
// router.post('/scheduler/trigger', ...) - REMOVED

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
      case 'invitee.updated':
        await handleInviteeUpdated(payload);
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
    const supabase = getSupabase();

    // Check if webhook event already processed (deduplication)
    const { data: existingWebhookEvent } = await supabase
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

    // Get the user ID from the Calendly connection
    // For now, we'll need to determine this from the webhook context
    // In a multi-user system, this would be mapped from Calendly account
    // For single-user, we can query the active Calendly connection
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('user_id')
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .single();

    if (!connection) {
      console.error('❌ No active Calendly connection found for webhook');
      return;
    }

    const userId = connection.user_id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);

    // Check if meeting already exists (by external_id)
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('external_id', meetingData.external_id)
      .eq('user_id', userId)
      .single();

    let error;
    if (existingMeeting) {
      // Update existing meeting instead of creating duplicate
      console.log('⚠️  Meeting already exists, updating instead');
      const updateResult = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', existingMeeting.id);
      error = updateResult.error;
    } else {
      // Create new meeting
      const insertResult = await supabase
        .from('meetings')
        .insert(meetingData);
      error = insertResult.error;
    }

    if (error) {
      console.error('❌ Error saving meeting from webhook:', error);
    } else {
      console.log('✅ Meeting saved from webhook:', meetingData.title);

      // Update user's last sync time
      await supabase
        .from('users')
        .update({
          last_calendly_sync: new Date().toISOString()
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
    const supabase = getSupabase();

    // Check if webhook event already processed (deduplication)
    const { data: existingWebhookEvent } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .single();

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping');
      return;
    }

    // Get user ID from the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('user_id')
      .eq('external_id', calendlyEventId)
      .single();

    const { error } = await supabase
      .from('meetings')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', calendlyEventId);

    if (error) {
      console.error('❌ Error marking meeting as deleted:', error);
    } else {
      console.log('✅ Meeting marked as canceled via webhook:', calendlyEventId);

      if (meeting?.user_id) {
        // Update user's last sync time
        await supabase
          .from('users')
          .update({
            last_calendly_sync: new Date().toISOString()
          })
          .eq('id', meeting.user_id);
      }
    }
  } catch (error) {
    console.error('❌ Error handling invitee.canceled:', error);
  }
}

async function handleInviteeUpdated(payload) {
  try {
    console.log('🔄 Meeting updated via webhook:', payload.event);
    const calendlyService = new CalendlyService();
    const eventUri = payload.event;
    const eventUuid = eventUri.split('/').pop();
    const supabase = getSupabase();

    // Check if webhook event already processed (deduplication)
    const { data: existingWebhookEvent } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.updated')
      .single();

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping');
      return;
    }

    // Fetch the updated event details from Calendly
    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);
    const event = eventData.resource;

    // Find the existing meeting in database
    const calendlyEventId = `calendly_${eventUuid}`;
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('external_id', calendlyEventId)
      .single();

    if (!existingMeeting) {
      console.log('⚠️  Meeting not found in database, creating new one');
      // If meeting doesn't exist, create it
      await handleInviteeCreated(payload);
      return;
    }

    // Transform the updated event data
    const userId = existingMeeting.user_id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);
    meetingData.updated_at = new Date().toISOString();

    // Update the meeting
    const { error } = await supabase
      .from('meetings')
      .update(meetingData)
      .eq('id', existingMeeting.id);

    if (error) {
      console.error('❌ Error updating meeting from webhook:', error);
    } else {
      console.log('✅ Meeting updated from webhook:', meetingData.title);

      // Update user's last sync time
      await supabase
        .from('users')
        .update({
          last_calendly_sync: new Date().toISOString()
        })
        .eq('id', userId);
    }
  } catch (error) {
    console.error('❌ Error handling invitee.updated:', error);
  }
}

module.exports = router;
