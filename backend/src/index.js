require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { supabase, isSupabaseAvailable, getSupabase } = require('./lib/supabase');
const clientsRouter = require('./routes/clients');
const pipelineRouter = require('./routes/pipeline');
const routes = require('./routes');

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

    // Get user's Google tokens from database
    const { data: tokenData } = await getSupabase()
      .from('calendartoken')
      .select('accesstoken, refreshtoken, expiresat')
      .eq('userid', userId)
      .single();

    if (!tokenData?.accesstoken) {
      return res.status(401).json({ error: 'User not connected to Google Calendar. Please reconnect your Google account.' });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.accesstoken;
    const refreshToken = tokenData.refreshtoken;
    const expiresAt = new Date(tokenData.expiresat);
    
    if (expiresAt < new Date()) {
      // Token is expired, refresh it
      try {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });
        
        if (refreshResponse.ok) {
          const newTokens = await refreshResponse.json();
          accessToken = newTokens.access_token;
          
          // Update the token in database
          const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000));
          await getSupabase()
            .from('calendartoken')
            .update({
              accesstoken: accessToken,
              expiresat: newExpiresAt.toISOString(),
              updatedat: new Date().toISOString()
            })
            .eq('userid', userId);
        } else {
          return res.status(401).json({ error: 'Failed to refresh Google token. Please reconnect your Google account.' });
        }
      } catch (error) {
        console.error('Token refresh error:', error);
        return res.status(401).json({ error: 'Failed to refresh Google token. Please reconnect your Google account.' });
      }
    }

    // Create per-user OAuth2 client
    const userOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set user's credentials
    userOAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500
    });
    const events = response.data.items || [];

    // Upsert each meeting into the database
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue; // skip all-day events
      await getSupabase()
        .from('meetings')
        .upsert({
          googleeventid: event.id,
          userid: userId,
          title: event.summary || 'Untitled Meeting',
          starttime: event.start.dateTime,
          endtime: event.end && event.end.dateTime ? event.end.dateTime : null,
          summary: event.description || '',
          updatedat: new Date().toISOString(),
          attendees: JSON.stringify(event.attendees || [])
        }, {
          onConflict: 'googleeventid,userid'
        });
    }

    // Group into past and future
    const past = [];
    const future = [];
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue;
      // Fetch transcript from DB
      const { data: meetingData } = await getSupabase()
        .from('meetings')
        .select('transcript')
        .eq('googleeventid', event.id)
        .eq('userid', userId)
        .single();
      const transcript = meetingData?.transcript || null;
      const eventStart = new Date(event.start.dateTime);
      const processedEvent = {
        id: event.id,
        summary: event.summary || 'Untitled Meeting',
        start: { dateTime: event.start.dateTime },
        end: event.end ? { dateTime: event.end.dateTime } : null,
        description: event.description,
        location: event.location,
        attendees: event.attendees || [],
        transcript // <-- add transcript to response
      };
      if (eventStart > now) {
        future.push(processedEvent);
      } else {
        past.push(processedEvent);
      }
    }
    res.json({ past, future });
  } catch (error) {
    console.error('Error fetching or saving meetings:', error);
    res.status(500).json({ error: 'Failed to fetch or save meetings' });
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

    res.json({ success: true, transcript });
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
  return res.status(200).json({ success: false, message: 'AI summary generation is currently disabled.' });
});

app.use('/api/clients', clientsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api', routes);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
}); 