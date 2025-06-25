import { Hono } from 'hono';
import { cors } from 'hono/cors';

// D1 helper: expects env.DB to be bound in wrangler.toml
async function getUserByEmail(env, email) {
  const stmt = env.DB.prepare('SELECT * FROM User WHERE email = ?');
  const result = await stmt.bind(email).first();
  return result;
}

async function createUser(env, { email, name, provider, providerId }) {
  const stmt = env.DB.prepare('INSERT INTO User (id, email, name, provider, providerId, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
  const id = crypto.randomUUID();
  await stmt.bind(id, email, name, provider, providerId).run();
  return { id, email, name, provider, providerId };
}

async function updateUser(env, { id, name }) {
  const stmt = env.DB.prepare('UPDATE User SET name = ? WHERE id = ?');
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

function issueJwt(user, secret) {
  // Simple JWT implementation for demo (use a library for production)
  // Header
  const header = { alg: 'HS256', typ: 'JWT' };
  // Payload
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    providerId: user.providerId,
    iat: Math.floor(Date.now() / 1000)
  };
  function base64url(obj) {
    return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  // For demo, use a dummy signature (replace with HMAC-SHA256 for production)
  const signature = btoa(secret).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${headerB64}.${payloadB64}.${signature}`;
}

const app = new Hono();

// Configure CORS to allow requests from the frontend
app.use('*', cors({
  origin: ['https://adviceapp.pages.dev', 'https://7077afee.adviceapp.pages.dev', 'https://601fef83.adviceapp.pages.dev', 'https://1110afe4.adviceapp.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.get('/', (c) => c.text('AdvisorAgent Backend API is running'));

// Debug endpoint to test database
app.get('/api/debug/db', async (c) => {
  try {
    const stmt = c.env.DB.prepare('SELECT name FROM sqlite_master WHERE type="table"');
    const result = await stmt.all();
    return c.json({ tables: result, message: 'Database connected successfully' });
  } catch (error) {
    return c.json({ error: 'Database connection failed: ' + error.message }, 500);
  }
});

// Debug endpoint to test user creation
app.get('/api/debug/test-user', async (c) => {
  try {
    const testEmail = 'test@example.com';
    let user = await getUserByEmail(c.env, testEmail);
    if (!user) {
      user = await createUser(c.env, {
        email: testEmail,
        name: 'Test User',
        provider: 'test',
        providerId: 'test123'
      });
    }
    return c.json({ user, message: 'User operations working' });
  } catch (error) {
    return c.json({ error: 'User operations failed: ' + error.message }, 500);
  }
});

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
    const jwt = issueJwt(user, c.env.GOOGLE_CLIENT_SECRET);
    console.log('JWT created, length:', jwt.length);
    
    // Redirect to frontend with token
    const frontendUrl = 'https://adviceapp.pages.dev/auth/callback?token=' + encodeURIComponent(jwt);
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
    const [headerB64, payloadB64, signature] = token.split('.');
    
    if (!headerB64 || !payloadB64 || !signature) {
      console.log('Invalid token format - missing parts');
      return c.json({ error: 'Invalid token format' }, 401);
    }
    
    // Proper base64url decoding
    function base64urlDecode(str) {
      // Add padding if needed
      str += '='.repeat((4 - str.length % 4) % 4);
      // Replace URL-safe characters
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      return atob(str);
    }
    
    const payloadStr = base64urlDecode(payloadB64);
    console.log('Decoded payload string:', payloadStr);
    const payload = JSON.parse(payloadStr);
    console.log('Parsed payload:', payload);
    
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
    const [headerB64, payloadB64, signature] = token.split('.');
    
    // Proper base64url decoding
    function base64urlDecode(str) {
      // Add padding if needed
      str += '='.repeat((4 - str.length % 4) % 4);
      // Replace URL-safe characters
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      return atob(str);
    }
    
    const payload = JSON.parse(base64urlDecode(payloadB64));
    
    // Fetch real calendar events
    const events = await fetchGoogleCalendarEvents(c.env, payload.id);
    
    // Process events and separate into past and future
    const now = new Date();
    const futureEvents = [];
    const pastEvents = [];
    
    events.forEach(event => {
      if (!event.start || !event.start.dateTime) return; // Skip all-day events or events without time
      
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
        // Future meeting - add prep field
        processedEvent.prep = 'Meeting preparation notes...';
        futureEvents.push(processedEvent);
      } else {
        // Past meeting - add mock summary for demo
        processedEvent.meetingSummary = {
          keyPoints: [
            'Meeting completed successfully',
            'Key decisions were made',
            'Action items assigned'
          ],
          financialSnapshot: {
            netWorth: '$2.4M',
            income: '$180K annually',
            expenses: '$95K annually'
          },
          actionItems: [
            'Follow up on discussed items',
            'Prepare for next meeting',
            'Review meeting outcomes'
          ]
        };
        pastEvents.push(processedEvent);
      }
    });
    
    return c.json({
      future: futureEvents,
      past: pastEvents
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    // Return mock data as fallback
    const mockMeetings = {
      future: [
        {
          id: '1',
          summary: 'Client Strategy Review',
          start: { dateTime: new Date(Date.now() + 86400000 * 2).toISOString() },
          prep: 'Review client portfolio performance and prepare quarterly recommendations.'
        }
      ],
      past: [
        {
          id: '3',
          summary: 'Portfolio Review Meeting',
          start: { dateTime: new Date(Date.now() - 86400000 * 3).toISOString() },
          meetingSummary: {
            keyPoints: [
              'Client expressed interest in ESG investments',
              'Current portfolio showing 8% YTD growth'
            ],
            actionItems: [
              'Research ESG fund options',
              'Prepare rebalancing proposal'
            ]
          }
        }
      ]
    };
    return c.json(mockMeetings);
  }
});

// Individual meeting endpoint
app.get('/api/calendar/meetings/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const meetingId = c.req.param('id');
  
  // Mock individual meeting data
  const mockMeeting = {
    id: meetingId,
    summary: 'Portfolio Review Meeting',
    start: { dateTime: new Date(Date.now() - 86400000 * 3).toISOString() },
    participants: ['snaka1003@gmail.com', 'advisor@example.com'],
    meetingSummary: {
      keyPoints: [
        'Client expressed interest in ESG investments',
        'Current portfolio showing 8% YTD growth',
        'Discussed rebalancing strategy for Q4'
      ],
      financialSnapshot: {
        netWorth: '$2.4M',
        income: '$180K annually',
        expenses: '$95K annually'
      },
      actionItems: [
        'Research ESG fund options',
        'Prepare rebalancing proposal',
        'Schedule Q4 review meeting'
      ]
    }
  };
  
  return c.json(mockMeeting);
});

export default app;
