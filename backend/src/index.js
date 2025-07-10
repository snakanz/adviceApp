require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());

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
    'https://www.googleapis.com/auth/userinfo.email'
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
      await pool.query('UPDATE users SET name = $1, google_id = $2 WHERE email = $3', [name, googleId, email]);
    } else {
      const insert = await pool.query(
        'INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *',
        [email, name, googleId]
      );
      user = insert.rows[0];
    }
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

app.get('/api/calendar/meetings/all', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Set up Google OAuth2 client with user's tokens (assume tokens are stored in users table for now)
    // You may need to adjust this if you store tokens elsewhere
    // For demo, we'll use the main oauth2Client (should be per-user in production)

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
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
        `INSERT INTO meetings (google_event_id, user_id, summary, start_time, end_time, description, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (google_event_id, user_id) DO UPDATE
         SET summary = $3, start_time = $4, end_time = $5, description = $6, location = $7`,
        [
          event.id,
          userId,
          event.summary || 'Untitled Meeting',
          event.start.dateTime,
          event.end ? event.end.dateTime : null,
          event.description,
          event.location
        ]
      );
    }

    // Group into past and future
    const past = [];
    const future = [];
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue;
      const eventStart = new Date(event.start.dateTime);
      const processedEvent = {
        id: event.id,
        summary: event.summary || 'Untitled Meeting',
        start: { dateTime: event.start.dateTime },
        end: event.end ? { dateTime: event.end.dateTime } : null,
        description: event.description,
        location: event.location,
        attendees: event.attendees || []
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

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
}); 