# 🚀 PUBLIC SIGNUP IMPLEMENTATION GUIDE

**Goal:** Make Advicly ready for public sign-ups  
**Timeline:** 4 weeks  
**Effort:** 42 hours development + legal review

---

## STEP 1: ENABLE EMAIL VERIFICATION (5 minutes)

### In Supabase Dashboard

1. Go to **Authentication** → **Settings**
2. Scroll to **Email** section
3. Toggle **Confirm email** to ON
4. (Optional) Customize email template
5. Click **Save**

### What This Does
- Users must verify email before accessing platform
- Prevents spam/fake accounts
- Sends verification email automatically
- User can't login until verified

### Frontend Already Handles This
Your `RegisterPage.js` already shows:
```javascript
if (result.data?.user && !result.data?.session) {
  setError('Please check your email to confirm your account');
}
```

**Status:** ✅ READY - Just enable in Supabase

---

## STEP 2: ADD RATE LIMITING (2 hours)

### Install Package
```bash
cd backend
npm install express-rate-limit
```

### Create Middleware
**File:** `backend/src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

// 5 login attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// 3 signups per hour per IP
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many signup attempts. Try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// 10 API requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, signupLimiter, apiLimiter };
```

### Apply to Routes
**File:** `backend/src/index.js`

```javascript
const { authLimiter, signupLimiter, apiLimiter } = require('./middleware/rateLimiter');

// Apply to auth endpoints
app.post('/api/auth/login', authLimiter, authRoutes);
app.post('/api/auth/register', signupLimiter, authRoutes);

// Apply to all API endpoints
app.use('/api/', apiLimiter);
```

**Status:** ⏳ NEEDS IMPLEMENTATION (2 hours)

---

## STEP 3: ADD PASSWORD POLICY (1 hour)

### In Supabase Dashboard

1. Go to **Authentication** → **Settings**
2. Scroll to **Password** section
3. Set minimum length: **12 characters** (recommended)
4. Enable **Require uppercase letters**
5. Enable **Require numbers**
6. Enable **Require special characters**
7. Click **Save**

### Frontend Validation
Add to `RegisterPage.js`:

```javascript
const validatePassword = (password) => {
  const errors = [];
  if (password.length < 12) errors.push('At least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('One special character');
  return errors;
};
```

**Status:** ⏳ NEEDS IMPLEMENTATION (1 hour)

---

## STEP 4: GDPR DATA EXPORT (4 hours)

### Create Route
**File:** `backend/src/routes/gdpr.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { isSupabaseAvailable } = require('../lib/supabase');

// Export user data
router.get('/export', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

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

    // Send as JSON file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=advicly-data.json');
    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
```

### Mount Route
**File:** `backend/src/index.js`

```javascript
const gdprRoutes = require('./routes/gdpr');
app.use('/api/gdpr', gdprRoutes);
```

**Status:** ⏳ NEEDS IMPLEMENTATION (4 hours)

---

## STEP 5: GDPR DATA DELETION (3 hours)

### Add Delete Endpoint
**File:** `backend/src/routes/gdpr.js`

```javascript
// Delete user account and all data
router.post('/delete', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Soft delete all user data
    await Promise.all([
      req.supabase.from('users').update({ is_deleted: true }).eq('id', userId),
      req.supabase.from('clients').update({ is_deleted: true }).eq('user_id', userId),
      req.supabase.from('meetings').update({ is_deleted: true }).eq('user_id', userId),
      req.supabase.from('client_documents').update({ is_deleted: true }).eq('advisor_id', userId),
      req.supabase.from('ask_threads').update({ is_deleted: true }).eq('user_id', userId)
    ]);

    // Sign out user
    await supabase.auth.admin.deleteUser(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Deletion error:', error);
    res.status(500).json({ error: 'Deletion failed' });
  }
});
```

**Status:** ⏳ NEEDS IMPLEMENTATION (3 hours)

---

## STEP 6: PRIVACY POLICY (4 hours)

### Create Page
**File:** `src/pages/PrivacyPolicy.js`

```javascript
export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly:</p>
      <ul>
        <li>Name and email address</li>
        <li>Calendar data (meetings, events)</li>
        <li>Client information</li>
        <li>Meeting transcripts and summaries</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide and improve our services</li>
        <li>Generate AI summaries and insights</li>
        <li>Sync your calendar</li>
        <li>Send you important updates</li>
      </ul>

      <h2>3. Data Protection</h2>
      <p>Your data is protected by:</p>
      <ul>
        <li>Encryption in transit (HTTPS)</li>
        <li>Row-level security policies</li>
        <li>Regular backups</li>
        <li>Access controls</li>
      </ul>

      <h2>4. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your data (export)</li>
        <li>Delete your account</li>
        <li>Correct your information</li>
        <li>Withdraw consent</li>
      </ul>

      <h2>5. Contact Us</h2>
      <p>Email: privacy@advicly.com</p>
    </div>
  );
}
```

### Add Route
**File:** `src/App.js`

```javascript
import PrivacyPolicy from './pages/PrivacyPolicy';

<Route path="/privacy" element={<PrivacyPolicy />} />
```

**Status:** ⏳ NEEDS IMPLEMENTATION (4 hours)

---

## STEP 7: TERMS OF SERVICE (4 hours)

### Create Page
**File:** `src/pages/TermsOfService.js`

```javascript
export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2>1. Acceptance of Terms</h2>
      <p>By using Advicly, you agree to these terms.</p>

      <h2>2. Use License</h2>
      <p>You may use Advicly for lawful purposes only.</p>

      <h2>3. Disclaimer</h2>
      <p>Advicly is provided "as is" without warranties.</p>

      <h2>4. Limitations of Liability</h2>
      <p>We are not liable for indirect or consequential damages.</p>

      <h2>5. Termination</h2>
      <p>We may terminate your account for violations.</p>

      <h2>6. Contact</h2>
      <p>Email: legal@advicly.com</p>
    </div>
  );
}
```

**Status:** ⏳ NEEDS IMPLEMENTATION (4 hours)

---

## STEP 8: AUDIT LOGGING (6 hours)

### Create Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### Create Service
**File:** `backend/src/services/auditLog.js`

```javascript
async function logAction(userId, action, resourceType, resourceId, changes, req) {
  const { getSupabase } = require('../lib/supabase');
  
  await getSupabase().from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    changes,
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
}

module.exports = { logAction };
```

### Use in Routes
```javascript
const { logAction } = require('../services/auditLog');

// After any important action
await logAction(userId, 'client_created', 'client', clientId, clientData, req);
```

**Status:** ⏳ NEEDS IMPLEMENTATION (6 hours)

---

## IMPLEMENTATION CHECKLIST

### Week 1: Critical
- [ ] Enable email verification (5 min)
- [ ] Add rate limiting (2 hours)
- [ ] Add password policy (1 hour)
- [ ] Create GDPR export endpoint (4 hours)
- [ ] Create GDPR delete endpoint (3 hours)

### Week 2: Legal
- [ ] Create privacy policy page (4 hours)
- [ ] Create terms of service page (4 hours)
- [ ] Legal review of policies (external)
- [ ] Create DPA template (2 hours)

### Week 3: Monitoring
- [ ] Add audit logging (6 hours)
- [ ] Set up error tracking (Sentry)
- [ ] Add monitoring/alerts
- [ ] Security audit

### Week 4: Launch
- [ ] Final testing
- [ ] Deploy to production
- [ ] Monitor closely
- [ ] Support team ready

---

## TESTING CHECKLIST

- [ ] Email verification works
- [ ] Rate limiting blocks after limit
- [ ] Password policy enforced
- [ ] Data export returns all data
- [ ] Data deletion removes all data
- [ ] Privacy policy displays correctly
- [ ] Terms of service displays correctly
- [ ] Audit logs created for actions

---

## DEPLOYMENT CHECKLIST

- [ ] All code reviewed
- [ ] All tests passing
- [ ] Security audit passed
- [ ] Legal review complete
- [ ] Staging tested
- [ ] Monitoring configured
- [ ] Backups verified
- [ ] Team trained

---

## COST SUMMARY

| Item | Cost | Time |
|------|------|------|
| Email verification | $0 | 5 min |
| Rate limiting | $0 | 2 hrs |
| Password policy | $0 | 1 hr |
| GDPR export | $0 | 4 hrs |
| GDPR delete | $0 | 3 hrs |
| Privacy policy | $200-500 | 4 hrs |
| Terms of service | $200-500 | 4 hrs |
| Audit logging | $0 | 6 hrs |
| **Total** | **$400-1000** | **28 hrs** |

---

## NEXT STEPS

1. **Today:** Enable email verification in Supabase
2. **This week:** Implement rate limiting + GDPR endpoints
3. **Next week:** Add legal documents
4. **Week 3:** Add audit logging + security audit
5. **Week 4:** Launch to public!

**Ready to start?** Begin with Step 1 - it's just 5 minutes in Supabase!

