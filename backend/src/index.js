require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { supabase, isSupabaseAvailable, getSupabase, verifySupabaseToken } = require('./lib/supabase');
const CalendlyService = require('./services/calendlyService');

// Load route modules with error handling to identify problematic routes
let clientsRouter, pipelineRouter, actionItemsRouter;

try {
  console.log('Loading clients router...');
  clientsRouter = require('./routes/clients');
  console.log('✅ Clients router loaded');
} catch (error) {
  console.error('❌ Error loading clients router:', error.message);
  throw error;
}

try {
  console.log('Loading pipeline router...');
  pipelineRouter = require('./routes/pipeline');
  console.log('✅ Pipeline router loaded');
} catch (error) {
  console.error('❌ Error loading pipeline router:', error.message);
  throw error;
}

try {
  console.log('Loading actionItems router...');
  actionItemsRouter = require('./routes/actionItems');
  console.log('✅ ActionItems router loaded');
} catch (error) {
  console.error('❌ Error loading actionItems router:', error.message);
  throw error;
}

// DISABLED: Not using routes/index.js anymore - routes are mounted directly
// const routes = require('./routes/index');

console.log('Creating Express app...');
const app = express();
console.log('✅ Express app created');

// CORS configuration - Allow Cloudflare Pages and localhost
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://adviceapp.pages.dev',
      'https://adviceapp-pages.dev',  // Current Cloudflare Pages URL
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    // Allow all Cloudflare Pages preview URLs (*.pages.dev)
    if (origin.endsWith('.pages.dev') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

console.log('Setting up CORS...');
app.use(cors(corsOptions));

// CRITICAL: Mount webhook routes BEFORE express.json() middleware
// This ensures the raw body is available for signature verification
try {
  console.log('Mounting Recall V2 webhook routes (BEFORE JSON middleware)...');
  const recallWebhooksRouter = require('./routes/recall-webhooks');
  app.use('/api/webhooks', recallWebhooksRouter);
  console.log('✅ Recall V2 webhook routes mounted successfully');
} catch (error) {
  console.warn('Failed to mount Recall V2 webhook routes:', error.message);
}

// Mount Stripe webhook route BEFORE express.json() middleware
// Stripe webhooks need raw body for signature verification
try {
  console.log('Mounting Stripe webhook route (BEFORE JSON middleware)...');
  const stripeWebhookRouter = require('./routes/stripe-webhook');
  app.use('/api/billing/webhook', stripeWebhookRouter);
  console.log('✅ Stripe webhook route mounted successfully');
} catch (error) {
  console.warn('Failed to mount Stripe webhook route:', error.message);
}

// ✅ FIX #2: Mount Calendly webhook route BEFORE express.json() middleware
// Calendly webhooks need raw body for HMAC signature verification
try {
  console.log('Mounting Calendly webhook route (BEFORE JSON middleware)...');
  const calendlyWebhookRouter = require('./routes/calendly-webhook');
  app.use('/api/calendly/webhook', calendlyWebhookRouter);
  console.log('✅ Calendly webhook route mounted successfully');
} catch (error) {
  console.warn('Failed to mount Calendly webhook route:', error.message);
}

app.use(express.json());
console.log('✅ CORS and middleware configured');

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});
console.log('✅ Request logging middleware added');

// Test routes removed - using proper Calendly integration below

console.log('Setting up Google OAuth2...');
// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
console.log('✅ Google OAuth2 configured');

console.log('Defining inline routes...');
// Health check with database connectivity
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
    // Get all meetings without time filter to show historical Calendly meetings
    // Frontend will handle grouping/pagination as needed

    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .or('is_deleted.is.null,is_deleted.eq.false') // Show meetings where is_deleted is NULL or false
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
        // Use database id for all meetings, keep googleeventid for backwards compatibility
        id: meeting.id,
        googleEventId: meeting.googleeventid,
        externalId: meeting.external_id,
        meetingSource: meeting.meeting_source || 'google',
        summary: meeting.title || 'Untitled Meeting',
        start: { dateTime: meeting.starttime },
        end: meeting.endtime ? { dateTime: meeting.endtime } : null,
        startTime: meeting.starttime, // Also include as startTime for Calendly compatibility
        description: meeting.summary || '',
        location: meeting.location || '',
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
        transcript: meeting.transcript,
        quickSummary: meeting.quick_summary,
        emailSummary: meeting.email_summary_draft,
        templateId: meeting.email_template_id,
        lastSummarizedAt: meeting.last_summarized_at,
        meetingSummary: meeting.quick_summary, // For compatibility with frontend
        client_id: meeting.client_id
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

// Test endpoint to debug issues (v4 - CORS fix)
app.get('/api/dev/test', (req, res) => {
  console.log('🧪 Test endpoint called v5');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend is working v5 - JWT decode fix',
    version: '5.0',
    cors: {
      origin: req.headers.origin || 'none',
      allowedOrigins: [
        'https://adviceapp.pages.dev',
        'https://adviceapp-pages.dev',
        'http://localhost:3000',
        'http://localhost:3001'
      ]
    }
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
  console.log('📋 Request origin:', req.headers.origin || 'none');
  console.log('📋 Request headers:', {
    authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'MISSING',
    contentType: req.headers['content-type'],
    origin: req.headers.origin
  });

  try {
    // Check Supabase availability
    if (!isSupabaseAvailable()) {
      console.log('❌ Supabase not available');
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const auth = req.headers.authorization;
    if (!auth) {
      console.log('❌ No authorization header');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = auth.split(' ')[1];
    if (!token) {
      console.log('❌ No token in authorization header');
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    console.log('🔑 Verifying Supabase token...');
    console.log(`🔍 Token preview: ${token.substring(0, 20)}...`);

    // Use the new verification function
    const { user, error: authError } = await verifySupabaseToken(token);

    if (authError || !user) {
      console.log('❌ Token verification failed:', authError?.message || 'No user found');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log(`✅ Token verified for Supabase user: ${user.id} (${user.email})`);

    // Use the Supabase user ID directly (UUID)
    const userId = user.id;
    console.log(`✅ Using Supabase user ID: ${userId}`);

    // Database query with client information
    console.log('🔍 Querying database for meetings with client info...');
    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select(`
        id,
        title,
        starttime,
        endtime,
        description,
        external_id,
        attendees,
        transcript,
        quick_summary,
        detailed_summary,
        email_summary_draft,
        email_template_id,
        last_summarized_at,
        action_points,
        meeting_source,
        client_id,
        recall_bot_id,
        recall_status,
        recall_recording_id,
        skip_transcription_for_meeting,
        clients(id, name, email)
      `)
      .eq('user_id', userId)
      .or('is_deleted.is.null,is_deleted.eq.false') // Show meetings where is_deleted is NULL or false
      .order('starttime', { ascending: false });

    if (error) {
      console.error('❌ Database query error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log(`✅ Query successful: ${meetings?.length || 0} meetings found`);

    // Process meetings data for frontend with all necessary fields
    const processedMeetings = meetings?.map(meeting => ({
      ...meeting,
      // Set default values and flags
      source: meeting.meeting_source || 'google',
      hasTranscript: !!meeting.transcript,
      hasSummary: !!meeting.quick_summary || !!meeting.detailed_summary,
      hasEmailDraft: !!meeting.email_summary_draft,
      // Client info is already included from the join
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

    // Fetch user's Calendly access token
    const accessToken = await CalendlyService.getUserAccessToken(userId);

    if (!accessToken) {
      console.log('⚠️ No Calendly connection found for user');
      return res.status(400).json({
        error: 'Calendly not connected',
        message: 'Please connect your Calendly account in Settings first'
      });
    }

    const calendlyService = new CalendlyService(accessToken);
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

// DEPRECATED: Transcript upload endpoint moved to backend/src/routes/calendar.js
// The new endpoint uses proper Supabase Auth verification and correct schema
// Old endpoint removed - see git history for reference

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

    // Get meeting from database with client information
    const { data: meeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select(`
        *,
        client:clients(id, name, email)
      `)
      .eq('external_id', meetingId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Extract client information for email personalization
    let clientName = 'Client';
    let clientEmail = null;

    if (meeting.client) {
      clientName = meeting.client.name || meeting.client.email.split('@')[0];
      clientEmail = meeting.client.email;
    } else if (meeting.attendees) {
      try {
        const attendees = JSON.parse(meeting.attendees);
        const clientAttendee = attendees.find(a => a.email && a.email !== decoded.email);
        if (clientAttendee) {
          clientName = clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0];
          clientEmail = clientAttendee.email;
        }
      } catch (e) {
        // Ignore parsing errors
      }
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

    // Generate Email Summary using Auto template with client name
    const autoTemplate = `Role: You are a professional, helpful, and concise financial advisor's assistant (Nelson Greenwood) tasked with creating a follow-up email summary for a client based on a meeting transcript.

Goal: Generate a clear, well-structured email that summarizes the key financial advice, confirms the numerical details, and outlines the immediate and future next steps.

Constraints & Format:
1. Opening: Start with a warm, conversational opening that confirms the pleasure of the meeting and sets the context.
2. Sections: Use bolded headings for clarity (e.g., Pension Recommendation, Next Steps).
3. Data Accuracy: Extract and use the exact numerical figures from the transcript.
4. Tone: Professional, clear, and reassuring.
5. Output: Provide only the final email text (do not include introductory/explanatory comments).

Example Output Format:

Subject: Follow-up: Summary of our [Topic] Advice & Next Steps

Hi ${clientName},

It was great speaking with you this morning and catching up on your weekend. Below are the key points we discussed regarding [main topic].

## Key Discussion Points

**1. [Main Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**2. [Secondary Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**3. [Additional Topic if applicable]**
* [Key point with specific numbers/details]

## Next Steps
1. **[Action Item 1]:** [Description with timeline]
2. **[Action Item 2]:** [Description with timeline]
3. **[Action Item 3]:** [Description with timeline]
4. **[Action Item 4]:** [Description with timeline]
5. **[Action Item 5]:** [Description with timeline]

Please review the documents once they arrive. If you have any immediate questions in the meantime, please don't hesitate to let me know.

Best regards,
Nelson Greenwood
Financial Advisor

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

// Mount Recall V2 calendar routes (webhooks already mounted before JSON middleware)
try {
  console.log('Mounting Recall V2 calendar routes...');
  const recallCalendarRouter = require('./routes/recall-calendar');
  app.use('/api/recall', recallCalendarRouter);
  console.log('Recall V2 calendar routes mounted successfully');
} catch (error) {
  console.warn('Failed to mount Recall V2 calendar routes:', error.message);
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

// User profile endpoint (for onboarding check)
app.get('/api/users/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Check if Supabase is available
        if (!isSupabaseAvailable()) {
            return res.status(503).json({
                error: 'Database service unavailable. Please contact support.'
            });
        }

        console.log('🔑 Verifying Supabase token for /api/users/profile...');

        // Use the new verification function
        const { user: supabaseUser, error: authError } = await verifySupabaseToken(token);

        if (authError || !supabaseUser) {
            console.error('❌ Token verification failed:', authError?.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        console.log(`✅ Token verified for Supabase user: ${supabaseUser.email}`);

        // Use UserService to get or create user
        const UserService = require('./services/userService');
        const user = await UserService.getOrCreateUser(supabaseUser);

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            profilepicture: user.profilepicture,
            onboarding_completed: user.onboarding_completed || false
        });
    } catch (error) {
        console.error('Error in /api/users/profile:', error);
        res.status(500).json({ error: error.message || 'Failed to get user profile' });
    }
});

console.log('🔄 Mounting clients routes...');
app.use('/api/clients', clientsRouter);
console.log('✅ Clients routes mounted');

console.log('🔄 Mounting pipeline routes...');
app.use('/api/pipeline', pipelineRouter);
console.log('✅ Pipeline routes mounted');

console.log('🔄 Mounting action-items routes...');
app.use('/api/action-items', actionItemsRouter);
console.log('✅ Action-items routes mounted');

console.log('🔄 Mounting transcript-action-items routes...');
app.use('/api/transcript-action-items', require('./routes/transcriptActionItems'));
console.log('✅ Transcript-action-items routes mounted');

console.log('🔄 Mounting calendar routes...');
app.use('/api/calendar', require('./routes/calendar'));
console.log('✅ Calendar routes mounted');

console.log('🔄 Mounting notifications routes...');
app.use('/api/notifications', require('./routes/notifications'));
console.log('✅ Notifications routes mounted');

console.log('🔄 Mounting client-documents routes...');
app.use('/api/client-documents', require('./routes/clientDocuments'));
console.log('✅ Client-documents routes mounted');

console.log('🔄 Mounting Calendly routes...');
app.use('/api/calendly', require('./routes/calendly'));
console.log('✅ Calendly routes mounted (includes sync, status, and webhook endpoints)');

console.log('🔄 Mounting calendar-settings routes...');
app.use('/api/calendar-connections', require('./routes/calendar-settings'));
console.log('✅ Calendar-settings routes mounted');

console.log('🔄 Mounting billing routes...');
app.use('/api/billing', require('./routes/billing'));
console.log('✅ Billing routes mounted');

console.log('🔄 Mounting admin routes...');
app.use('/api/admin', require('./routes/admin'));
console.log('✅ Admin routes mounted');

console.log('🔄 Mounting admin-tools routes...');
app.use('/api/admin-tools', require('./routes/admin-tools'));
console.log('✅ Admin-tools routes mounted');

console.log('🔄 Mounting templates routes...');
app.use('/api/templates', require('./routes/templates'));
console.log('✅ Templates routes mounted');

console.log('✅ All API routes mounted');

// DISABLED: Routes are already mounted directly above
// This was causing duplicate route mounting and potential conflicts
// console.log('🔄 Mounting main routes at /api...');
// app.use('/api', routes);
// console.log('✅ Main routes mounted at /api');

// ✅ ENABLED: Automatic webhook renewal scheduler
// This handles automatic renewal of Google/Microsoft webhooks before they expire
// Note: Polling is still disabled - this only runs webhook renewal cron jobs
console.log('✅ Automatic webhook renewal scheduler ENABLED');
const syncScheduler = require('./services/syncScheduler');
setTimeout(() => {
  syncScheduler.start();
  console.log('✅ Automatic sync scheduler initialized (webhook renewal only)');
}, 5000);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  console.log('📅 Calendly automatic sync: Every 15 minutes');
});