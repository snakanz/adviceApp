require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { supabase, isSupabaseAvailable, getSupabase } = require('./lib/supabase');
const CalendlyService = require('./services/calendlyService');
const clientsRouter = require('./routes/clients');
const pipelineRouter = require('./routes/pipeline');
const actionItemsRouter = require('./routes/actionItems');
const routes = require('./routes/index');

const app = express();
app.use(cors({
  origin: ['https://adviceapp.pages.dev', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Test routes removed - using proper Calendly integration below

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

// Simple test endpoint
app.get('/api/test-simple', (req, res) => {
  res.json({ message: 'Simple test working!' });
});

// Calendly integration moved to routes.js for better reliability

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

    // Get meetings from DATABASE (includes Google Calendar, Calendly, and manual meetings)
    // This ensures we respect deletion detection and other database state
    const now = new Date();
    const timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months ago

    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .or('is_deleted.is.null,is_deleted.eq.false') // Show meetings where is_deleted is NULL or false
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

// Test endpoint to debug issues (v3)
app.get('/api/dev/test', (req, res) => {
  console.log('🧪 Test endpoint called v3');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend is working v3 - Fixed meetings query',
    version: '3.0'
  });
});

// Ultra simple meetings endpoint for debugging
app.get('/api/dev/meetings-simple', (req, res) => {
  console.log('🧪 Simple meetings endpoint called');
  res.json([
    {
      id: 1,
      title: 'Test Meeting',
      starttime: '2025-01-15T10:00:00Z',
      endtime: '2025-01-15T11:00:00Z',
      source: 'calendly'
    }
  ]);
});

// Auth status check endpoint
app.get('/api/dev/auth-status', (req, res) => {
  console.log('🔍 Auth status check called');
  const auth = req.headers.authorization;

  if (!auth) {
    return res.json({
      authenticated: false,
      message: 'No authorization header',
      hasToken: false
    });
  }

  try {
    const token = auth.split(' ')[1];
    if (!token) {
      return res.json({
        authenticated: false,
        message: 'No bearer token',
        hasToken: false
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({
      authenticated: true,
      message: 'Token valid',
      hasToken: true,
      userId: decoded.id,
      email: decoded.email
    });
  } catch (error) {
    return res.json({
      authenticated: false,
      message: `Token invalid: ${error.message}`,
      hasToken: true,
      error: error.message
    });
  }
});

// Meetings endpoint with auth and basic database query
app.get('/api/dev/meetings', async (req, res) => {
  console.log('🔄 Meetings endpoint called');
  const auth = req.headers.authorization;

  // TEMPORARY: Allow access without auth for debugging
  let userId = 1; // Default user ID for testing

  if (auth) {
    try {
      console.log('🔑 Verifying token...');
      const token = auth.split(' ')[1];
      if (token) {
        console.log(`🔍 Token preview: ${token.substring(0, 20)}...`);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        console.log(`✅ Token verified for user ${userId}`);
      }
    } catch (error) {
      console.log('⚠️ Token verification failed, using default user:', error.message);
      // Continue with default userId for debugging
    }
  } else {
    console.log('⚠️ No auth header, using default user for debugging');
  }

  try {

    // Check Supabase availability
    if (!isSupabaseAvailable()) {
      console.log('❌ Supabase not available');
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // TEMPORARILY DISABLED: Calendly sync causing 502 errors
    console.log('⚠️ Calendly sync temporarily disabled to fix 502 errors');
    // TODO: Debug and re-enable Calendly sync

    // Enhanced database query for meetings with core fields
    console.log('🔍 Querying database for meetings...');
    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select(`
        id,
        title,
        starttime,
        endtime,
        attendees,
        meeting_source,
        is_deleted,
        transcript,
        summary,
        quick_summary,
        email_summary_draft,
        created_at,
        updatedat,
        googleeventid,
        client_id,
        notes
      `)
      .eq('userid', userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false })
      .limit(500); // Increased limit to get all historical data

    if (error) {
      console.error('❌ Database query error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log(`✅ Query successful: ${meetings?.length || 0} meetings found`);

    // Process meetings data for frontend
    const processedMeetings = meetings?.map(meeting => ({
      ...meeting,
      // Map database column names to frontend expectations
      source: meeting.meeting_source, // Frontend expects 'source'
      // Ensure attendees is always an array
      attendees: Array.isArray(meeting.attendees) ? meeting.attendees :
                 typeof meeting.attendees === 'string' ? [meeting.attendees] : [],
      // Add computed fields
      hasTranscript: !!meeting.transcript,
      hasSummary: !!(meeting.summary || meeting.quick_summary || meeting.email_summary_draft),
      // Format dates for frontend
      starttime: meeting.starttime ? new Date(meeting.starttime).toISOString() : null,
      endtime: meeting.endtime ? new Date(meeting.endtime).toISOString() : null,
      // Add updated_at mapping
      updated_at: meeting.updatedat
    })) || [];

    res.json(processedMeetings);

  } catch (error) {
    console.error('❌ Error in meetings endpoint:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
});

// Manual Calendly sync endpoint for testing
app.post('/api/dev/sync-calendly', async (req, res) => {
  console.log('🔄 Manual Calendly sync endpoint called');
  const auth = req.headers.authorization;
  if (!auth) {
    console.log('❌ No auth header');
    return res.status(401).json({ error: 'No token' });
  }

  try {
    console.log('🔑 Verifying token...');
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    console.log(`✅ Token verified for user ${userId}`);

    // Check Supabase availability
    if (!isSupabaseAvailable()) {
      console.log('❌ Supabase not available');
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Sync Calendly meetings
    console.log('🔄 Starting manual Calendly sync...');
    const calendlyService = new CalendlyService();

    if (!calendlyService.isConfigured()) {
      console.log('⚠️ Calendly not configured');
      return res.status(400).json({
        error: 'Calendly not configured',
        message: 'CALENDLY_PERSONAL_ACCESS_TOKEN environment variable is required'
      });
    }

    console.log('✅ Calendly configured, syncing...');
    const result = await calendlyService.syncMeetingsToDatabase(userId);
    console.log('✅ Manual Calendly sync completed');

    res.json({
      success: true,
      message: 'Calendly sync completed successfully',
      result: result || 'Sync completed'
    });

  } catch (error) {
    console.error('❌ Error in manual Calendly sync:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Clients endpoint is now handled by the clients router (routes/clients.js)

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
    const { error: transcriptError } = await getSupabase()
      .from('meetings')
      .update({
        transcript: transcript,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (transcriptError) {
      console.error('Error saving transcript to database:', transcriptError);
      return res.status(500).json({ error: 'Failed to save transcript to database' });
    }

    // Auto-generate summaries if OpenAI is available and transcript is provided
    let summaries = null;
    if (transcript && transcript.trim()) {
      try {
        const { generateMeetingSummary, isOpenAIAvailable } = require('./services/openai');

        if (isOpenAIAvailable()) {
          // Generate Quick Summary (single sentence for Clients page)
          const quickSummaryPrompt = `# SYSTEM PROMPT: Advicly Quick Summary Generator
You are an expert financial advisor creating a single-sentence summary of a client meeting.

Generate ONE concise sentence that captures what was discussed in the meeting. Focus on the main topic or purpose of the meeting.

Examples:
- "Discussed client's retirement planning goals and reviewed current 401k allocation."
- "Reviewed portfolio performance and explored ESG investment opportunities."
- "Initial consultation covering financial goals, risk tolerance, and investment preferences."

Transcript:
${transcript}

Respond with ONLY the single sentence summary, no additional text.`;

          const quickSummary = await generateMeetingSummary(transcript, 'standard', { prompt: quickSummaryPrompt });

          // Generate Detailed Summary (structured format for Meetings page)
          const detailedSummaryPrompt = `# SYSTEM PROMPT: Advicly Detailed Summary Generator
You are an expert financial advisor creating a structured summary of a client meeting.

Generate a summary in this exact format:

[Single sentence overview of what was discussed]

**Key Points Discussed:**
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3 if applicable]

**Important Decisions or Outcomes:**
[Brief description of any decisions made or outcomes reached]

**Next Steps:**
[What will happen next or action items]

Keep it professional and concise. Use the exact format shown above.

Transcript:
${transcript}`;

          const detailedSummary = await generateMeetingSummary(transcript, 'standard', { prompt: detailedSummaryPrompt });

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

          // Generate action points
          const actionPointsPrompt = `Extract key action items from this meeting transcript that the user (financial advisor) needs to complete or follow up on.

Focus on:
• Tasks the advisor committed to doing
• Follow-up actions required
• Documents to prepare or send
• Meetings to schedule
• Research to conduct
• Client requests to fulfill

Format as a clean, scannable list. Be specific and actionable. If no clear action items exist, respond with "No specific action items identified."

Transcript:
${transcript}`;

          const actionPoints = await generateMeetingSummary(transcript, 'standard', { prompt: actionPointsPrompt });

          // Save summaries to database
          const { error: updateError } = await getSupabase()
            .from('meetings')
            .update({
              quick_summary: quickSummary,           // Single sentence for Clients page
              email_summary_draft: emailSummary,     // Email format
              action_points: actionPoints,           // Action items for user
              email_template_id: 'auto-template',
              last_summarized_at: new Date().toISOString(),
              updatedat: new Date().toISOString()
            })
            .eq('googleeventid', meetingId)
            .eq('userid', userId);

          if (updateError) {
            console.error('Error saving summaries to database:', updateError);
            throw new Error('Failed to save summaries to database');
          }

          console.log('✅ Successfully saved summaries to database for meeting:', meetingId);
          console.log('Quick summary length:', quickSummary?.length || 0);
          console.log('Detailed summary length:', detailedSummary?.length || 0);

          summaries = {
            quickSummary,                    // Single sentence for Clients page (saved to DB)
            detailedSummary,                 // Structured format for Meetings page (not saved to DB yet)
            emailSummary,                    // Email format (saved to DB)
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

    console.log('🗑️  Deleting transcript for meeting:', meetingId, 'user:', userId);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    const { error: deleteError } = await getSupabase()
      .from('meetings')
      .update({
        transcript: null,
        quick_summary: null,
        email_summary_draft: null,
        email_template_id: null,
        last_summarized_at: null,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (deleteError) {
      console.error('Error deleting transcript from database:', deleteError);
      return res.status(500).json({ error: 'Failed to delete transcript from database' });
    }

    console.log('✅ Successfully deleted transcript and summaries for meeting:', meetingId);
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

    // Generate Brief Summary (for Clients page)
    const briefSummaryPrompt = `# SYSTEM PROMPT: Advicly Brief Summary Generator
You are an expert financial advisor creating a single-sentence summary of a client meeting.

Generate ONE concise sentence that captures what was discussed in the meeting. Focus on the main topic or purpose of the meeting.

Examples:
- "Discussed client's retirement planning goals and reviewed current 401k allocation."
- "Reviewed portfolio performance and explored ESG investment opportunities."
- "Initial consultation covering financial goals, risk tolerance, and investment preferences."

Transcript:
${meeting.transcript}

Respond with ONLY the single sentence summary, no additional text.`;

    const briefSummary = await generateMeetingSummary(meeting.transcript, 'standard', { prompt: briefSummaryPrompt });

    // Generate Detailed Summary (for Meetings page)
    const detailedSummaryPrompt = `# SYSTEM PROMPT: Advicly Detailed Summary Generator
You are an expert financial advisor creating a structured summary of a client meeting.

Generate a summary in this exact format:

[Single sentence overview of what was discussed]

**Key Points Discussed:**
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3 if applicable]

**Important Decisions or Outcomes:**
[Brief description of any decisions made or outcomes reached]

**Next Steps:**
[What will happen next or action items]

Keep it professional and concise. Use the exact format shown above.

Transcript:
${meeting.transcript}`;

    const detailedSummary = await generateMeetingSummary(meeting.transcript, 'standard', { prompt: detailedSummaryPrompt });

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
        brief_summary: briefSummary,
        quick_summary: detailedSummary,
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
      briefSummary,
      quickSummary: detailedSummary,
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

// Mount Data Import routes
try {
  console.log('Mounting Data Import routes...');
  const dataImportRouter = require('./routes/dataImport');
  app.use('/api/data-import', dataImportRouter);
  console.log('Data Import routes mounted successfully');
} catch (error) {
  console.warn('Failed to mount Data Import routes:', error.message);
}

// Duplicate Calendly routes removed - using proper integration above

// Mount auth routes
console.log('🔄 Mounting auth routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('✅ Auth routes mounted');

app.use('/api/clients', clientsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/action-items', actionItemsRouter);
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/notifications', require('./routes/notifications'));
console.log('🔄 Mounting main routes at /api...');
app.use('/api', routes);
console.log('✅ Main routes mounted at /api');

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
}); 