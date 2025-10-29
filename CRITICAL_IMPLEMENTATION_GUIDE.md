# 🔴 CRITICAL IMPLEMENTATION GUIDE

**Focus:** The 5 must-fix items before launch

---

## 1. STRIPE BILLING INTEGRATION

### Step 1: Setup

```bash
npm install stripe
```

### Step 2: Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 3: Create Billing Service

**File:** `backend/src/services/stripe.js`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createSubscription(userId, tierId, email) {
  // Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  });

  // Create subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: tierId }],
    trial_period_days: 7,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });

  return subscription;
}

async function handleWebhook(event) {
  switch (event.type) {
    case 'customer.subscription.updated':
      // Update subscription status in DB
      break;
    case 'invoice.payment_succeeded':
      // Log payment
      break;
    case 'invoice.payment_failed':
      // Send alert
      break;
  }
}

module.exports = { createSubscription, handleWebhook };
```

### Step 4: Create Billing Endpoint

**File:** `backend/src/routes/billing.js`

```javascript
router.post('/subscribe', authenticateSupabaseUser, async (req, res) => {
  const { tierId } = req.body;
  const userId = req.user.id;
  const email = req.user.email;

  try {
    const subscription = await createSubscription(userId, tierId, email);
    
    // Save to database
    await req.supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        tier_id: tierId,
        stripe_subscription_id: subscription.id,
        status: 'active',
        trial_ends_at: new Date(subscription.trial_end * 1000)
      });

    res.json({ subscription });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 2. SENTRY ERROR TRACKING

### Step 1: Install

```bash
npm install @sentry/node @sentry/tracing
```

### Step 2: Initialize

**File:** `backend/src/index.js` (top of file)

```javascript
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
```

### Step 3: Add Error Handler

**At end of file:**

```javascript
app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Step 4: Capture Errors

```javascript
try {
  // code
} catch (error) {
  Sentry.captureException(error);
  res.status(500).json({ error: error.message });
}
```

---

## 3. RATE LIMITING

### Step 1: Install

```bash
npm install express-rate-limit
```

### Step 2: Create Middleware

**File:** `backend/src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts'
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests'
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 uploads per minute
  message: 'Too many uploads'
});

module.exports = { authLimiter, apiLimiter, uploadLimiter };
```

### Step 3: Apply Middleware

**File:** `backend/src/index.js`

```javascript
const { authLimiter, apiLimiter, uploadLimiter } = require('./middleware/rateLimiter');

// Auth endpoints
app.post('/auth/login', authLimiter, ...);
app.post('/auth/signup', authLimiter, ...);

// API endpoints
app.use('/api/', apiLimiter);

// Upload endpoints
app.post('/api/client-documents/upload', uploadLimiter, ...);
```

---

## 4. GDPR DATA EXPORT

### Step 1: Create Export Endpoint

**File:** `backend/src/routes/gdpr.js`

```javascript
router.get('/export', authenticateSupabaseUser, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all user data
    const [users, clients, meetings, documents, actionItems] = await Promise.all([
      req.supabase.from('users').select('*').eq('id', userId),
      req.supabase.from('clients').select('*').eq('user_id', userId),
      req.supabase.from('meetings').select('*').eq('user_id', userId),
      req.supabase.from('client_documents').select('*').eq('advisor_id', userId),
      req.supabase.from('transcript_action_items').select('*').eq('advisor_id', userId)
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: users.data[0],
      clients: clients.data,
      meetings: meetings.data,
      documents: documents.data,
      actionItems: actionItems.data
    };

    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 2: Create Deletion Endpoint

```javascript
router.post('/delete', authenticateSupabaseUser, async (req, res) => {
  const userId = req.user.id;

  try {
    // Soft delete all user data
    await Promise.all([
      req.supabase.from('users').update({ is_deleted: true }).eq('id', userId),
      req.supabase.from('clients').update({ is_deleted: true }).eq('user_id', userId),
      req.supabase.from('meetings').update({ is_deleted: true }).eq('user_id', userId),
      req.supabase.from('client_documents').update({ is_deleted: true }).eq('advisor_id', userId)
    ]);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 5. API DOCUMENTATION (SWAGGER)

### Step 1: Install

```bash
npm install swagger-ui-express swagger-jsdoc
```

### Step 2: Create Swagger Config

**File:** `backend/src/swagger.js`

```javascript
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Advicly API',
      version: '1.0.0',
      description: 'Financial advisor management platform API'
    },
    servers: [
      { url: 'https://api.advicly.com', description: 'Production' },
      { url: 'http://localhost:3001', description: 'Development' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
```

### Step 3: Add to Express

**File:** `backend/src/index.js`

```javascript
const { swaggerUi, specs } = require('./swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
```

### Step 4: Document Endpoints

**Example in route file:**

```javascript
/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Get all clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of clients
 *       401:
 *         description: Unauthorized
 */
router.get('/clients', authenticateSupabaseUser, async (req, res) => {
  // ...
});
```

---

## TESTING THESE IMPLEMENTATIONS

### Billing
```bash
# Test in Stripe test mode first
# Use test card: 4242 4242 4242 4242
```

### Rate Limiting
```bash
# Test with curl
for i in {1..10}; do curl http://localhost:3001/api/test; done
```

### GDPR
```bash
# Test export
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/gdpr/export

# Test deletion
curl -X POST -H "Authorization: Bearer TOKEN" http://localhost:3001/api/gdpr/delete
```

### Sentry
```javascript
// Trigger test error
throw new Error('Test error');
// Check Sentry dashboard
```

---

## DEPLOYMENT CHECKLIST

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Staging tested
- [ ] Monitoring configured
- [ ] Backups verified
- [ ] Team trained

---

**Ready to implement?** Start with Stripe billing, then Sentry, then rate limiting. These are your highest priority items.

