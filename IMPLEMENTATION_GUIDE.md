# Multi-Tenant Implementation Guide

## 🎯 Quick Start

This guide provides step-by-step instructions to implement the complete multi-tenant authentication and onboarding system for Advicly.

## ⚠️ Before You Begin

**CRITICAL: Backup Your Database**
1. Go to Supabase Dashboard → Database → Backups
2. Create a manual backup
3. Wait for backup to complete
4. Download backup file for extra safety

## 📋 Step-by-Step Implementation

### Step 1: Run Database Migration (30 minutes)

**1.1 Verify Current State**
```sql
-- Run in Supabase SQL Editor
SELECT id, email, name FROM users;
SELECT COUNT(*) FROM meetings;
SELECT COUNT(*) FROM clients;
```

**1.2 Run Migration Part 1**
1. Open `backend/migrations/PHASE1_MULTI_TENANT_MIGRATION.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for completion (may take 1-2 minutes)
6. Check for errors in output

**1.3 Run Migration Part 2**
1. Open `backend/migrations/PHASE1_MULTI_TENANT_MIGRATION_PART2.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for completion

**1.4 Verify Migration**
```sql
-- Check users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Verify user migrated
SELECT id, email, onboarding_completed FROM users;

-- Check calendar_integrations
SELECT * FROM calendar_integrations;

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'meetings', 'clients');
```

**Expected Results:**
- `users.id` is now UUID type
- User ID is `550e8400-e29b-41d4-a716-446655440000`
- `onboarding_completed = true`
- `calendar_integrations` table exists
- RLS enabled on all tables

---

### Step 2: Configure Supabase Auth (45 minutes)

Follow the complete guide in `docs/SUPABASE_AUTH_SETUP.md`

**2.1 Enable Email/Password**
1. Supabase Dashboard → Authentication → Providers
2. Enable "Email" provider
3. Configure email confirmations
4. Save

**2.2 Configure Google OAuth**
1. Go to Google Cloud Console
2. Create OAuth credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret
5. In Supabase: Authentication → Providers → Google
6. Enable and paste credentials
7. Save

**2.3 Configure Microsoft OAuth**
1. Go to Azure Portal
2. Register app
3. Create client secret
4. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
5. Copy Application ID and Secret
6. In Supabase: Authentication → Providers → Azure
7. Enable and paste credentials
8. Set tenant to "common"
9. Save

**2.4 Get API Keys**
1. Supabase Dashboard → Settings → API
2. Copy "anon/public" key → This is `SUPABASE_ANON_KEY`
3. Copy "service_role" key → This is `SUPABASE_SERVICE_ROLE_KEY`
4. Save these securely

---

### Step 3: Update Environment Variables (15 minutes)

**3.1 Backend (Render)**
1. Go to Render Dashboard → Your Service → Environment
2. Add new variable:
   - Key: `SUPABASE_ANON_KEY`
   - Value: (paste anon key from Supabase)
3. Verify existing variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Save changes
5. Render will auto-redeploy

**3.2 Frontend (Cloudflare Pages)**
1. Go to Cloudflare Pages → Your Project → Settings → Environment Variables
2. Verify these exist:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_API_BASE_URL`
3. If missing, add them
4. Trigger new deployment

**3.3 Local Development**
```bash
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env (frontend)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_API_BASE_URL=http://localhost:8787
```

---

### Step 4: Update Backend Code (2-3 hours)

The following files have already been created/updated:
- ✅ `backend/src/lib/supabase.js` - Updated
- ✅ `backend/src/middleware/supabaseAuth.js` - Created
- ✅ `backend/.env.example` - Updated

**4.1 Update Auth Routes**

Edit `backend/src/routes/auth.js`:

```javascript
// At the top, add:
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { createUserClient } = require('../lib/supabase');

// Replace /verify endpoint:
router.get('/verify', authenticateSupabaseUser, async (req, res) => {
  // User is already verified by middleware
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name
  });
});

// Remove /register and /login endpoints (handled by Supabase)
// Keep /google and /google/callback for now (will update in Phase 3)
```

**4.2 Update Meetings Routes**

Edit `backend/src/routes/meetings.js` (or wherever meetings are handled):

```javascript
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

// Replace authenticateUser with authenticateSupabaseUser
router.get('/api/meetings', authenticateSupabaseUser, async (req, res) => {
  try {
    // Use req.supabase instead of getSupabase()
    // RLS will automatically filter by auth.uid()
    const { data: meetings, error } = await req.supabase
      .from('meetings')
      .select('*')
      .order('starttime', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});
```

**4.3 Update Clients Routes**

Similar pattern for clients:

```javascript
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

router.get('/api/clients', authenticateSupabaseUser, async (req, res) => {
  try {
    const { data: clients, error } = await req.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});
```

**4.4 Update All Other Routes**

Apply the same pattern to:
- `backend/src/routes/ask-advicly.js`
- `backend/src/routes/actionItems.js`
- `backend/src/routes/pipeline.js`
- `backend/src/routes/clientDocuments.js`
- `backend/src/routes/transcriptActionItems.js`

**Pattern:**
1. Import `authenticateSupabaseUser`
2. Replace `authenticateUser` middleware
3. Use `req.supabase` instead of `getSupabase()`
4. Remove manual `.eq('advisor_id', userId)` filters
5. Let RLS handle filtering

**4.5 Keep Service Role for Webhooks**

For webhook handlers (Calendly, Google Calendar), keep using service role:

```javascript
// backend/src/routes/calendly.js
const { getSupabase } = require('../lib/supabase');

router.post('/webhook', async (req, res) => {
  // Webhooks use service role (no user context)
  const supabase = getSupabase();
  
  // ... webhook logic
});
```

---

### Step 5: Update Frontend Code (1-2 hours)

**5.1 Update LoginPage**

Edit `src/pages/LoginPage.js`:

```javascript
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { signInWithOAuth } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    const { success, error } = await signInWithOAuth('google');
    
    if (!success) {
      alert(`Login failed: ${error}`);
    }
    // Supabase will redirect to callback URL
  };

  const handleMicrosoftLogin = async () => {
    const { success, error } = await signInWithOAuth('azure');
    
    if (!success) {
      alert(`Login failed: ${error}`);
    }
  };

  return (
    // ... existing JSX with updated handlers
  );
};
```

**5.2 Update AuthCallback**

Edit `src/pages/AuthCallback.js`:

```javascript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (session) {
      // Check onboarding status
      // If completed, go to meetings
      // If not, go to onboarding
      navigate('/meetings');
    } else {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  return <div>Loading...</div>;
};
```

**5.3 Update API Service**

Edit `src/services/api.js`:

```javascript
import { supabase } from '../lib/supabase';

class ApiService {
  async getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async request(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getMeetings() {
    return this.request('/api/meetings');
  }

  async getClients() {
    return this.request('/api/clients');
  }

  // ... other methods
}

export default new ApiService();
```

---

### Step 6: Test the Implementation (1 hour)

**6.1 Test Authentication**

1. Clear browser cache and localStorage
2. Go to login page
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Verify redirect to meetings page
6. Check browser console for errors

**6.2 Test RLS Enforcement**

```sql
-- In Supabase SQL Editor
-- Try to query as anonymous user (should fail)
SELECT * FROM meetings;

-- Set auth context (simulate logged-in user)
SET request.jwt.claims = '{"sub": "550e8400-e29b-41d4-a716-446655440000"}';
SELECT * FROM meetings; -- Should work
```

**6.3 Test API Endpoints**

Use Postman or curl:

```bash
# Get access token from browser (inspect localStorage or network tab)
TOKEN="your-supabase-access-token"

# Test meetings endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://adviceapp-9rgw.onrender.com/api/meetings

# Test clients endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://adviceapp-9rgw.onrender.com/api/clients
```

---

## 🚨 Troubleshooting

### "Invalid token" errors
- Check that `SUPABASE_ANON_KEY` is set correctly
- Verify token is being sent in Authorization header
- Check Supabase logs for auth errors

### "No data returned" from API
- Verify RLS policies are correct
- Check that `auth.uid()` matches user ID
- Test queries directly in Supabase SQL Editor

### "User not found" after OAuth
- Check that user was created in Supabase Auth
- Verify redirect URLs are configured correctly
- Check Supabase Auth logs

### Migration errors
- Restore from backup
- Check for foreign key violations
- Verify all tables exist before migration

---

## ✅ Success Checklist

- [ ] Database migration completed successfully
- [ ] Supabase Auth configured (Google, Microsoft, Email)
- [ ] Environment variables updated (Render, Cloudflare, local)
- [ ] Backend routes updated to use Supabase Auth
- [ ] Frontend components updated
- [ ] Authentication flow working
- [ ] RLS policies enforcing correctly
- [ ] API endpoints returning correct data
- [ ] No console errors
- [ ] Webhooks still working

---

## 📞 Next Steps

After completing this implementation:
1. Proceed to Phase 3: Separate calendar OAuth
2. Build onboarding flow (Phase 4)
3. Comprehensive testing (Phase 5)

---

## 📚 Reference Documents

- `MULTI_TENANT_IMPLEMENTATION_STATUS.md` - Overall status
- `docs/SUPABASE_AUTH_SETUP.md` - Detailed Supabase Auth setup
- `backend/migrations/PHASE1_MIGRATION_README.md` - Migration guide
- `backend/src/lib/supabase.js` - Code documentation
- `backend/src/middleware/supabaseAuth.js` - Middleware documentation

