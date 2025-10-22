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
      .select('id, provider, is_primary')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({
        error: 'Calendar connection not found'
      });
    }

    // Check if this is the primary calendar
    if (connection.is_primary) {
      // Check if there are other connections
      const { data: otherConnections } = await req.supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', userId)
        .neq('id', connectionId);

      if (otherConnections && otherConnections.length > 0) {
        // Set another connection as primary
        await req.supabase
          .from('calendar_connections')
          .update({ is_primary: true })
          .eq('id', otherConnections[0].id);
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

    // Update the sync_enabled flag
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .update({
        sync_enabled,
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
 * Set a calendar connection as the primary calendar
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

    // First, set all other connections to non-primary
    await req.supabase
      .from('calendar_connections')
      .update({ is_primary: false })
      .eq('user_id', userId);

    // Then set this connection as primary
    const { data, error } = await req.supabase
      .from('calendar_connections')
      .update({
        is_primary: true,
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
 * POST /api/calendar-connections/calendly
 * Connect a Calendly account
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

    // Get user's tenant_id (optional - for backwards compatibility)
    const { data: userData, error: userError } = await req.supabase
      .from('users')
      .select('tenant_id, email')
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
          sync_enabled: true,
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
        tenant_id: userData.tenant_id || null, // Allow null for backwards compatibility
        provider: 'calendly',
        provider_account_email: userData.email,
        access_token: api_token,
        is_primary: true,
        is_active: true,
        sync_enabled: true
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

module.exports = router;

