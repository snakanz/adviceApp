# Multi-Tenant Implementation - Quick Reference

## 📁 File Structure

```
adviceApp/
├── backend/
│   ├── migrations/
│   │   ├── PHASE1_MULTI_TENANT_MIGRATION.sql ✅ NEW
│   │   ├── PHASE1_MULTI_TENANT_MIGRATION_PART2.sql ✅ NEW
│   │   └── PHASE1_MIGRATION_README.md ✅ NEW
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.js ✅ UPDATED
│   │   ├── middleware/
│   │   │   ├── auth.js (legacy)
│   │   │   └── supabaseAuth.js ✅ NEW
│   │   └── routes/
│   │       ├── auth.js ⏳ NEEDS UPDATE
│   │       ├── meetings.js ⏳ NEEDS UPDATE
│   │       ├── clients.js ⏳ NEEDS UPDATE
│   │       └── calendly.js ⏳ NEEDS UPDATE
│   └── .env.example ✅ UPDATED
├── src/
│   ├── context/
│   │   └── AuthContext.js ✅ UPDATED
│   ├── pages/
│   │   ├── LoginPage.js ⏳ NEEDS UPDATE
│   │   └── AuthCallback.js ⏳ NEEDS UPDATE
│   └── services/
│       └── api.js ⏳ NEEDS UPDATE
├── docs/
│   └── SUPABASE_AUTH_SETUP.md ✅ NEW
├── IMPLEMENTATION_GUIDE.md ✅ NEW
├── IMPLEMENTATION_SUMMARY.md ✅ NEW
└── MULTI_TENANT_IMPLEMENTATION_STATUS.md ✅ NEW
```

---

## 🔑 Key Concepts

### Before (Single-User)
```javascript
// Backend
const supabase = getSupabase(); // Service role (bypasses RLS)
const { data } = await supabase
  .from('meetings')
  .select('*')
  .eq('userid', userId); // Manual filtering

// Frontend
const token = localStorage.getItem('jwt'); // Custom JWT
```

### After (Multi-Tenant)
```javascript
// Backend
const userSupabase = createUserClient(userJWT); // User-scoped
const { data } = await userSupabase
  .from('meetings')
  .select('*'); // RLS auto-filters by auth.uid()

// Frontend
const { session } = useAuth(); // Supabase Auth
const token = session.access_token;
```

---

## 🗄️ Database Schema Changes

### Users Table
```sql
-- Before
id: TEXT/INTEGER
email: TEXT
name: TEXT

-- After
id: UUID (550e8400-e29b-41d4-a716-446655440000)
email: TEXT
name: TEXT
onboarding_completed: BOOLEAN
onboarding_step: INTEGER
business_name: TEXT
timezone: TEXT
```

### New Table: calendar_integrations
```sql
id: UUID
advisor_id: UUID → users(id)
provider: TEXT ('google', 'microsoft', 'calendly')
provider_account_email: TEXT
access_token: TEXT
refresh_token: TEXT
token_expires_at: TIMESTAMP
is_primary: BOOLEAN
is_active: BOOLEAN
```

---

## 🔐 Authentication Flow

### Old Flow (Custom JWT)
```
1. User clicks "Sign in with Google"
2. Backend OAuth → Google
3. Backend creates custom JWT
4. Frontend stores JWT in localStorage
5. Backend verifies JWT on each request
6. Backend manually filters by user ID
```

### New Flow (Supabase Auth)
```
1. User clicks "Sign in with Google"
2. Frontend → Supabase Auth → Google
3. Supabase creates session with JWT
4. Frontend stores session automatically
5. Backend verifies Supabase JWT
6. RLS automatically filters by auth.uid()
```

---

## 🛠️ Code Patterns

### Backend Middleware

```javascript
// OLD
const { authenticateUser } = require('../middleware/auth');
router.get('/api/meetings', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { data } = await getSupabase()
    .from('meetings')
    .select('*')
    .eq('userid', userId); // Manual filter
});

// NEW
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
router.get('/api/meetings', authenticateSupabaseUser, async (req, res) => {
  // req.user.id is UUID from Supabase Auth
  // req.supabase is user-scoped client
  const { data } = await req.supabase
    .from('meetings')
    .select('*'); // RLS auto-filters
});
```

### Frontend Authentication

```javascript
// OLD
const handleGoogleLogin = async () => {
  const response = await fetch('/api/auth/google');
  const { url } = await response.json();
  window.location.href = url;
};

// NEW
const { signInWithOAuth } = useAuth();
const handleGoogleLogin = async () => {
  await signInWithOAuth('google');
  // Supabase handles redirect
};
```

### Frontend API Calls

```javascript
// OLD
const token = localStorage.getItem('jwt');
const response = await fetch('/api/meetings', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// NEW
const { getAccessToken } = useAuth();
const token = await getAccessToken();
const response = await fetch('/api/meetings', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🔧 Environment Variables

### Backend (.env)
```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional (can remove after migration)
JWT_SECRET=...
```

### Frontend (.env)
```bash
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_API_BASE_URL=https://adviceapp-9rgw.onrender.com
```

---

## 📝 Common Tasks

### Get User ID in Backend
```javascript
// After authenticateSupabaseUser middleware
const userId = req.user.id; // UUID
```

### Query with RLS
```javascript
// Automatically filtered by auth.uid()
const { data } = await req.supabase
  .from('meetings')
  .select('*');
```

### Query as Admin (Webhooks)
```javascript
// Use service role (bypasses RLS)
const { getSupabase } = require('../lib/supabase');
const supabase = getSupabase();
const { data } = await supabase
  .from('meetings')
  .select('*')
  .eq('userid', specificUserId);
```

### Check Onboarding Status
```javascript
const { requireOnboarding } = require('../middleware/supabaseAuth');
router.get('/api/meetings', 
  authenticateSupabaseUser, 
  requireOnboarding, // Checks onboarding_completed
  async (req, res) => {
    // User has completed onboarding
  }
);
```

---

## 🧪 Testing Queries

### Verify Migration
```sql
-- Check users table
SELECT id, email, onboarding_completed FROM users;

-- Check calendar integrations
SELECT advisor_id, provider, is_primary FROM calendar_integrations;

-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'meetings', 'clients');
```

### Test RLS
```sql
-- Should fail (no auth context)
SELECT * FROM meetings;

-- Set auth context
SET request.jwt.claims = '{"sub": "550e8400-e29b-41d4-a716-446655440000"}';

-- Should work
SELECT * FROM meetings;
```

---

## 🚨 Common Issues

### "Invalid token"
- Check `SUPABASE_ANON_KEY` is set
- Verify token in Authorization header
- Check Supabase Auth logs

### "No data returned"
- Verify RLS policies exist
- Check `auth.uid()` matches user ID
- Test query in SQL Editor with auth context

### "User not found"
- Check user exists in Supabase Auth
- Verify redirect URLs configured
- Check Supabase Auth logs

### Migration errors
- Restore from backup
- Check foreign key violations
- Verify all tables exist

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| `IMPLEMENTATION_GUIDE.md` | Step-by-step implementation |
| `IMPLEMENTATION_SUMMARY.md` | What's been done, what remains |
| `MULTI_TENANT_IMPLEMENTATION_STATUS.md` | Detailed status tracking |
| `docs/SUPABASE_AUTH_SETUP.md` | Supabase Auth configuration |
| `backend/migrations/PHASE1_MIGRATION_README.md` | Database migration guide |
| `QUICK_REFERENCE.md` | This file - quick lookup |

---

## ⚡ Quick Commands

### Run Migration
```bash
# In Supabase SQL Editor
# 1. Copy PHASE1_MULTI_TENANT_MIGRATION.sql
# 2. Paste and run
# 3. Copy PHASE1_MULTI_TENANT_MIGRATION_PART2.sql
# 4. Paste and run
```

### Test Backend Locally
```bash
cd backend
npm install
npm start
```

### Test Frontend Locally
```bash
npm install
npm start
```

### Deploy Backend
```bash
git add .
git commit -m "Update to Supabase Auth"
git push
# Render auto-deploys
```

### Deploy Frontend
```bash
git push
# Cloudflare Pages auto-deploys
```

---

## 🎯 Next Steps Checklist

- [ ] Run database migration
- [ ] Configure Supabase Auth
- [ ] Update environment variables
- [ ] Update backend endpoints
- [ ] Update frontend components
- [ ] Test authentication flow
- [ ] Implement calendar separation
- [ ] Build onboarding flow
- [ ] Comprehensive testing
- [ ] Deploy to production

---

## 📞 Need Help?

1. Check the relevant documentation file
2. Review troubleshooting sections
3. Check Supabase logs
4. Test with verification queries
5. Restore from backup if needed

**Start here:** `IMPLEMENTATION_GUIDE.md`

