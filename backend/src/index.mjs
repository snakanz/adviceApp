import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SignJWT, jwtVerify } from 'https://cdn.jsdelivr.net/npm/jose@5.2.4/+esm';

// D1 helper: expects env.DB to be bound in wrangler.toml
async function getUserByEmail(env, email) {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE email = ?');
  const result = await stmt.bind(email).first();
  return result;
}

async function createUser(env, { email, name, provider, providerId }) {
  const stmt = env.DB.prepare('INSERT INTO users (id, email, name, provider, providerId, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
  const id = crypto.randomUUID();
  await stmt.bind(id, email, name, provider, providerId).run();
  return { id, email, name, provider, providerId };
}

async function updateUser(env, { id, name }) {
  const stmt = env.DB.prepare('UPDATE users SET name = ? WHERE id = ?');
  await stmt.bind(name, id).run();
}

async function storeCalendarTokens(env, { userId, accessToken, refreshToken, expiresAt, provider }) {
  // First, delete any existing tokens for this user
  const deleteStmt = env.DB.prepare('DELETE FROM CalendarToken WHERE userId = ?');
  await deleteStmt.bind(userId).run();
  
  // Insert new tokens
  const insertStmt = env.DB.prepare(`
    INSERT INTO CalendarToken (id, userId, accessToken, refreshToken, expiresAt, provider, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const tokenId = crypto.randomUUID();
  await insertStmt.bind(tokenId, userId, accessToken, refreshToken, expiresAt, provider).run();
}

async function getCalendarTokens(env, userId) {
  const stmt = env.DB.prepare('SELECT * FROM CalendarToken WHERE userId = ?');
  const result = await stmt.bind(userId).first();
  return result;
}

async function refreshGoogleToken(env, refreshToken) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!tokenRes.ok) {
    throw new Error('Failed to refresh token');
  }
  
  return await tokenRes.json();
}

async function fetchGoogleCalendarEvents(env, userId) {
  try {
    // Get stored tokens
    const tokens = await getCalendarTokens(env, userId);
    if (!tokens) {
      throw new Error('No calendar tokens found');
    }
    
    let accessToken = tokens.accessToken;
    
    // Check if token is expired and refresh if needed
    if (new Date(tokens.expiresAt) < new Date()) {
      const newTokenData = await refreshGoogleToken(env, tokens.refreshToken);
      accessToken = newTokenData.access_token;
      
      // Update stored tokens
      const newExpiresAt = new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString();
      await storeCalendarTokens(env, {
        userId: userId,
        accessToken: accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: newExpiresAt,
        provider: 'google'
      });
    }
    
    // Fetch calendar events from the past 30 days and next 30 days
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    
    if (!calendarRes.ok) {
      throw new Error('Failed to fetch calendar events');
    }
    
    const calendarData = await calendarRes.json();
    return calendarData.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

// Replace the custom issueJwt function with jose
async function issueJwt(user, secret) {
  const alg = 'HS256';
  const encoder = new TextEncoder();
  const jwt = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    providerId: user.providerId,
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(encoder.encode(secret));
  return jwt;
}

// Add a verifyJwt function using jose
async function verifyJwt(token, secret) {
  const encoder = new TextEncoder();
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    return payload;
  } catch (e) {
    return null;
  }
}

const app = new Hono();

// Configure CORS to allow requests from the frontend
app.use('*', cors({
  origin: [
    'http://localhost:3000', // allow local frontend
    'https://adviceapp.pages.dev',
    'https://7077afee.adviceapp.pages.dev',
    'https://601fef83.adviceapp.pages.dev',
    'https://1110afe4.adviceapp.pages.dev',
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.get('/', (c) => c.text('AdvisorAgent Backend API is running'));

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }
  const user = await getUserByEmail(c.env, email);
  if (!user || user.password !== password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  // TODO: Issue JWT and return user info
  return c.json({ message: 'Login successful', user: { id: user.id, email: user.email } });
});

// Google OAuth start route (no googleapis)
app.get('/api/calendar/auth/google', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scopes.join(' ')) +
    '&access_type=offline' +
    '&prompt=consent';
  return c.redirect(url, 302);
});

// Google OAuth callback route
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.text('Missing code', 400);
  }
  
  console.log('OAuth callback - received code');
  
  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', tokenRes.status, tokenRes.statusText);
    return c.text('Failed to exchange code for tokens', 400);
  }
  const tokenData = await tokenRes.json();
  console.log('Got Google tokens successfully');
  
  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!userRes.ok) {
    console.error('User info fetch failed:', userRes.status, userRes.statusText);
    return c.text('Failed to fetch user info', 400);
  }
  const userInfo = await userRes.json();
  console.log('Got user info:', { email: userInfo.email, name: userInfo.name });
  
  // Find or create user
  try {
    let user = await getUserByEmail(c.env, userInfo.email);
    console.log('Existing user found:', !!user);
    
    if (!user) {
      console.log('Creating new user...');
      user = await createUser(c.env, {
        email: userInfo.email,
        name: userInfo.name,
        provider: 'google',
        providerId: userInfo.id
      });
      console.log('New user created:', { id: user.id, email: user.email });
    } else if (user.name !== userInfo.name) {
      console.log('Updating user name...');
      await updateUser(c.env, { id: user.id, name: userInfo.name });
      user.name = userInfo.name;
      console.log('User name updated');
    }
    
    // Store calendar tokens
    console.log('Storing calendar tokens...');
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    await storeCalendarTokens(c.env, {
      userId: user.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: expiresAt,
      provider: 'google'
    });
    console.log('Calendar tokens stored');
    
    // Issue JWT
    console.log('Creating JWT for user:', { id: user.id, email: user.email, name: user.name });
    const jwtToken = await issueJwt(user, c.env.JWT_SECRET);
    console.log('JWT created, length:', jwtToken.length);
    
    // Redirect to frontend with token
    const frontendUrl = 'https://adviceapp.pages.dev/auth/callback?token=' + encodeURIComponent(jwtToken);
    console.log('Redirecting to frontend...');
    return c.redirect(frontendUrl, 302);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.text('Internal server error: ' + error.message, 500);
  }
});

// Token verification route
app.get('/api/auth/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    console.log('Verifying token:', token.substring(0, 50) + '...');
    // Decode JWT (no signature check for demo; add HMAC check for production)
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    
    if (!payload) {
      console.log('Invalid token format - missing parts');
      return c.json({ error: 'Invalid token format' }, 401);
    }
    
    // Optionally: check exp, iat, etc.
    return c.json({
      id: payload.id,
      email: payload.email,
      name: payload.name,
      provider: payload.provider,
      providerId: payload.providerId
    });
  } catch (e) {
    console.error('Token verification error:', e);
    return c.json({ error: 'Invalid token: ' + e.message }, 401);
  }
});

// Calendar meetings endpoints
app.get('/api/calendar/meetings/all', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  try {
    // Decode JWT to get user ID
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    
    // Fetch real calendar events
    const events = await fetchGoogleCalendarEvents(c.env, payload.id);
    
    // Process events and separate into past and future
    const now = new Date();
    const futureEvents = [];
    const pastEvents = [];
    
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue; // Skip all-day events or events without time
      const eventStart = new Date(event.start.dateTime);
      const processedEvent = {
        id: event.id,
        summary: event.summary || 'Untitled Meeting',
        start: { dateTime: event.start.dateTime },
        description: event.description,
        location: event.location,
        attendees: event.attendees || []
      };
      if (eventStart > now) {
        processedEvent.prep = 'Meeting preparation notes...';
        futureEvents.push(processedEvent);
      } else {
        // Only add meetingSummary if a real summary exists
        const transcript = await getMeetingTranscript(c.env, payload.id, event.id);
        if (transcript) {
          const summary = await getMeetingSummary(c.env, payload.id, event.id);
          let hasRealSummary = false;
          if (summary) {
            const hasRealKeyPoints = Array.isArray(summary.keyPoints) && summary.keyPoints.some(kp => kp && !kp.toLowerCase().includes('not implemented') && kp.trim() !== '');
            const hasRealActionItems = Array.isArray(summary.actionItems) && summary.actionItems.some(ai => ai && ai.trim() !== '');
            const hasRealFinancial = summary.financialSnapshot && Object.values(summary.financialSnapshot).some(val => val && val.trim() !== '');
            hasRealSummary = hasRealKeyPoints || hasRealActionItems || hasRealFinancial;
          }
          if (hasRealSummary) {
            processedEvent.meetingSummary = summary;
          }
          processedEvent.transcript = transcript;
        }
        pastEvents.push(processedEvent);
      }
    }
    
    return c.json({
      future: futureEvents,
      past: pastEvents
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    // Return empty lists if there is an error or no meetings
    return c.json({ future: [], past: [] });
  }
});

// Individual meeting endpoint
app.get('/api/calendar/meetings/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  const userId = payload.id;
  const meetingId = c.req.param('id');

  // Fetch meeting from DB
  const stmt = c.env.DB.prepare('SELECT * FROM Meeting WHERE userId = ? AND googleEventId = ?');
  const meeting = await stmt.bind(userId, meetingId).first();
  if (!meeting) {
    return c.json({ error: 'Meeting not found' }, 404);
  }
  // Optionally parse summary and other fields
  let summary = null;
  if (meeting.summary) {
    try {
      summary = JSON.parse(meeting.summary);
    } catch {
      summary = null;
    }
  }
  return c.json({
    id: meeting.googleEventId,
    summary: meeting.summary,
    start: { dateTime: meeting.startTime },
    participants: meeting.participants ? JSON.parse(meeting.participants) : [],
    meetingSummary: summary,
    transcript: meeting.transcript || null
  });
});

// Helper to update transcript for a meeting
async function updateMeetingTranscript(env, userId, meetingId, transcriptText) {
  // Find meeting by userId and Google event ID
  const stmt = env.DB.prepare('UPDATE Meeting SET transcript = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND googleEventId = ?');
  await stmt.bind(transcriptText, userId, meetingId).run();
}

// Helper to fetch transcript for a meeting
async function getMeetingTranscript(env, userId, meetingId) {
  const stmt = env.DB.prepare('SELECT transcript FROM Meeting WHERE userId = ? AND googleEventId = ?');
  const result = await stmt.bind(userId, meetingId).first();
  return result ? result.transcript : null;
}

// Helper to fetch summary for a meeting
async function getMeetingSummary(env, userId, meetingId) {
  const stmt = env.DB.prepare('SELECT summary FROM Meeting WHERE userId = ? AND googleEventId = ?');
  const result = await stmt.bind(userId, meetingId).first();
  if (!result || !result.summary) return null;
  try {
    const summary = JSON.parse(result.summary);
    return summary;
  } catch {
    return null;
  }
}

// Add transcript upload and retrieval endpoints
app.post('/api/calendar/meetings/:id/transcript', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  const userId = payload.id;
  const meetingId = c.req.param('id');

  // Check content type
  const contentType = c.req.header('Content-Type') || '';
  let transcriptText = '';
  let clientId = null;

  if (contentType.includes('application/json')) {
    const { transcript, clientId: cid } = await c.req.json();
    transcriptText = transcript;
    clientId = cid;
  } else if (contentType.includes('multipart/form-data')) {
    // Audio upload
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return c.json({ error: 'No audio file provided' }, 400);
    // Audio upload not implemented
    return c.json({ error: 'Audio upload not implemented yet' }, 400);
  } else {
    return c.json({ error: 'Unsupported content type' }, 400);
  }

  // Log values for debugging
  console.log('Transcript upload:', { userId, meetingId, clientId, transcriptText });

  // Upsert meeting: create if not exists, then update transcript and clientId
  const now = new Date().toISOString();
  await c.env.DB.prepare(`INSERT OR IGNORE INTO Meeting (userId, googleEventId, title, startTime, endTime, status, clientId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(userId, meetingId, 'Untitled Meeting', now, now, 'scheduled', clientId).run();
  // Now update transcript and clientId if needed
  if (clientId) {
    await c.env.DB.prepare('UPDATE Meeting SET transcript = ?, clientId = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND googleEventId = ?').bind(transcriptText, clientId, userId, meetingId).run();
  } else {
    await c.env.DB.prepare('UPDATE Meeting SET transcript = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND googleEventId = ?').bind(transcriptText, userId, meetingId).run();
  }

  return c.json({ success: true, transcript: transcriptText });
});

app.get('/api/calendar/meetings/:id/transcript', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  const userId = payload.id;
  const meetingId = c.req.param('id');

  // Fetch transcript from DB
  const transcript = await getMeetingTranscript(c.env, userId, meetingId);

  return c.json({ transcript });
});

// DEV: Get all meetings for the current user from SQLite (local dev only)
app.get('/api/dev/meetings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  const userId = payload.id;

  // Fetch all meetings for this user from SQLite
  const stmt = c.env.DB.prepare('SELECT * FROM Meeting WHERE userId = ? ORDER BY startTime DESC');
  const meetings = await stmt.bind(userId).all();
  return c.json(meetings);
});

export default app;
