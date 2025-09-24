const express = require('express');
const jwt = require('jsonwebtoken');
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

module.exports = router;
