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

// Sync Calendly meetings
router.post('/sync', authenticateUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const calendlyService = new CalendlyService();
    const result = await calendlyService.syncMeetingsToDatabase(req.user.id);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error syncing Calendly meetings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync Calendly meetings',
      details: error.message 
    });
  }
});

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
