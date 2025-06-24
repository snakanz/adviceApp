const express = require('express');
const router = express.Router();
const { adjustMeetingSummary, improveTemplate } = require('./services/openai');
const calendarRoutes = require('./routes/calendar');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('./middleware/auth');

// Helper function for error responses
const handleError = (res, error) => {
  console.error('Error:', error);
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  res.status(status).json({ error: message });
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is healthy' });
});

// Mount calendar routes
router.use('/calendar', calendarRoutes);

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

// Recall.ai integration placeholder
router.get('/recall/test', authenticateUser, (req, res) => {
  res.json({ message: 'Recall.ai endpoint working' });
});

// Auth integration placeholder
router.get('/auth/test', authenticateUser, (req, res) => {
  res.json({ message: 'Auth endpoint working' });
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

module.exports = router;
