const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * GET /api/calendar-connections
 * List all calendar connections for the authenticated user
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
        console.log('✅ Webhook stopped');
      } catch (webhookError) {
        console.warn('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
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
          const CalendarSyncService = require('../services/calendarSync');
          const syncService = new CalendarSyncService();

          // Don't await - let it run in background
          syncService.syncUserCalendar(userId, {
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

      // Calendly: Trigger background sync
      if (data.provider === 'calendly') {
        try {
          console.log('🔄 Triggering Calendly sync in background...');
          const CalendlyService = require('../services/calendlyService');
          const calendlyService = new CalendlyService(data.access_token);

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

    // If disabling Google Calendar, stop the webhook
    if (!sync_enabled && data.provider === 'google') {
      try {
        console.log('🛑 Stopping Google Calendar webhook...');
        const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
        const webhookService = new GoogleCalendarWebhookService();

        webhookService.stopCalendarWatch(userId).catch(err => {
          console.warn('⚠️ Webhook cleanup failed (non-fatal):', err.message);
        });
      } catch (err) {
        console.warn('⚠️ Failed to stop webhook:', err.message);
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

    // Remove the placeholder state - frontend will add the real one
    const baseUrl = authUrl.replace('state=placeholder', '');

    res.json({ url: baseUrl });
  } catch (error) {
    console.error('Error generating Calendly auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * POST /api/calendar-connections/calendly
 * Connect a Calendly account (via API token)
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

    // Get user's email
    const { data: userData, error: userError } = await req.supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error getting user data:', userError);
      return res.status(500).json({
        error: 'Failed to fetch user data'
      });
    }

    // TODO: Validate the Calendly API token by making a test API call
    // For now, we'll just store it

    // Check if Calendly connection already exists
    const { data: existingConnection } = await req.supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .single();

    if (existingConnection) {
      // Update existing connection
      const { data, error } = await req.supabase
        .from('calendar_connections')
        .update({
          access_token: api_token,
          is_active: true,
          updated_at: new Date().toISOString()
        })
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

      return res.json({
        success: true,
        message: 'Calendly connection updated successfully',
        connection: data
      });
    }

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

    // Deactivate all other active connections (single active connection per user)
    console.log(`🔄 Deactivating other active calendar connections for user ${userId}...`);
    const { error: deactivateError } = await req.supabase
      .from('calendar_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      console.warn(`Warning: Could not deactivate other connections for user ${userId}:`, deactivateError);
    } else {
      console.log(`✅ Other connections deactivated for user ${userId}`);
    }

    // Create new Calendly connection
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .insert({
        user_id: userId,
        tenant_id: user.tenant_id,
        provider: 'calendly',
        access_token: api_token,
        is_active: true
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

    // Trigger automatic sync in background
    try {
      console.log('🔄 Triggering initial Calendly sync in background...');
      const CalendlyService = require('../services/calendlyService');
      const calendlyService = new CalendlyService(api_token);

      // Don't await - let it run in background
      calendlyService.syncMeetingsToDatabase(userId).then(syncResult => {
        console.log('✅ Initial Calendly sync completed:', syncResult);
      }).catch(syncErr => {
        console.warn('⚠️ Initial Calendly sync failed (non-fatal):', syncErr.message);
      });
    } catch (syncErr) {
      console.warn('⚠️ Failed to start initial Calendly sync:', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Calendly connected successfully',
      connection: data
    });

  } catch (error) {
    console.error('Error in POST /calendar-connections/calendly:', error);
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
      sync_method: 'polling' // Default to polling
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
      // Calendly webhook is configured at organization level via environment variable
      const hasCalendlyWebhookKey = !!process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
      webhookStatus.webhook_active = hasCalendlyWebhookKey;
      webhookStatus.sync_method = hasCalendlyWebhookKey ? 'webhook' : 'polling';
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

module.exports = router;

