import { Hono } from 'hono';

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
    return c.text('Failed to exchange code for tokens', 400);
  }
  const tokenData = await tokenRes.json();
  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!userRes.ok) {
    return c.text('Failed to fetch user info', 400);
  }
  const userInfo = await userRes.json();
  // Find or create user
  let user = await getUserByEmail(c.env, userInfo.email);
  if (!user) {
    user = await createUser(c.env, {
      email: userInfo.email,
      name: userInfo.name,
      provider: 'google',
      providerId: userInfo.id
    });
  }
  // Issue JWT
  const jwt = issueJwt(user, c.env.GOOGLE_CLIENT_SECRET);
  // Redirect to frontend with token
  const frontendUrl = 'https://adviceapp.pages.dev/auth/callback?token=' + encodeURIComponent(jwt);
  return c.redirect(frontendUrl, 302);
});

// Token verification route
app.get('/api/auth/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    // Decode JWT (no signature check for demo; add HMAC check for production)
    const [headerB64, payloadB64, signature] = token.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    // Optionally: check exp, iat, etc.
    return c.json({
      id: payload.id,
      email: payload.email,
      name: payload.name,
      provider: payload.provider,
      providerId: payload.providerId
    });
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Calendar meetings endpoints
app.get('/api/calendar/meetings/all', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  // For demo purposes, return mock meeting data since we need to implement proper token storage
  // In production, you'd store refresh tokens and use them to get fresh access tokens
  const mockMeetings = {
    future: [
      {
        id: '1',
        summary: 'Client Strategy Review',
        start: { dateTime: new Date(Date.now() + 86400000 * 2).toISOString() }, // 2 days from now
        prep: 'Review client portfolio performance and prepare quarterly recommendations.'
      },
      {
        id: '2', 
        summary: 'Investment Planning Session',
        start: { dateTime: new Date(Date.now() + 86400000 * 5).toISOString() }, // 5 days from now
        prep: 'Analyze risk tolerance and discuss new investment opportunities.'
      }
    ],
    past: [
      {
        id: '3',
        summary: 'Portfolio Review Meeting',
        start: { dateTime: new Date(Date.now() - 86400000 * 3).toISOString() }, // 3 days ago
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
      },
      {
        id: '4',
        summary: 'Financial Planning Consultation',
        start: { dateTime: new Date(Date.now() - 86400000 * 7).toISOString() }, // 1 week ago
        meetingSummary: {
          keyPoints: [
            'Retirement planning discussion',
            'Tax optimization strategies reviewed',
            'Estate planning considerations addressed'
          ],
          financialSnapshot: {
            netWorth: '$2.4M',
            income: '$180K annually', 
            expenses: '$95K annually'
          },
          actionItems: [
            'Set up 401k contribution increase',
            'Review tax-loss harvesting opportunities',
            'Schedule meeting with estate attorney'
          ]
        }
      }
    ]
  };
  
  return c.json(mockMeetings);
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
