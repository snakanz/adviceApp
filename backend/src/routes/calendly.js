const express = require('express');
const crypto = require('crypto');
const CalendlyService = require('../services/calendlyService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

const router = express.Router();

console.log('🔄 Calendly routes loaded successfully');

// =====================================================
// WEBHOOK MANAGEMENT ENDPOINTS
// =====================================================

/**
 * Delete webhook subscription from Calendly
 * This removes the webhook from Calendly's system (not just our database)
 */
router.delete('/webhook/subscription', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabase = getSupabase();

    console.log(`\n🗑️  Deleting Calendly webhook for user: ${userId}`);

    // Get user's Calendly connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('access_token, calendly_user_uri, organization_uri')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Error fetching connection:', connectionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch Calendly connection'
      });
    }

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'No active Calendly connection found'
      });
    }

    const calendlyService = new CalendlyService(connection.access_token);
    const organizationUri = connection.organization_uri;

    // List all webhook subscriptions for this organization
    console.log(`📋 Listing webhooks for organization: ${organizationUri}`);

    const webhooksResponse = await calendlyService.makeRequest(
      `/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`
    );

    const webhooks = webhooksResponse.collection || [];
    console.log(`📊 Found ${webhooks.length} webhook(s)`);

    // Find webhooks pointing to our app
    const appUrl = process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com';
    const ourWebhooks = webhooks.filter(wh =>
      wh.callback_url && wh.callback_url.includes(appUrl)
    );

    console.log(`🎯 Found ${ourWebhooks.length} webhook(s) for our app`);

    if (ourWebhooks.length === 0) {
      return res.json({
        success: true,
        message: 'No webhooks found to delete',
        webhooks_deleted: 0
      });
    }

    // Delete each webhook
    const deletedWebhooks = [];
    for (const webhook of ourWebhooks) {
      try {
        const webhookUri = webhook.uri;
        const webhookUuid = webhookUri.split('/').pop();

        console.log(`🗑️  Deleting webhook: ${webhook.callback_url}`);

        await calendlyService.makeRequest(
          `/webhook_subscriptions/${webhookUuid}`,
          { method: 'DELETE' }
        );

        deletedWebhooks.push({
          uri: webhookUri,
          callback_url: webhook.callback_url
        });

        console.log(`✅ Deleted webhook: ${webhookUuid}`);
      } catch (deleteError) {
        console.error(`❌ Error deleting webhook ${webhook.uri}:`, deleteError);
        // Continue with other webhooks
      }
    }

    // Clean up database records
    const { error: dbDeleteError } = await supabase
      .from('calendly_webhook_subscriptions')
      .delete()
      .eq('organization_uri', organizationUri);

    if (dbDeleteError) {
      console.error('⚠️  Error cleaning up database:', dbDeleteError);
    }

    console.log(`✅ Webhook deletion complete: ${deletedWebhooks.length} deleted\n`);

    res.json({
      success: true,
      message: `Successfully deleted ${deletedWebhooks.length} webhook(s)`,
      webhooks_deleted: deletedWebhooks.length,
      deleted_webhooks: deletedWebhooks
    });

  } catch (error) {
    console.error('❌ Error deleting webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete webhook',
      details: error.message
    });
  }
});

/**
 * List all webhook subscriptions for the user's organization
 */
router.get('/webhook/list', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabase = getSupabase();

    // Get user's Calendly connection
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('access_token, organization_uri')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .maybeSingle();

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'No active Calendly connection found'
      });
    }

    const calendlyService = new CalendlyService(connection.access_token);
    const organizationUri = connection.organization_uri;

    // List all webhook subscriptions
    const webhooksResponse = await calendlyService.makeRequest(
      `/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`
    );

    const webhooks = webhooksResponse.collection || [];

    res.json({
      success: true,
      count: webhooks.length,
      webhooks: webhooks.map(wh => ({
        uri: wh.uri,
        callback_url: wh.callback_url,
        state: wh.state,
        events: wh.events,
        created_at: wh.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error listing webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list webhooks',
      details: error.message
    });
  }
});

// =====================================================
// CONNECTION ENDPOINTS
// =====================================================

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
// NOTE: The actual webhook handler has been moved to calendly-webhook.js
// This is mounted BEFORE express.json() middleware in index.js to preserve raw body
// for signature verification. See backend/src/routes/calendly-webhook.js

/**
 * DEPRECATED: This webhook handler is kept for backward compatibility
 * but should not be used. The production webhook handler is in calendly-webhook.js
 *
 * ✅ FIX #1, #2, #3: Verify Calendly webhook signature using RAW body
 * Calendly signature format: "t=TIMESTAMP,s=sha256=HEX_SIGNATURE"
 * HMAC is computed over: timestamp + "." + raw_body
 * Reference: https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-signatures
 */
function verifyCalendlySignature_DEPRECATED(rawBody, signatureHeader, signingKey) {
  if (!signatureHeader) {
    console.warn('⚠️  No Calendly-Webhook-Signature header provided');
    return false;
  }

  try {
    // Parse signature header: "t=TIMESTAMP,s=sha256=HEX_SIGNATURE"
    const parts = signatureHeader.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    const sPart = parts.find(p => p.startsWith('s='));

    if (!tPart || !sPart) {
      console.error('❌ Invalid signature header format:', signatureHeader);
      return false;
    }

    const timestamp = tPart.split('=')[1];
    const sigValue = sPart.split('=')[1];

    // Remove 'sha256=' prefix if present
    const sigHex = sigValue.replace(/^sha256=/, '');

    // ✅ FIX: Compute HMAC over raw body bytes (not parsed JSON)
    // Calendly computes: HMAC-SHA256(signing_key, timestamp + "." + raw_body)
    const signedContent = timestamp + '.' + rawBody.toString('utf8');

    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(signedContent);
    const computed = hmac.digest('hex');

    // ✅ FIX: Use constant-time comparison with proper buffer lengths
    const computedBuffer = Buffer.from(computed, 'hex');
    const signatureBuffer = Buffer.from(sigHex, 'hex');

    if (computedBuffer.length !== signatureBuffer.length) {
      console.error('❌ Signature length mismatch:', {
        computed: computedBuffer.length,
        received: signatureBuffer.length
      });
      return false;
    }

    const isValid = crypto.timingSafeEqual(computedBuffer, signatureBuffer);

    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      console.error('   Expected:', computed);
      console.error('   Received:', sigHex);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    console.error('   Error details:', error.message);
    // ✅ FIX #5: Never throw - return false gracefully
    return false;
  }
}

/**
 * ✅ FIX #2: Calendly Webhook Handler with RAW BODY middleware
 * PRODUCTION-READY PATTERN:
 * 1. Use express.raw() to preserve raw body for signature verification
 * 2. Verify signature over raw bytes (not parsed JSON)
 * 3. Return 200 immediately (before processing)
 * 4. Process webhook asynchronously (no blocking)
 * 5. Handle all errors gracefully (no 500s)
 * 6. Implement idempotency (dedupe retries)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CALENDLY WEBHOOK RECEIVED                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // ✅ FIX #2: req.body is now a Buffer (raw bytes)
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      console.error('❌ CRITICAL: Raw body is not a Buffer:', typeof rawBody);
      // ✅ FIX #4: Return 200 even on error to prevent webhook disablement
      return res.status(200).json({ received: true, error: 'Invalid body format' });
    }

    console.log(`📦 Raw body length: ${rawBody.length} bytes`);

    // ✅ FIX #3: Verify signature using raw body
    const signatureHeader = req.headers['calendly-webhook-signature'];
    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    if (!webhookSigningKey) {
      console.warn('⚠️  CALENDLY_WEBHOOK_SIGNING_KEY not configured - skipping signature verification');
      console.warn('⚠️  This is INSECURE and should only be used in development!');
    } else {
      const isValid = verifyCalendlySignature(rawBody, signatureHeader, webhookSigningKey);

      if (!isValid) {
        console.error('❌ Webhook signature verification failed');
        // ✅ FIX #5: Return 401 but don't crash
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log('✅ Signature verified successfully!');
    }

    // ✅ FIX #4: Return 200 IMMEDIATELY (before processing)
    // This prevents timeouts and webhook disablement
    res.status(200).json({ received: true });

    // ✅ FIX #4: Process webhook asynchronously (non-blocking)
    // Parse JSON after sending response
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawBody.toString('utf8'));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook JSON:', parseError);
      // Already sent 200, just log and return
      return;
    }

    console.log('📥 Webhook event:', {
      event: parsedPayload.event,
      created_at: parsedPayload.created_at
    });

    // ✅ FIX #7: Handle DB unavailability gracefully (already sent 200)
    if (!isSupabaseAvailable()) {
      console.error('❌ Database unavailable - webhook will be lost');
      console.error('⚠️  TODO: Implement queue for retry (SQS/Redis/etc)');
      // Already sent 200, so Calendly won't retry
      return;
    }

    const { event, payload } = parsedPayload;

    // ✅ FIX #5: Validate payload structure before processing
    if (!event || !payload) {
      console.error('❌ Invalid webhook payload structure:', {
        hasEvent: !!event,
        hasPayload: !!payload
      });
      return;
    }

    // Process webhook event asynchronously (don't await - fire and forget)
    processWebhookEvent(event, payload).catch(error => {
      console.error('❌ Error in async webhook processing:', error);
      console.error('   Stack:', error.stack);
      // Error already logged, webhook already acknowledged with 200
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in webhook handler:', error);
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Always return 200 to prevent webhook disablement
    // If we haven't sent response yet, send it now
    if (!res.headersSent) {
      res.status(200).json({ received: true, error: 'Internal error' });
    }
  }
});

/**
 * ✅ FIX #4: Async webhook processor (runs after 200 response sent)
 * This function processes the webhook event without blocking the HTTP response
 */
async function processWebhookEvent(event, payload) {
  try {
    console.log(`\n🔄 Processing webhook event: ${event}`);

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

    console.log(`✅ Webhook event processed: ${event}\n`);
  } catch (error) {
    console.error(`❌ Error processing webhook event ${event}:`, error);
    throw error; // Re-throw for logging in caller
  }
}

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

// =====================================================
// WEBHOOK EVENT HANDLERS (with idempotency & error handling)
// =====================================================

/**
 * ✅ FIX #6: Handle invitee.created with idempotency
 * Stores event ID BEFORE processing to prevent duplicate processing on retries
 */
async function handleInviteeCreated(payload) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.created:', payload);
      return;
    }

    console.log('✅ New meeting scheduled via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();

    // ✅ FIX #6: IDEMPOTENCY - Store event ID FIRST (before processing)
    // This prevents duplicate processing if webhook is retried
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.created')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
      // Continue anyway - better to process twice than not at all
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY to claim this event
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.created',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      // Check if it's a duplicate key error (race condition)
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed by another request (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
      // Continue processing anyway
    }

    // ✅ FIX #5: Validate required fields
    const calendlyUserUri = payload.created_by;
    if (!calendlyUserUri) {
      console.error('❌ No created_by (Calendly user URI) in webhook payload');
      return;
    }

    console.log(`🔍 Looking for user with Calendly URI: ${calendlyUserUri}`);

    // Query for the specific user's connection using calendly_user_uri
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('user_id, access_token')
      .eq('provider', 'calendly')
      .eq('calendly_user_uri', calendlyUserUri)
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Error querying calendar connection:', connectionError);
      return;
    }

    if (!connection) {
      console.error('❌ No matching Calendly connection found for webhook:', {
        calendlyUserUri
      });
      return;
    }

    console.log(`✅ Found matching user: ${connection.user_id}`);

    // Create CalendlyService with user's specific OAuth token
    const calendlyService = new CalendlyService(connection.access_token);

    // Fetch event details using user's token
    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);

    if (!eventData || !eventData.resource) {
      console.error('❌ Invalid event data from Calendly API');
      return;
    }

    const event = eventData.resource;
    const userId = connection.user_id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);

    // Check if meeting already exists (by external_id)
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('external_id', meetingData.external_id)
      .eq('user_id', userId)
      .maybeSingle();

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
      throw error; // Re-throw to log in caller
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
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

/**
 * ✅ FIX #6: Handle invitee.canceled with idempotency
 */
async function handleInviteeCanceled(payload) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.canceled:', payload);
      return;
    }

    console.log('🗑️  Meeting cancelled via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();
    const calendlyEventId = `calendly_${eventUuid}`;

    // ✅ FIX #6: IDEMPOTENCY - Check and store event ID FIRST
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.canceled')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.canceled',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
    }

    // Get user ID from the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('user_id')
      .eq('external_id', calendlyEventId)
      .maybeSingle();

    const { error } = await supabase
      .from('meetings')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', calendlyEventId);

    if (error) {
      console.error('❌ Error marking meeting as deleted:', error);
      throw error;
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
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

/**
 * ✅ FIX #6: Handle invitee.updated with idempotency
 */
async function handleInviteeUpdated(payload) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.updated:', payload);
      return;
    }

    console.log('🔄 Meeting updated via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();

    // ✅ FIX #6: IDEMPOTENCY - Check and store event ID FIRST
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.updated')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.updated',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
    }

    // ✅ FIX #5: Validate required fields
    const calendlyUserUri = payload.created_by;
    if (!calendlyUserUri) {
      console.error('❌ No created_by (Calendly user URI) in webhook payload');
      return;
    }

    console.log(`🔍 Looking for user with Calendly URI: ${calendlyUserUri}`);

    // Query for the specific user's connection using calendly_user_uri
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('user_id, access_token')
      .eq('provider', 'calendly')
      .eq('calendly_user_uri', calendlyUserUri)
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Error querying calendar connection:', connectionError);
      return;
    }

    if (!connection) {
      console.error('❌ No matching Calendly connection found for webhook:', {
        calendlyUserUri
      });
      return;
    }

    console.log(`✅ Found matching user: ${connection.user_id}`);

    // Create CalendlyService with user's specific OAuth token
    const calendlyService = new CalendlyService(connection.access_token);

    // Fetch the updated event details from Calendly using user's token
    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);

    if (!eventData || !eventData.resource) {
      console.error('❌ Invalid event data from Calendly API');
      return;
    }

    const event = eventData.resource;

    // Find the existing meeting in database
    const calendlyEventId = `calendly_${eventUuid}`;
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('external_id', calendlyEventId)
      .maybeSingle();

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
      throw error;
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
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

module.exports = router;
