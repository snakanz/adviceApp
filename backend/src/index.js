require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { supabase, isSupabaseAvailable, getSupabase } = require('./lib/supabase');
const clientsRouter = require('./routes/clients');
const pipelineRouter = require('./routes/pipeline');
const routes = require('./routes/index');

const app = express();
app.use(cors({
  origin: ['https://adviceapp.pages.dev', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Health check with database connectivity - Updated for deployment
app.get('/api/health', async (req, res) => {
  try {
    let dbStatus = false;
    let dbError = null;

    if (isSupabaseAvailable()) {
      try {
        // Test Supabase connection with a simple query
        const { data, error } = await supabase
          .from('users')
          .select('count')
          .limit(1);

        dbStatus = !error;
        if (error) {
          dbError = error.message;
        }
      } catch (error) {
        dbStatus = false;
        dbError = error.message;
      }
    } else {
      dbError = 'Supabase not configured';
    }

    const response = {
      status: 'ok',
      db: dbStatus ? 'connected' : 'disconnected',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString()
    };

    if (dbError) {
      response.dbError = dbError;
    }

    res.json(response);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      version: process.env.npm_package_version || '1.0.0',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Google OAuth routes moved to /routes/auth.js

// Google OAuth callback moved to /routes/auth.js

// JWT-protected route example
app.get('/api/protected', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    console.log('Verifying JWT with secret:', process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ message: 'Protected data', user: decoded });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Auth verify endpoint moved to /routes/auth.js

// Reconnect Google endpoint - forces re-authentication
app.get('/api/auth/reconnect-google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // This forces re-consent
  });
  res.json({ url });
});

app.get('/api/calendar/meetings/all', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Get meetings from DATABASE (not Google Calendar directly)
    // This ensures we respect deletion detection and other database state
    const now = new Date();
    const timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months ago

    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .or('is_deleted.is.null,is_deleted.eq.false') // 🔥 FIXED: Show meetings where is_deleted is NULL or false
      .gte('starttime', timeMin.toISOString())
      .order('starttime', { ascending: true });

    if (error) {
      console.error('Error fetching meetings from database:', error);
      return res.status(500).json({ error: 'Failed to fetch meetings from database' });
    }

    // Group into past and future
    const past = [];
    const future = [];

    for (const meeting of meetings || []) {
      if (!meeting.starttime) continue;

      const eventStart = new Date(meeting.starttime);
      const eventEnd = meeting.endtime ? new Date(meeting.endtime) : null;

      const processedEvent = {
        id: meeting.googleeventid,
        summary: meeting.title || 'Untitled Meeting',
        start: { dateTime: meeting.starttime },
        end: meeting.endtime ? { dateTime: meeting.endtime } : null,
        description: meeting.summary || '',
        location: meeting.location || '',
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
        transcript: meeting.transcript,
        quickSummary: meeting.quick_summary,
        emailSummary: meeting.email_summary_draft,
        templateId: meeting.email_template_id,
        lastSummarizedAt: meeting.last_summarized_at,
        meetingSummary: meeting.quick_summary // For compatibility with frontend
      };

      if (eventEnd && eventEnd < now) {
        past.push(processedEvent);
      } else {
        future.push(processedEvent);
      }
    }

    res.json({ past, future });
  } catch (error) {
    console.error('Error fetching or saving meetings:', error);
    res.status(500).json({ error: 'Failed to fetch or save meetings' });
  }
});

// New deletion-aware calendar sync endpoint
app.post('/api/calendar/sync-with-deletions', async (req, res) => {
  console.log('🔄 Sync-with-deletions endpoint called');
  console.log('📋 Request headers:', {
    authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'MISSING',
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent']
  });

  const auth = req.headers.authorization;
  if (!auth) {
    console.error('❌ No authorization header provided');
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    const token = auth.split(' ')[1];
    if (!token) {
      console.error('❌ Malformed authorization header');
      return res.status(401).json({ error: 'Malformed authorization header' });
    }

    console.log('🔐 Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId; // Handle both formats

    if (!userId) {
      console.error('❌ No user ID found in JWT token:', decoded);
      return res.status(401).json({ error: 'Invalid token: no user ID' });
    }

    console.log(`✅ JWT verified successfully for user ${userId}`);
    console.log(`🔄 Starting calendar sync for user ${userId}...`);

    try {
      const calendarSync = require('./services/calendarSync');
      const results = await calendarSync.syncUserCalendar(userId, {
        timeRange: 'extended' // 6 months for comprehensive sync
      });

      console.log(`✅ Calendar sync completed successfully:`, {
        userId,
        added: results.added || 0,
        updated: results.updated || 0,
        deleted: results.deleted || 0
      });

      res.json({
        message: 'Calendar synced with deletion detection',
        results,
        userId // Include for debugging
      });
    } catch (syncError) {
      console.error('❌ Calendar sync service error:', {
        userId,
        error: syncError.message,
        stack: syncError.stack
      });

      // Return specific error messages based on the error type
      if (syncError.message.includes('No calendar token found')) {
        return res.status(401).json({
          error: 'Google Calendar not connected',
          details: 'Please reconnect your Google Calendar account',
          action: 'reconnect_calendar'
        });
      } else if (syncError.message.includes('token expired')) {
        return res.status(401).json({
          error: 'Google Calendar token expired',
          details: 'Please reconnect your Google Calendar account',
          action: 'reconnect_calendar'
        });
      } else {
        return res.status(503).json({
          error: 'Calendar sync service temporarily unavailable',
          details: syncError.message
        });
      }
    }
  } catch (jwtError) {
    console.error('❌ JWT verification failed:', {
      error: jwtError.message,
      name: jwtError.name
    });

    if (jwtError.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        details: 'Please log in again'
      });
    } else if (jwtError.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        details: 'Please log in again'
      });
    } else {
      return res.status(500).json({
        error: 'Authentication error',
        details: jwtError.message
      });
    }
  }
});

// Comprehensive calendar sync endpoint
app.post('/api/calendar/sync-comprehensive', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    console.log(`🔄 Starting comprehensive calendar sync for user ${userId}`);

    const comprehensiveSync = require('./services/comprehensiveCalendarSync');
    const dryRun = req.body.dryRun || false;

    const results = await comprehensiveSync.reconcileCalendarData(userId, dryRun);

    console.log(`✅ Comprehensive sync completed:`, results);
    res.json({
      success: true,
      message: `Comprehensive calendar sync ${dryRun ? '(dry run) ' : ''}completed`,
      results,
      dryRun
    });
  } catch (error) {
    console.error('Comprehensive calendar sync error:', error);
    res.status(500).json({ error: 'Failed to perform comprehensive calendar sync' });
  }
});

// Calendar sync status endpoint
app.get('/api/calendar/sync-status', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const comprehensiveSync = require('./services/comprehensiveCalendarSync');
    const status = await comprehensiveSync.getSyncStatus(userId);

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// 🔥 NEW: Database-only meetings endpoint (simplified with better error handling)
app.get('/api/dev/meetings', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    console.log(`📅 Fetching meetings from database for user ${userId}`);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available');
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Start with the most basic query possible
    console.log('🔍 Attempting basic meetings query...');
    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .order('starttime', { ascending: false });

    if (error) {
      console.error('❌ Database query error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        error: 'Database query failed',
        details: error.message
      });
    }

    console.log(`✅ Found ${meetings?.length || 0} meetings in database`);

    // Return the meetings data
    res.json(meetings || []);

  } catch (error) {
    console.error('❌ Unexpected error in meetings endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 🔥 NEW: Enhanced clients endpoint with activity status (with fallback)
app.get('/api/clients', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    console.log(`👥 Fetching clients with activity status for user ${userId}`);

    // Try enhanced query first, fallback to basic if columns don't exist
    let clients, error;

    try {
      // Try enhanced query with new columns
      const result = await getSupabase()
        .from('clients')
        .select(`
          *,
          meeting_count,
          active_meeting_count,
          is_active,
          last_meeting_date
        `)
        .eq('advisor_id', userId)
        .order('is_active', { ascending: false })
        .order('last_meeting_date', { ascending: false, nullsFirst: false });

      clients = result.data;
      error = result.error;
    } catch (enhancedError) {
      console.log('Enhanced query failed, falling back to basic query');

      // Fallback to basic query without new columns
      const result = await getSupabase()
        .from('clients')
        .select('*')
        .eq('advisor_id', userId)
        .order('created_at', { ascending: false });

      clients = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    // Add computed status field (with fallbacks for missing columns)
    const enhancedClients = (clients || []).map(client => ({
      ...client,
      // Use new columns if available, otherwise default values
      is_active: client.is_active !== undefined ? client.is_active : false,
      meeting_count: client.meeting_count || 0,
      active_meeting_count: client.active_meeting_count || 0,
      status: (client.is_active !== undefined ? client.is_active : false) ? 'Active' :
              ((client.meeting_count || 0) > 0 ? 'Historical' : 'No Meetings'),
      displayStatus: (client.is_active !== undefined ? client.is_active : false) ? 'active' : 'historical'
    }));

    console.log(`✅ Found ${enhancedClients.length} clients (${enhancedClients.filter(c => c.is_active).length} active)`);

    res.json(enhancedClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Transcript upload endpoint
app.post('/api/calendar/meetings/:id/transcript', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const meetingId = req.params.id;
    const { transcript } = req.body;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Update the transcript for the meeting
    await getSupabase()
      .from('meetings')
      .update({
        transcript: transcript,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    // Auto-generate summaries if OpenAI is available and transcript is provided
    let summaries = null;
    if (transcript && transcript.trim()) {
      try {
        const { generateMeetingSummary, isOpenAIAvailable } = require('./services/openai');

        if (isOpenAIAvailable()) {
          // Generate Quick Summary
          const quickSummaryPrompt = `# SYSTEM PROMPT: Advicly Quick Summary Generator
You are an expert financial advisor creating a concise summary of a client meeting. Your role is to generate a **brief, accurate summary based ONLY on the provided transcript**.

Create a quick summary that includes:
• Meeting overview (2-3 sentences)
• Key points discussed
• Important decisions or outcomes
• Next steps if any

Keep it concise and professional.

Transcript:
${transcript}`;

          const quickSummary = await generateMeetingSummary(transcript, 'standard', { prompt: quickSummaryPrompt });

          // Generate Email Summary using Auto template
          const autoTemplate = `# SYSTEM PROMPT: Advicly Auto Email Generator
You are an expert financial advisor drafting a professional email for a client immediately after a meeting. Your role is to generate a **clear, accurate summary email based ONLY on the provided transcript**.

Create a professional email summary that includes:
• Meeting overview
• Key points discussed
• Decisions made
• Next steps
• Action items

Keep it professional and client-friendly.

Transcript:
${transcript}

Respond with the **email body only** — no headers or subject lines.`;

          const emailSummary = await generateMeetingSummary(transcript, 'standard', { prompt: autoTemplate });

          // Save summaries to database
          await getSupabase()
            .from('meetings')
            .update({
              quick_summary: quickSummary,
              email_summary_draft: emailSummary,
              email_template_id: 'auto-template',
              last_summarized_at: new Date().toISOString(),
              updatedat: new Date().toISOString()
            })
            .eq('googleeventid', meetingId)
            .eq('userid', userId);

          summaries = {
            quickSummary,
            emailSummary,
            templateId: 'auto-template',
            lastSummarizedAt: new Date().toISOString()
          };
        }
      } catch (summaryError) {
        console.error('Error auto-generating summaries:', summaryError);
        // Don't fail the transcript upload if summary generation fails
      }
    }

    res.json({
      success: true,
      transcript,
      summaries: summaries || null,
      autoGenerated: !!summaries
    });
  } catch (error) {
    console.error('Transcript upload error:', error);
    res.status(500).json({ error: 'Failed to upload transcript' });
  }
});

// DELETE transcript endpoint
app.delete('/api/calendar/meetings/:id/transcript', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const meetingId = req.params.id;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    await getSupabase()
      .from('meetings')
      .update({
        transcript: null,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Transcript delete error:', error);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});

// POST /api/meetings/:meetingId/summary - generate/update AI summary for a meeting
app.post('/api/meetings/:meetingId/summary', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const meetingId = req.params.meetingId;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Get meeting from database
    const { data: meeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Import OpenAI service
    const { generateMeetingSummary, isOpenAIAvailable } = require('./services/openai');

    // Check if OpenAI is available
    if (!isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    // Generate Quick Summary
    const quickSummaryPrompt = `# SYSTEM PROMPT: Advicly Quick Summary Generator
You are an expert financial advisor creating a concise summary of a client meeting. Your role is to generate a **brief, accurate summary based ONLY on the provided transcript**.

Create a quick summary that includes:
• Meeting overview (2-3 sentences)
• Key points discussed
• Important decisions or outcomes
• Next steps if any

Keep it concise and professional.

Transcript:
${meeting.transcript}`;

    const quickSummary = await generateMeetingSummary(meeting.transcript, 'standard', { prompt: quickSummaryPrompt });

    // Generate Email Summary using Auto template
    const autoTemplate = `# SYSTEM PROMPT: Advicly Auto Email Generator
You are an expert financial advisor drafting a professional email for a client immediately after a meeting. Your role is to generate a **clear, accurate summary email based ONLY on the provided transcript**.

Create a professional email summary that includes:
• Meeting overview
• Key points discussed
• Decisions made
• Next steps
• Action items

Keep it professional and client-friendly.

Transcript:
${meeting.transcript}

Respond with the **email body only** — no headers or subject lines.`;

    const emailSummary = await generateMeetingSummary(meeting.transcript, 'standard', { prompt: autoTemplate });

    // Save summaries to database
    const { error: updateError } = await getSupabase()
      .from('meetings')
      .update({
        quick_summary: quickSummary,
        email_summary_draft: emailSummary,
        email_template_id: 'auto-template',
        last_summarized_at: new Date().toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (updateError) {
      console.error('Error saving summaries:', updateError);
      return res.status(500).json({ error: 'Failed to save summaries' });
    }

    res.json({
      success: true,
      quickSummary,
      emailSummary,
      templateId: 'auto-template',
      lastSummarizedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({ error: 'Failed to generate meeting summary' });
  }
});

// Test route directly in main app
app.get('/test-advicly', (req, res) => {
  console.log('Direct test route hit!');
  res.json({ message: 'Direct route working!' });
});

// Mount Ask Advicly routes FIRST (before general /api routes)
try {
  console.log('Mounting Ask Advicly routes...');
  const askAdviclyRouter = require('./routes/ask-advicly');
  app.use('/api/ask-advicly', askAdviclyRouter);  // Fixed path to match frontend
  console.log('Ask Advicly routes mounted successfully');
} catch (error) {
  console.warn('Failed to mount Ask Advicly routes:', error.message);
}

// Mount Recall V2 routes
try {
  console.log('Mounting Recall V2 routes...');
  const recallWebhooksRouter = require('./routes/recall-webhooks');
  const recallCalendarRouter = require('./routes/recall-calendar');
  app.use('/api/webhooks', recallWebhooksRouter);
  app.use('/api/recall', recallCalendarRouter);
  console.log('Recall V2 routes mounted successfully');
} catch (error) {
  console.warn('Failed to mount Recall V2 routes:', error.message);
}

app.use('/api/clients', clientsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api', routes);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
}); 