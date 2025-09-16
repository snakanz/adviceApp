const express = require('express');
const router = express.Router();
const { adjustMeetingSummary, improveTemplate, isOpenAIAvailable } = require('./services/openai');
const calendarRoutes = require('./routes/calendar');
// const calendlyRoutes = require('./routes/calendly');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('./middleware/auth');
const { getSupabase, isSupabaseAvailable } = require('./lib/supabase');
const OpenAI = require('openai');

// Helper function for error responses
const handleError = (res, error) => {
  console.error('Error:', error);
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  res.status(status).json({ error: message });
};

// Health check endpoint
router.get('/health2', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is healthy from routes.js' });
});

// Mount calendar routes
router.use('/calendar', calendarRoutes);

// Test route for calendly
router.get('/calendly/test', (req, res) => {
  console.log('🔄 Direct calendly test route hit');
  res.json({ message: 'Direct calendly test working!' });
});

// Mount calendly routes
// console.log('🔄 Mounting Calendly routes in main routes.js...');
// router.use('/calendly', calendlyRoutes);
// console.log('✅ Calendly routes mounted in main routes.js');

// OpenAI routes
router.post('/ai/adjust-summary', authenticateUser, async (req, res) => {
  try {
    const { originalSummary, adjustmentPrompt } = req.body;
    
    if (!originalSummary || !adjustmentPrompt) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          originalSummary: !originalSummary ? 'Original summary is required' : null,
          adjustmentPrompt: !adjustmentPrompt ? 'Adjustment prompt is required' : null
        }
      });
    }

    if (adjustmentPrompt.length > 150) {
      return res.status(400).json({ 
        error: 'Adjustment prompt exceeds maximum length',
        details: {
          maxLength: 150,
          currentLength: adjustmentPrompt.length
        }
      });
    }

    const adjustedSummary = await adjustMeetingSummary(originalSummary, adjustmentPrompt);
    res.json({ adjustedSummary });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/ai/improve-template', authenticateUser, async (req, res) => {
  try {
    const { template, improvement } = req.body;
    
    if (!template || !improvement) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          template: !template ? 'Template is required' : null,
          improvement: !improvement ? 'Improvement prompt is required' : null
        }
      });
    }

    if (improvement.length > 150) {
      return res.status(400).json({ 
        error: 'Improvement prompt exceeds maximum length',
        details: {
          maxLength: 150,
          currentLength: improvement.length
        }
      });
    }

    const improvedTemplate = await improveTemplate(template, improvement);
    res.json({ improvedTemplate });
  } catch (error) {
    handleError(res, error);
  }
});

// AI Chat endpoint for client-scoped conversations
router.post('/ai/chat', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { messages, clientId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Check if OpenAI is available
    if (!isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build context for client-scoped chat
    let systemPrompt = 'You are Advicly AI, a helpful assistant for financial advisors. You have access to client meeting data and can help with financial advice questions.';

    if (clientId && isSupabaseAvailable()) {
      try {
        // Get client meetings and data for context
        const { data: meetings } = await getSupabase()
          .from('meetings')
          .select('title, starttime, transcript, quick_summary, email_summary_draft')
          .eq('userid', userId)
          .contains('attendees', `[{"email": "${clientId}"}]`)
          .order('starttime', { ascending: false })
          .limit(10);

        if (meetings && meetings.length > 0) {
          const clientContext = meetings.map(m =>
            `Meeting: ${m.title} (${new Date(m.starttime).toLocaleDateString()})
            ${m.quick_summary ? `Summary: ${m.quick_summary}` : ''}
            ${m.transcript ? `Transcript: ${m.transcript.substring(0, 500)}...` : ''}`
          ).join('\n\n');

          systemPrompt += `\n\nClient Context (${clientId}):\n${clientContext}`;
        }
      } catch (error) {
        console.error('Error fetching client context:', error);
        // Continue without context if there's an error
      }
    }

    // Prepare messages for OpenAI
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000
    });

    res.json({ reply: response.choices[0].message.content });

  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Register endpoint
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const user = await prisma.user.create({
      data: { email, password, name, provider: 'local', providerId: email }
    });
    res.json({ message: 'User registered', user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Ask Advicly test route
router.get('/ask-advicly/test', (req, res) => {
  res.json({ message: 'Ask Advicly routes working from main routes!' });
});

module.exports = router;
