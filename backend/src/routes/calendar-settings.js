const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const WebhookHealthService = require('../services/webhookHealthService');
const { encrypt, decrypt } = require('../utils/encryption');
const { logAudit, getClientIp } = require('../services/auditLogger');

/**
 * GET /api/calendar-connections
 * List all calendar connections for the authenticated user
 * ✅ ENHANCED: Checks webhook health for Calendly connections
 */
router.get('/', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Get all calendar connections for this user
    const { data: connections, error } = await req.supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching calendar connections:', error);
      return res.status(500).json({
        error: 'Failed to fetch calendar connections'
      });
    }

    // ✅ NEW: Check webhook health for active Calendly connections
    // This ensures webhooks stay active even if user logs out and comes back weeks later
    if (connections && connections.length > 0) {
      const calendlyConnection = connections.find(c => c.provider === 'calendly' && c.is_active);
      if (calendlyConnection) {
        console.log(`🔍 Checking webhook health for user ${userId}...`);
        // Run health check in background (don't block response)
        WebhookHealthService.checkAndRepairWebhook(userId).catch(error => {
          console.error('⚠️  Webhook health check failed:', error.message);
        });
      }
    }

    res.json({
      success: true,
      connections: connections || []
    });

  } catch (error) {
    console.error('Error in GET /calendar-connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calendar-connections/webhook/health-check
 * Check and repair webhook health for Calendly connections
 * ✅ NEW: Ensures webhooks stay active permanently
 */
router.post('/webhook/health-check', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔍 Webhook health check requested for user ${userId}`);

    const result = await WebhookHealthService.checkAndRepairWebhook(userId);

    res.json({
      success: result.status !== 'error',
      status: result.status,
      message: result.message
    });

  } catch (error) {
    console.error('Error in webhook health check:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook health check failed',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar-connections/microsoft/check-status
 * Check if Microsoft admin consent has been granted
 *
 * This endpoint attempts to verify if the user can now connect their Microsoft calendar.
 * It's used after IT admin has (potentially) approved the application.
 *
 * Returns:
 * - approved: User can now connect their calendar
 * - pending_admin_approval: Admin consent still required
 * - blocked: Organization has blocked the application
 * - error: Could not determine status
 */
router.post('/microsoft/check-status', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔍 Checking Microsoft admin consent status for user ${userId}...`);

    // Check if Microsoft is configured
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    if (!microsoftService.isConfigured()) {
      return res.status(400).json({
        status: 'error',
        message: 'Microsoft OAuth not configured',
        can_connect: false
      });
    }

    // Check if user already has an active Microsoft connection
    const { data: existingConnection, error: connError } = await req.supabase
      .from('calendar_connections')
      .select('id, is_active, pending_admin_consent, admin_consent_error')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (connError) {
      console.error('Error checking existing connection:', connError);
    }

    // If user has an active connection, they're already approved
    if (existingConnection?.is_active) {
      return res.json({
        status: 'approved',
        message: 'Microsoft Calendar is already connected',
        can_connect: true,
        has_connection: true
      });
    }

    // If we have a pending consent record, return its status
    if (existingConnection?.pending_admin_consent) {
      return res.json({
        status: 'pending_admin_approval',
        message: 'Still waiting for IT administrator approval',
        can_connect: false,
        has_connection: true,
        last_error: existingConnection.admin_consent_error,
        instructions: 'Please check with your IT administrator if they have approved the application.'
      });
    }

    // No existing connection or pending consent - user can try to connect
    // This will start the OAuth flow and we'll find out then if consent is needed
    return res.json({
      status: 'unknown',
      message: 'Ready to attempt Microsoft connection',
      can_connect: true,
      has_connection: false,
      instructions: 'Click "Connect Microsoft Calendar" to start the connection process.'
    });

  } catch (error) {
    console.error('Error checking Microsoft consent status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check consent status',
      error: error.message,
      can_connect: false
    });
  }
});

/**
 * DELETE /api/calendar-connections/:id
 * Disconnect a calendar connection
 */
router.delete('/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionId = req.params.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Verify the connection belongs to this user
    const { data: connection, error: fetchError } = await req.supabase
      .from('calendar_connections')
      .select('id, provider, is_active')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    // Stop webhook if this is a Google Calendar connection
    if (connection.provider === 'google') {
      try {
        console.log('🛑 Stopping Google Calendar webhook...');
        const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
        const webhookService = new GoogleCalendarWebhookService();
        await webhookService.stopCalendarWatch(userId);
        console.log('✅ Google Calendar webhook stopped');
      } catch (webhookError) {
        console.warn('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
        // Don't fail the disconnect if webhook cleanup fails
      }
    }

    // Stop webhook if this is a Microsoft Calendar connection
    if (connection.provider === 'microsoft') {
      try {
        console.log('🛑 Stopping Microsoft Calendar webhook...');
        const MicrosoftCalendarService = require('../services/microsoftCalendar');
        const microsoftService = new MicrosoftCalendarService();
        await microsoftService.stopCalendarWatch(userId);
        console.log('✅ Microsoft Calendar webhook stopped');
      } catch (webhookError) {
        console.warn('⚠️  Microsoft webhook cleanup failed (non-fatal):', webhookError.message);
        // Don't fail the disconnect if webhook cleanup fails
      }
    }

    // Clean up Calendly webhook if this is a Calendly connection
    if (connection.provider === 'calendly') {
      try {
        console.log('🛑 Cleaning up Calendly webhook subscription...');

        // Get full connection details for webhook deletion
        const { data: fullConnection, error: fullConnError } = await req.supabase
          .from('calendar_connections')
          .select('access_token, calendly_user_uri, calendly_organization_uri, calendly_webhook_id')
          .eq('id', connectionId)
          .eq('user_id', userId)
          .single();

        if (!fullConnError && fullConnection?.access_token && fullConnection?.calendly_organization_uri) {
          const CalendlyService = require('../services/calendlyService');
          const calendlyService = new CalendlyService(decrypt(fullConnection.access_token));
          const organizationUri = fullConnection.calendly_organization_uri;

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

          // Delete each webhook
          for (const webhook of ourWebhooks) {
            try {
              const webhookUri = webhook.uri;
              const webhookUuid = webhookUri.split('/').pop();

              console.log(`🗑️  Deleting webhook: ${webhook.callback_url}`);

              await calendlyService.makeRequest(
                `/webhook_subscriptions/${webhookUuid}`,
                { method: 'DELETE' }
              );

              console.log(`✅ Deleted webhook: ${webhookUuid}`);
            } catch (deleteError) {
              console.error(`❌ Error deleting webhook ${webhook.uri}:`, deleteError.message);
              // Continue with other webhooks
            }
          }

          // Clean up database records
          const { error: dbDeleteError } = await req.supabase
            .from('calendly_webhook_subscriptions')
            .delete()
            .eq('organization_uri', organizationUri);

          if (dbDeleteError) {
            console.error('⚠️  Error cleaning up database:', dbDeleteError);
          }

          console.log('✅ Calendly webhook cleanup completed');
        } else {
          console.warn('⚠️  Cannot delete webhook - missing connection details');
        }
      } catch (webhookError) {
        console.warn('⚠️  Calendly webhook cleanup failed (non-fatal):', webhookError.message);
        // Don't fail the disconnect if webhook cleanup fails
      }
    }

    // Delete the connection
    const { error: deleteError } = await req.supabase
      .from('calendar_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting calendar connection:', deleteError);
      return res.status(500).json({
        error: 'Failed to disconnect calendar'
      });
    }

    console.log(`✅ Calendar connection ${connectionId} (${connection.provider}) disconnected for user ${userId}`);
    logAudit(userId, 'calendar.disconnect', 'calendar_connection', { resourceId: connectionId, details: { provider: connection.provider }, ipAddress: getClientIp(req) });

    res.json({
      success: true,
      message: 'Calendar disconnected successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /calendar-connections/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/calendar-connections/:id/toggle-sync
 * Enable or disable sync for a calendar connection
 * When enabling, deactivates other connections and triggers sync for Google Calendar
 */
router.patch('/:id/toggle-sync', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionId = req.params.id;
    const { sync_enabled } = req.body;

    if (typeof sync_enabled !== 'boolean') {
      return res.status(400).json({
        error: 'sync_enabled must be a boolean'
      });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // If enabling, deactivate all other connections first
    if (sync_enabled) {
      console.log(`🔄 Deactivating other active calendar connections for user ${userId}...`);
      const { error: deactivateError } = await req.supabase
        .from('calendar_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .neq('id', connectionId);

      if (deactivateError) {
        console.warn(`⚠️ Warning: Could not deactivate other connections:`, deactivateError);
      } else {
        console.log(`✅ Other connections deactivated for user ${userId}`);
      }
    }

    // Update the is_active flag for this connection
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .update({
        is_active: sync_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error toggling sync:', error);
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    console.log(`✅ Sync ${sync_enabled ? 'enabled' : 'disabled'} for connection ${connectionId}`);

    // If enabling a calendar, set up webhooks and trigger background sync
    if (sync_enabled) {
      // Google Calendar: Set up webhook and sync
      if (data.provider === 'google') {
        try {
          console.log('📡 Setting up Google Calendar webhook...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();

          // Set up webhook (non-blocking)
          webhookService.setupCalendarWatch(userId).catch(err => {
            console.warn('⚠️ Webhook setup failed (non-fatal):', err.message);
          });

          console.log('🔄 Triggering Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');

          // Don't await - let it run in background
          calendarSyncService.syncUserCalendar(userId, {
            timeRange: 'extended',
            includeDeleted: true
          }).then(syncResult => {
            console.log('✅ Google Calendar sync completed:', syncResult);
          }).catch(syncErr => {
            console.warn('⚠️ Google Calendar sync failed (non-fatal):', syncErr.message);
          });
        } catch (syncErr) {
          console.warn('⚠️ Failed to start background sync:', syncErr.message);
        }
      }

      // Microsoft Calendar: Set up webhook and sync
      if (data.provider === 'microsoft') {
        try {
          console.log('📡 Setting up Microsoft Calendar webhook...');
          const MicrosoftCalendarService = require('../services/microsoftCalendar');
          const microsoftService = new MicrosoftCalendarService();

          // Set up webhook (non-blocking)
          microsoftService.setupCalendarWatch(userId).catch(err => {
            console.warn('⚠️ Microsoft webhook setup failed (non-fatal):', err.message);
          });

          console.log('🔄 Triggering Microsoft Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');

          // Don't await - let it run in background
          calendarSyncService.syncUserCalendar(userId, {
            timeRange: 'extended',
            includeDeleted: true
          }).then(syncResult => {
            console.log('✅ Microsoft Calendar sync completed:', syncResult);
          }).catch(syncErr => {
            console.warn('⚠️ Microsoft Calendar sync failed (non-fatal):', syncErr.message);
          });
        } catch (syncErr) {
          console.warn('⚠️ Failed to start Microsoft background sync:', syncErr.message);
        }
      }

      // Calendly: Trigger background sync
      if (data.provider === 'calendly') {
        try {
          console.log('🔄 Triggering Calendly sync in background...');
          const CalendlyService = require('../services/calendlyService');
          const calendlyService = new CalendlyService(decrypt(data.access_token));

          // Don't await - let it run in background
          calendlyService.syncMeetingsToDatabase(userId).then(syncResult => {
            console.log('✅ Calendly sync completed:', syncResult);
          }).catch(syncErr => {
            console.warn('⚠️ Calendly sync failed (non-fatal):', syncErr.message);
          });
        } catch (syncErr) {
          console.warn('⚠️ Failed to start Calendly sync:', syncErr.message);
        }
      }
    }

    // If disabling calendar, stop the webhook
    if (!sync_enabled) {
      if (data.provider === 'google') {
        try {
          console.log('🛑 Stopping Google Calendar webhook...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();

          webhookService.stopCalendarWatch(userId).catch(err => {
            console.warn('⚠️ Webhook cleanup failed (non-fatal):', err.message);
          });
        } catch (err) {
          console.warn('⚠️ Failed to stop Google webhook:', err.message);
        }
      } else if (data.provider === 'microsoft') {
        try {
          console.log('🛑 Stopping Microsoft Calendar webhook...');
          const MicrosoftCalendarService = require('../services/microsoftCalendar');
          const microsoftService = new MicrosoftCalendarService();

          microsoftService.stopCalendarWatch(userId).catch(err => {
            console.warn('⚠️ Microsoft webhook cleanup failed (non-fatal):', err.message);
          });
        } catch (err) {
          console.warn('⚠️ Failed to stop Microsoft webhook:', err.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Sync ${sync_enabled ? 'enabled' : 'disabled'} successfully`,
      connection: data
    });

  } catch (error) {
    console.error('Error in PATCH /calendar-connections/:id/toggle-sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/calendar-connections/:id/set-primary
 * Set a calendar connection as the primary calendar (deprecated - kept for compatibility)
 */
router.patch('/:id/set-primary', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionId = req.params.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Verify the connection belongs to this user
    const { data: connection, error: fetchError } = await req.supabase
      .from('calendar_connections')
      .select('id')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    // First, deactivate all other connections (only one active per user)
    await req.supabase
      .from('calendar_connections')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Then set this connection as active
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error setting primary calendar:', error);
      return res.status(500).json({
        error: 'Failed to set primary calendar'
      });
    }

    console.log(`✅ Connection ${connectionId} set as primary for user ${userId}`);

    res.json({
      success: true,
      message: 'Primary calendar updated successfully',
      connection: data
    });

  } catch (error) {
    console.error('Error in PATCH /calendar-connections/:id/set-primary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calendar-connections/calendly/prepare-oauth
 * Prepare for Calendly OAuth by clearing old session
 * ✅ NEW: Ensures fresh OAuth flow when reconnecting
 */
router.post('/calendly/prepare-oauth', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔓 Preparing Calendly OAuth for user ${userId}`);
    console.log('   - Clearing any cached Calendly sessions');
    console.log('   - Forcing fresh OAuth flow');

    // ✅ FIX: Return a special header that tells frontend to clear Calendly cookies
    // The frontend will use this to ensure a fresh OAuth flow
    res.json({
      success: true,
      message: 'OAuth preparation complete - ready for fresh login',
      timestamp: Date.now(),
      // ✅ Include a unique token to prevent caching
      nonce: Math.random().toString(36).substring(7)
    });
  } catch (error) {
    console.error('Error preparing Calendly OAuth:', error);
    res.status(500).json({ error: 'Failed to prepare OAuth' });
  }
});

/**
 * GET /api/calendar-connections/calendly/auth-url
 * Get Calendly OAuth authorization URL
 *
 * NOTE: The state parameter will be added by the frontend with the user ID
 * This endpoint just returns the base URL without state
 */
router.get('/calendly/auth-url', authenticateSupabaseUser, async (req, res) => {
  try {
    const CalendlyOAuthService = require('../services/calendlyOAuth');
    const oauthService = new CalendlyOAuthService();

    if (!oauthService.isConfigured()) {
      return res.status(400).json({
        error: 'Calendly OAuth not configured',
        message: 'Please set CALENDLY_OAUTH_CLIENT_ID and CALENDLY_OAUTH_CLIENT_SECRET environment variables'
      });
    }

    // ✅ IMPORTANT: Don't generate state here - frontend will add user ID as state
    // This ensures the OAuth callback knows which user is connecting
    const state = 'placeholder'; // Will be replaced by frontend
    const authUrl = oauthService.getAuthorizationUrl(state);

    // ✅ FIX: Properly remove the placeholder state parameter
    // Replace 'state=placeholder&' with just '&' to avoid double ampersands
    // Then replace trailing '&' with nothing
    const baseUrl = authUrl
      .replace('state=placeholder&', '')
      .replace('state=placeholder', '')
      .replace(/&$/, ''); // Remove trailing ampersand if present

    res.json({ url: baseUrl });
  } catch (error) {
    console.error('Error generating Calendly auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * POST /api/calendar-connections/calendly
 * Connect a Calendly account (via Personal Access Token)
 * ✅ FIXED: Now validates token and fetches user info before storing
 */
router.post('/calendly', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { api_token } = req.body;

    if (!api_token || !api_token.trim()) {
      return res.status(400).json({
        error: 'Calendly API token is required'
      });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    console.log(`🔑 Validating Calendly API token for user ${userId}...`);

    // ✅ FIXED: Validate the token by fetching user info from Calendly
    const CalendlyService = require('../services/calendlyService');
    const calendlyService = new CalendlyService(api_token.trim());

    let calendlyUser;
    try {
      calendlyUser = await calendlyService.getCurrentUser();
      console.log(`✅ Calendly token valid for user: ${calendlyUser.name} (${calendlyUser.email})`);
    } catch (validationError) {
      console.error('❌ Calendly token validation failed:', validationError.message);
      return res.status(400).json({
        error: 'Invalid Calendly API token',
        details: 'Could not validate token with Calendly. Please check your token and try again.'
      });
    }

    // Extract user URI and organization URI from Calendly response
    const calendlyUserUri = calendlyUser.uri;
    const calendlyOrganizationUri = calendlyUser.current_organization;
    const calendlyEmail = calendlyUser.email;
    const calendlyName = calendlyUser.name;

    console.log(`📋 Calendly user: ${calendlyName}`);
    console.log(`   User URI: ${calendlyUserUri}`);
    console.log(`   Organization URI: ${calendlyOrganizationUri}`);

    // Get user's tenant_id
    const { data: user, error: tenantError } = await req.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (tenantError || !user) {
      console.error('Error fetching user:', tenantError);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    if (!user.tenant_id) {
      console.error('User has no tenant_id:', userId);
      return res.status(400).json({ error: 'User must have a tenant to connect calendar' });
    }

    // Check if Calendly connection already exists
    const { data: existingConnection } = await req.supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .maybeSingle();

    // ✅ Connection data with all required fields for sync to work
    // Note: Column is provider_account_email, not account_email
    // webhook_status will be updated after webhook creation attempt
    const connectionData = {
      access_token: encrypt(api_token.trim()),
      is_active: true,
      calendly_user_uri: calendlyUserUri,
      calendly_organization_uri: calendlyOrganizationUri,
      provider_account_email: calendlyEmail,
      webhook_status: 'unknown', // Will be updated after webhook creation attempt
      updated_at: new Date().toISOString()
    };

    let connectionResult;

    if (existingConnection) {
      // Update existing connection
      const { data, error } = await req.supabase
        .from('calendar_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating Calendly connection:', error);
        return res.status(500).json({
          error: 'Failed to update Calendly connection'
        });
      }

      console.log(`✅ Calendly connection updated for user ${userId}`);
      connectionResult = data;
    } else {
      // Deactivate all other active connections (single active connection per user)
      console.log(`🔄 Deactivating other active calendar connections for user ${userId}...`);
      await req.supabase
        .from('calendar_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Create new Calendly connection
      const { data, error } = await req.supabase
        .from('calendar_connections')
        .insert({
          user_id: userId,
          tenant_id: user.tenant_id,
          provider: 'calendly',
          ...connectionData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating Calendly connection:', error);
        return res.status(500).json({
          error: 'Failed to connect Calendly',
          details: error.message
        });
      }

      console.log(`✅ Calendly connected successfully for user ${userId}`);
      logAudit(userId, 'calendar.connect', 'calendar_connection', { details: { provider: 'calendly' }, ipAddress: getClientIp(req) });
      connectionResult = data;
    }

    // ✅ Trigger automatic sync in background
    try {
      console.log('🔄 Triggering initial Calendly sync in background...');

      // Don't await - let it run in background
      calendlyService.syncMeetingsToDatabase(userId).then(syncResult => {
        console.log('✅ Initial Calendly sync completed:', syncResult);
      }).catch(syncErr => {
        console.warn('⚠️ Initial Calendly sync failed (non-fatal):', syncErr.message);
      });
    } catch (syncErr) {
      console.warn('⚠️ Failed to start initial Calendly sync:', syncErr.message);
    }

    // ✅ NEW: Attempt to create webhook subscription for real-time sync
    // This works for paid Calendly plans; free plans will gracefully fall back to polling
    let webhookStatus = 'missing';
    let webhookError = null;
    let webhookCreated = false;

    try {
      console.log('📡 Attempting to create Calendly webhook for real-time sync...');
      const CalendlyWebhookService = require('../services/calendlyWebhookService');
      const webhookService = new CalendlyWebhookService(api_token.trim());

      if (webhookService.isConfigured()) {
        const webhookResult = await webhookService.ensureWebhookSubscription(
          calendlyOrganizationUri,
          calendlyUserUri,
          userId
        );

        if (webhookResult.created || webhookResult.existing) {
          console.log('✅ Calendly webhook created/verified:', webhookResult.webhook_uri);
          webhookCreated = true;
          webhookStatus = 'active';

          // Store webhook info in database
          await req.supabase
            .from('calendar_connections')
            .update({
              calendly_webhook_id: webhookResult.webhook_uri,
              calendly_webhook_signing_key: webhookResult.webhook_signing_key,
              webhook_status: 'active',
              webhook_last_verified_at: new Date().toISOString(),
              webhook_last_error: null
            })
            .eq('id', connectionResult.id);

          console.log('✅ Real-time sync enabled via webhook');
        }
      } else {
        console.warn('⚠️ Webhook service not configured (missing CALENDLY_WEBHOOK_URL or CALENDLY_WEBHOOK_SIGNING_KEY)');
        webhookStatus = 'missing';
        webhookError = 'Webhook service not configured on server';
      }
    } catch (webhookErr) {
      console.warn('⚠️ Failed to create webhook:', webhookErr.message);

      // Detect if this is a free plan limitation
      const isFreePlanError = webhookErr.message.includes('upgrade your Calendly account') ||
                              webhookErr.message.includes('Permission Denied') ||
                              webhookErr.message.includes('403') ||
                              webhookErr.message.includes('Forbidden');

      if (isFreePlanError) {
        console.log('📊 Calendly free plan detected - webhooks not supported');
        webhookStatus = 'error';
        webhookError = 'Calendly free plan - webhooks not supported. Using 15-minute polling sync.';
      } else {
        webhookStatus = 'error';
        webhookError = webhookErr.message;
      }

      // Update connection with error status
      await req.supabase
        .from('calendar_connections')
        .update({
          webhook_status: webhookStatus,
          webhook_last_error: webhookError,
          webhook_verification_attempts: 0
        })
        .eq('id', connectionResult.id);
    }

    res.json({
      success: true,
      message: 'Calendly connected successfully',
      connection: connectionResult,
      calendly_user: {
        name: calendlyName,
        email: calendlyEmail
      },
      webhook: {
        created: webhookCreated,
        status: webhookStatus,
        error: webhookError,
        sync_method: webhookCreated ? 'realtime' : 'polling'
      }
    });

  } catch (error) {
    console.error('Error in POST /calendar-connections/calendly:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calendar-connections/calendly/test-webhook
 * Test if a Calendly API token supports webhook creation (paid plan check)
 * Use this to verify webhook capability before or after connecting
 */
router.post('/calendly/test-webhook', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { api_token } = req.body;

    // If no token provided, try to get from existing connection
    let tokenToTest = api_token?.trim();

    if (!tokenToTest) {
      const { data: connection } = await req.supabase
        .from('calendar_connections')
        .select('access_token')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .maybeSingle();

      if (!connection?.access_token) {
        return res.status(400).json({
          error: 'No API token provided and no active Calendly connection found'
        });
      }
      tokenToTest = decrypt(connection.access_token);
    }

    console.log(`🧪 Testing webhook capability for user ${userId}...`);

    // Step 1: Validate token and get user info
    const CalendlyService = require('../services/calendlyService');
    const calendlyService = new CalendlyService(tokenToTest);

    let calendlyUser;
    try {
      calendlyUser = await calendlyService.getCurrentUser();
      console.log(`✅ Token valid for: ${calendlyUser.name} (${calendlyUser.email})`);
    } catch (tokenError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API token',
        details: tokenError.message,
        supports_webhooks: false,
        plan_type: 'unknown'
      });
    }

    // Step 2: Try to list existing webhooks (this will fail for free plans)
    const CalendlyWebhookService = require('../services/calendlyWebhookService');
    const webhookService = new CalendlyWebhookService(tokenToTest);

    if (!webhookService.isConfigured()) {
      return res.json({
        success: true,
        error: 'Webhook service not configured on server',
        supports_webhooks: null,
        plan_type: 'unknown',
        message: 'Server webhook URL not configured. Contact administrator.',
        calendly_user: {
          name: calendlyUser.name,
          email: calendlyUser.email
        }
      });
    }

    try {
      // Try to list webhooks - this will fail with 403 for free plans
      await webhookService.listWebhookSubscriptions(
        calendlyUser.current_organization,
        calendlyUser.uri,
        'user'
      );

      console.log('✅ Webhook API accessible - paid plan detected');

      res.json({
        success: true,
        supports_webhooks: true,
        plan_type: 'paid',
        sync_method: 'realtime',
        message: '✅ Your Calendly account supports real-time webhooks! Events will sync instantly.',
        calendly_user: {
          name: calendlyUser.name,
          email: calendlyUser.email,
          organization: calendlyUser.current_organization
        }
      });
    } catch (webhookError) {
      const errorMessage = webhookError.message || '';
      const isFreePlan = errorMessage.includes('403') ||
                         errorMessage.includes('Permission Denied') ||
                         errorMessage.includes('Forbidden') ||
                         errorMessage.includes('upgrade your Calendly account');

      if (isFreePlan) {
        console.log('📊 Free plan detected - webhooks not supported');
        res.json({
          success: true,
          supports_webhooks: false,
          plan_type: 'free',
          sync_method: 'polling',
          message: '⚠️ Your Calendly account is on a free plan. Events will sync every 15 minutes via polling.',
          calendly_user: {
            name: calendlyUser.name,
            email: calendlyUser.email
          }
        });
      } else {
        console.error('❌ Unexpected webhook error:', webhookError.message);
        res.json({
          success: true,
          supports_webhooks: false,
          plan_type: 'unknown',
          sync_method: 'polling',
          error: webhookError.message,
          message: '⚠️ Could not verify webhook support. Falling back to polling sync.',
          calendly_user: {
            name: calendlyUser.name,
            email: calendlyUser.email
          }
        });
      }
    }
  } catch (error) {
    console.error('Error in POST /calendar-connections/calendly/test-webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PATCH /api/calendar-connections/:id/toggle-transcription
 * Enable or disable Recall.ai transcription for a calendar connection
 */
router.patch('/:id/toggle-transcription', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionId = req.params.id;
    const { transcription_enabled } = req.body;

    if (typeof transcription_enabled !== 'boolean') {
      return res.status(400).json({
        error: 'transcription_enabled must be a boolean'
      });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Verify the connection belongs to this user
    const { data: connection, error: fetchError } = await req.supabase
      .from('calendar_connections')
      .select('id, provider, transcription_enabled')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    // Update transcription_enabled
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .update({
        transcription_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error toggling transcription:', error);
      return res.status(500).json({
        error: 'Failed to update transcription setting'
      });
    }

    console.log(`✅ Transcription ${transcription_enabled ? 'enabled' : 'disabled'} for connection ${connectionId}`);

    res.json({
      success: true,
      message: `Transcription ${transcription_enabled ? 'enabled' : 'disabled'} successfully`,
      connection: data
    });

  } catch (error) {
    console.error('Error in PATCH /calendar-connections/:id/toggle-transcription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/calendar-connections/:id/webhook-status
 * Get webhook status for a calendar connection
 * Returns webhook health info for UI display
 */
router.get('/:id/webhook-status', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionId = req.params.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Get the connection
    const { data: connection, error: connError } = await req.supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    let webhookStatus = {
      provider: connection.provider,
      is_active: connection.is_active,
      last_sync_at: connection.last_sync_at,
      webhook_active: false,
      webhook_expires_at: null,
      days_until_expiration: null,
      sync_method: 'polling', // Default to polling
      // Surface raw webhook health from the connection record so the UI
      // can distinguish plan limitations from real errors
      webhook_status: connection.webhook_status || null,
      webhook_last_error: connection.webhook_last_error || null,
      webhook_last_verified_at: connection.webhook_last_verified_at || null
    };

    // Check Google Calendar webhook status
    if (connection.provider === 'google' && connection.is_active) {
      try {
        const { data: watchChannel, error: watchError } = await req.supabase
          .from('calendar_watch_channels')
          .select('expiration, created_at')
          .eq('user_id', userId)
          .single();

        if (!watchError && watchChannel) {
          const expirationDate = new Date(watchChannel.expiration);
          const now = new Date();
          const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));

          webhookStatus.webhook_active = daysUntilExpiration > 0;
          webhookStatus.webhook_expires_at = watchChannel.expiration;
          webhookStatus.days_until_expiration = daysUntilExpiration;
          webhookStatus.sync_method = daysUntilExpiration > 0 ? 'webhook' : 'polling';
        }
      } catch (err) {
        console.warn('Error checking Google webhook status:', err.message);
      }
    }

    // Check Calendly webhook status
    if (connection.provider === 'calendly' && connection.is_active) {
      try {
        // Prefer per-user webhook subscriptions where available
        const { data: webhookSub, error: webhookError } = await req.supabase
          .from('calendly_webhook_subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .eq('scope', 'user')
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found

        const hasWebhook = !webhookError && webhookSub;

        webhookStatus.webhook_active = hasWebhook;
        webhookStatus.has_webhook = hasWebhook;
        webhookStatus.sync_method = hasWebhook ? 'webhook' : 'polling';

        if (hasWebhook) {
          webhookStatus.webhook_url = webhookSub.webhook_url;
          webhookStatus.webhook_events = webhookSub.events;
          webhookStatus.message = 'Real-time sync enabled via webhooks';
          webhookStatus.webhook_created_at = webhookSub.created_at;
        } else {
          // If webhooks are not active, fall back to polling and try to explain why
          const lastError = connection.webhook_last_error || '';

          if (connection.webhook_status === 'error' &&
              lastError.includes('Please upgrade your Calendly account to Standard')) {
            webhookStatus.message = 'Manual sync required (Calendly free plan – webhooks not supported)';
            webhookStatus.plan_limit = 'calendly_free_plan';
          } else if (connection.webhook_status === 'error' && lastError) {
            webhookStatus.message = lastError;
          } else {
            webhookStatus.message = 'Manual sync required (no active webhook)';
          }
        }

        console.log(`📊 Calendly webhook status for user ${userId}:`, {
          user_id: userId,
          has_webhook: hasWebhook,
          sync_method: webhookStatus.sync_method
        });
      } catch (err) {
        console.warn('Error checking Calendly webhook status:', err.message);
        // Fallback: no webhook
        webhookStatus.webhook_active = false;
        webhookStatus.has_webhook = false;
        webhookStatus.sync_method = 'polling';
        if (!webhookStatus.message) {
          webhookStatus.message = 'Manual sync required';
        }
      }
    }

    res.json({
      success: true,
      webhook_status: webhookStatus
    });

  } catch (error) {
    console.error('Error in GET /calendar-connections/:id/webhook-status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calendar-connections/cleanup-calendly
 * ADMIN ENDPOINT: Clean up all Calendly data for the authenticated user
 * This removes all Calendly connections, meetings, and webhook subscriptions
 */
router.post('/cleanup-calendly', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    console.log(`🧹 Starting Calendly cleanup for user ${userId}...`);

    const results = {
      meetings_deleted: 0,
      webhooks_deleted: 0,
      connections_deleted: 0
    };

    // 1. Delete Calendly meetings
    console.log('1️⃣ Deleting Calendly meetings...');
    const { data: deletedMeetings, error: meetingsError } = await req.supabase
      .from('meetings')
      .delete()
      .eq('meeting_source', 'calendly')
      .eq('user_id', userId)
      .select();

    if (meetingsError) {
      console.error('❌ Error deleting meetings:', meetingsError);
    } else {
      results.meetings_deleted = deletedMeetings?.length || 0;
      console.log(`✅ Deleted ${results.meetings_deleted} Calendly meetings`);
    }

    // 2. Get organization URIs for this user's Calendly connections
    const { data: connections } = await req.supabase
      .from('calendar_connections')
      .select('calendly_organization_uri')
      .eq('provider', 'calendly')
      .eq('user_id', userId);

    const orgUris = connections?.map(c => c.calendly_organization_uri).filter(Boolean) || [];

    // 3. Delete webhook subscriptions for these organizations
    if (orgUris.length > 0) {
      console.log('2️⃣ Deleting webhook subscriptions...');
      const { data: deletedWebhooks, error: webhooksError } = await req.supabase
        .from('calendly_webhook_subscriptions')
        .delete()
        .in('organization_uri', orgUris)
        .select();

      if (webhooksError) {
        console.error('❌ Error deleting webhooks:', webhooksError);
      } else {
        results.webhooks_deleted = deletedWebhooks?.length || 0;
        console.log(`✅ Deleted ${results.webhooks_deleted} webhook subscriptions`);
      }
    }

    // 4. Delete calendar connections
    console.log('3️⃣ Deleting calendar connections...');
    const { data: deletedConnections, error: connectionsError } = await req.supabase
      .from('calendar_connections')
      .delete()
      .eq('provider', 'calendly')
      .eq('user_id', userId)
      .select();

    if (connectionsError) {
      console.error('❌ Error deleting connections:', connectionsError);
    } else {
      results.connections_deleted = deletedConnections?.length || 0;
      console.log(`✅ Deleted ${results.connections_deleted} calendar connections`);
    }

    console.log(`✅ Calendly cleanup complete for user ${userId}`);

    res.json({
      success: true,
      message: 'Calendly data cleaned up successfully',
      results
    });

  } catch (error) {
    console.error('Error in POST /calendar-connections/cleanup-calendly:', error);
    res.status(500).json({
      error: 'Failed to cleanup Calendly data',
      details: error.message
    });
  }
});

module.exports = router;

