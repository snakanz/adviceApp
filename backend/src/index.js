require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const clientsRouter = require('./routes/clients');
const routes = require('./routes');
// const { Configuration, OpenAIApi } = require('openai');
// const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://adviceapp.pages.dev'],
  credentials: true
}));
app.use(express.json());

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // For production, replace * with your frontend domain
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Google OAuth URL
app.get('/api/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.json({ url });
});

// Google OAuth callback
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    console.log('Google user info:', userInfo.data);
    
    // Upsert user in Postgres
    const { email, name, id: googleId } = userInfo.data;
    let user;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      user = result.rows[0];
      // Update user info
      await pool.query(
        'UPDATE users SET name = $1, providerid = $2 WHERE email = $3',
        [name, googleId, email]
      );
    } else {
      const insert = await pool.query(
        'INSERT INTO users (id, email, name, provider, providerid) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [googleId, email, name, 'google', googleId]
      );
      user = insert.rows[0];
    }
    
    // Store/update calendar tokens
    let expiresAt;
    if (tokens.expiry_date) {
      expiresAt = new Date(tokens.expiry_date);
    } else if (tokens.expires_in) {
      expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
    } else {
      // Fallback: set to 1 hour from now
      expiresAt = new Date(Date.now() + 3600 * 1000);
    }
    await pool.query(
      `INSERT INTO calendartoken (id, userid, accesstoken, refreshtoken, expiresat, provider, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (userid) DO UPDATE
       SET accesstoken = $3, refreshtoken = $4, expiresat = $5, updatedat = $7`,
      [
        `token_${user.id}`,
        user.id,
        tokens.access_token,
        tokens.refresh_token || null,
        expiresAt,
        'google',
        new Date()
      ]
    );
    
    // Issue JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    console.log('Issued JWT:', token);
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    if (err.response) {
      console.error('Google OAuth error response data:', err.response.data);
    }
    res.status(500).json({ error: 'OAuth failed', details: err.response ? err.response.data : err.message });
  }
});

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

app.get('/api/auth/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json(decoded);
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

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

    // Get user's Google tokens from database
    const tokenResult = await pool.query(
      'SELECT accesstoken, refreshtoken, expiresat FROM calendartoken WHERE userid = $1',
      [userId]
    );
    
    if (!tokenResult.rows[0]?.accesstoken) {
      return res.status(401).json({ error: 'User not connected to Google Calendar. Please reconnect your Google account.' });
    }
    
    // Check if token is expired and refresh if needed
    let accessToken = tokenResult.rows[0].accesstoken;
    const refreshToken = tokenResult.rows[0].refreshtoken;
    const expiresAt = new Date(tokenResult.rows[0].expiresat);
    
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
          await pool.query(
            'UPDATE calendartoken SET accesstoken = $1, expiresat = $2, updatedat = $3 WHERE userid = $4',
            [accessToken, newExpiresAt, new Date(), userId]
          );
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
      await pool.query(
        `INSERT INTO meetings (googleeventid, userid, title, starttime, endtime, summary, updatedat, attendees)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (googleeventid, userid) DO UPDATE
         SET title = $3, starttime = $4, endtime = $5, summary = $6, updatedat = $7, attendees = $8`,
        [
          event.id,
          userId,
          event.summary || 'Untitled Meeting',
          event.start.dateTime,
          event.end && event.end.dateTime ? event.end.dateTime : null,
          event.description || '',
          new Date(),
          JSON.stringify(event.attendees || [])
        ]
      );
    }

    // Group into past and future
    const past = [];
    const future = [];
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue;
      // Fetch transcript from DB
      const transcriptResult = await pool.query(
        'SELECT transcript FROM meetings WHERE googleeventid = $1 AND userid = $2',
        [event.id, userId]
      );
      const transcript = transcriptResult.rows[0]?.transcript || null;
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

    // Ensure transcript column exists in meetings table
    // Update the transcript for the meeting
    await pool.query(
      'UPDATE meetings SET transcript = $1, updatedat = NOW() WHERE googleeventid = $2 AND userid = $3',
      [transcript, meetingId, userId]
    );

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

    await pool.query(
      'UPDATE meetings SET transcript = NULL, updatedat = NOW() WHERE googleeventid = $1 AND userid = $2',
      [meetingId, userId]
    );

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
app.use('/api', routes);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
}); 