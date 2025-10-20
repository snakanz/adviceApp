# Multi-Tenant Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  React Frontend (Cloudflare Pages)                           │ │
│  │  - AuthContext (Supabase Auth)                               │ │
│  │  - LoginPage, Onboarding, Meetings, Clients                  │ │
│  │  - API Service (with Supabase tokens)                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              │ HTTPS + JWT                          │
│                              ↓                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────────┐ │
│  │  Supabase Auth                                                │ │
│  │  - Google OAuth                                               │ │
│  │  - Microsoft OAuth                                            │ │
│  │  - Email/Password                                             │ │
│  │  - JWT Generation & Verification                              │ │
│  │  - Session Management                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              │ JWT with auth.uid()                  │
│                              ↓                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Node/Express Backend (Render)                                │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  Middleware Layer                                        │ │ │
│  │  │  - authenticateSupabaseUser (verifies JWT)              │ │ │
│  │  │  - Creates user-scoped Supabase client                  │ │ │
│  │  │  - Attaches req.user & req.supabase                     │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  API Routes                                              │ │ │
│  │  │  - /api/meetings (uses req.supabase)                    │ │ │
│  │  │  - /api/clients (uses req.supabase)                     │ │ │
│  │  │  - /api/ask-advicly (uses req.supabase)                 │ │ │
│  │  │  - /api/calendly (webhook - uses service role)          │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                     │
│                               │ User-scoped queries                 │
│                               ↓                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Supabase PostgreSQL Database                                 │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  Row Level Security (RLS)                                │ │ │
│  │  │  - Enforces auth.uid() = advisor_id                     │ │ │
│  │  │  - Automatic tenant isolation                           │ │ │
│  │  │  - No manual filtering needed                           │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  Tables:                                                       │ │
│  │  - users (id: UUID)                                            │ │
│  │  - calendar_integrations (advisor_id: UUID)                   │ │
│  │  - meetings (userid: UUID)                                     │ │
│  │  - clients (advisor_id: UUID)                                  │ │
│  │  - ask_threads (advisor_id: UUID)                              │ │
│  │  - client_documents (advisor_id: UUID)                         │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                         SUPABASE PLATFORM                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

### Sign Up Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Clicks "Sign up with Google"
     ↓
┌──────────────────┐
│  LoginPage.js    │
│  signInWithOAuth │
└────┬─────────────┘
     │
     │ 2. Calls Supabase Auth
     ↓
┌──────────────────┐
│  Supabase Auth   │
│  OAuth Flow      │
└────┬─────────────┘
     │
     │ 3. Redirects to Google
     ↓
┌──────────────────┐
│  Google OAuth    │
│  Consent Screen  │
└────┬─────────────┘
     │
     │ 4. User approves
     ↓
┌──────────────────┐
│  Supabase Auth   │
│  Creates User    │
│  Generates JWT   │
└────┬─────────────┘
     │
     │ 5. Redirects to /auth/callback?token=...
     ↓
┌──────────────────┐
│  AuthCallback.js │
│  Stores Session  │
└────┬─────────────┘
     │
     │ 6. Checks onboarding_completed
     ↓
┌──────────────────┐
│  If false:       │
│  → /onboarding   │
│                  │
│  If true:        │
│  → /meetings     │
└──────────────────┘
```

### API Request Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Clicks "View Meetings"
     ↓
┌──────────────────┐
│  Meetings.js     │
│  useEffect       │
└────┬─────────────┘
     │
     │ 2. Calls api.getMeetings()
     ↓
┌──────────────────┐
│  api.js          │
│  getAccessToken  │
└────┬─────────────┘
     │
     │ 3. GET /api/meetings
     │    Authorization: Bearer <JWT>
     ↓
┌──────────────────────────────┐
│  Backend Middleware          │
│  authenticateSupabaseUser    │
│  - Verifies JWT              │
│  - Creates user-scoped client│
│  - Sets req.user & req.supabase
└────┬─────────────────────────┘
     │
     │ 4. req.supabase.from('meetings').select('*')
     ↓
┌──────────────────────────────┐
│  Supabase Database           │
│  RLS Policy:                 │
│  WHERE userid = auth.uid()   │
└────┬─────────────────────────┘
     │
     │ 5. Returns only user's meetings
     ↓
┌──────────────────┐
│  Backend Route   │
│  res.json(data)  │
└────┬─────────────┘
     │
     │ 6. JSON response
     ↓
┌──────────────────┐
│  Meetings.js     │
│  Displays data   │
└──────────────────┘
```

---

## 🗄️ Database Schema

### Users Table (UUID-based)

```
users
├── id: UUID (PRIMARY KEY) ← auth.uid()
├── email: TEXT (UNIQUE)
├── name: TEXT
├── provider: TEXT ('google', 'microsoft', 'email')
├── providerid: TEXT
├── profilepicture: TEXT
├── onboarding_completed: BOOLEAN
├── onboarding_step: INTEGER
├── business_name: TEXT
├── timezone: TEXT
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

RLS Policy: id = auth.uid()
```

### Calendar Integrations Table (NEW)

```
calendar_integrations
├── id: UUID (PRIMARY KEY)
├── advisor_id: UUID → users(id) ON DELETE CASCADE
├── provider: TEXT ('google', 'microsoft', 'calendly')
├── provider_account_email: TEXT
├── access_token: TEXT (encrypted)
├── refresh_token: TEXT (encrypted)
├── token_expires_at: TIMESTAMP
├── calendly_user_uri: TEXT
├── calendly_webhook_id: TEXT
├── is_primary: BOOLEAN
├── is_active: BOOLEAN
├── sync_enabled: BOOLEAN
├── last_sync_at: TIMESTAMP
├── sync_status: TEXT
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

UNIQUE(advisor_id, provider, provider_account_email)
RLS Policy: advisor_id = auth.uid()
```

### Meetings Table

```
meetings
├── id: SERIAL (PRIMARY KEY)
├── userid: UUID → users(id) ON DELETE CASCADE
├── calendar_integration_id: UUID → calendar_integrations(id)
├── meeting_source: TEXT ('google', 'microsoft', 'calendly', 'manual')
├── googleeventid: TEXT
├── calendly_event_uuid: TEXT
├── client_id: UUID → clients(id)
├── title: TEXT
├── starttime: TIMESTAMP
├── endtime: TIMESTAMP
├── summary: TEXT
├── transcript: TEXT
├── notes: TEXT
├── attendees: JSONB
├── is_deleted: BOOLEAN
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

RLS Policy: userid = auth.uid()
```

### Clients Table

```
clients
├── id: UUID (PRIMARY KEY)
├── advisor_id: UUID → users(id) ON DELETE CASCADE
├── email: TEXT
├── name: TEXT
├── business_type: TEXT
├── pipeline_stage: TEXT
├── iaf_expected: NUMERIC
├── likely_close_month: TEXT
├── notes: TEXT
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

UNIQUE(advisor_id, email)
RLS Policy: advisor_id = auth.uid()
```

---

## 🔄 Onboarding Flow (Planned)

```
Step 1: Welcome & Sign Up
┌─────────────────────────┐
│  Choose sign up method: │
│  • Google               │
│  • Microsoft            │
│  • Email/Password       │
└────────┬────────────────┘
         │
         ↓
Step 2: Business Profile
┌─────────────────────────┐
│  Enter:                 │
│  • Business Name        │
│  • Timezone             │
│  • (other info)         │
└────────┬────────────────┘
         │
         ↓
Step 3: Calendar Choice
┌─────────────────────────┐
│  Choose calendar:       │
│  • Google Calendar      │
│  • Microsoft Outlook    │
│  • Calendly             │
│  • Skip for now         │
└────────┬────────────────┘
         │
         ↓
Step 4: Calendar OAuth
┌─────────────────────────┐
│  Connect calendar       │
│  (separate OAuth flow)  │
└────────┬────────────────┘
         │
         ↓
Step 5: Initial Sync
┌─────────────────────────┐
│  Fetch meetings         │
│  Extract clients        │
│  Show progress          │
└────────┬────────────────┘
         │
         ↓
Step 6: Complete
┌─────────────────────────┐
│  Mark onboarding done   │
│  Redirect to /meetings  │
└─────────────────────────┘
```

---

## 🔑 Key Security Features

### 1. Row Level Security (RLS)

```sql
-- Automatic filtering by auth.uid()
CREATE POLICY "Meetings for own user" ON meetings 
FOR ALL USING (userid = auth.uid());

-- No manual filtering needed in application code!
```

### 2. User-Scoped Clients

```javascript
// Each request gets its own client with user context
const userSupabase = createUserClient(userJWT);

// Queries automatically filtered
const { data } = await userSupabase.from('meetings').select('*');
// Returns ONLY meetings where userid = auth.uid()
```

### 3. Service Role Isolation

```javascript
// Service role ONLY for webhooks/cron jobs
const { getSupabase } = require('../lib/supabase');
const adminSupabase = getSupabase(); // Bypasses RLS

// NEVER use for user requests!
```

### 4. Tenant Isolation

```
Advisor 1 (UUID: 550e8400-...)
├── Meetings: 404 records
├── Clients: 236 records
└── Documents: 50 files

Advisor 2 (UUID: 660f9511-...)
├── Meetings: 0 records (can't see Advisor 1's data)
├── Clients: 0 records (can't see Advisor 1's data)
└── Documents: 0 files (can't see Advisor 1's data)

RLS ensures complete isolation!
```

---

## 📊 Data Flow Examples

### Example 1: User Views Meetings

```
1. User authenticated → JWT contains: { sub: "550e8400-..." }
2. Frontend calls: GET /api/meetings
3. Backend middleware verifies JWT
4. Backend creates user-scoped client with JWT
5. Backend queries: SELECT * FROM meetings
6. RLS policy applies: WHERE userid = '550e8400-...'
7. Returns only user's meetings
```

### Example 2: Calendly Webhook

```
1. Calendly sends webhook: POST /api/calendly/webhook
2. Backend uses service role (no user context)
3. Backend determines which user owns the event
4. Backend inserts: INSERT INTO meetings (userid, ...)
5. RLS allows insert (service role bypasses)
6. User sees new meeting on next page load
```

### Example 3: Calendar Integration

```
1. User completes onboarding
2. Chooses "Connect Google Calendar"
3. Separate OAuth flow (calendar scopes only)
4. Backend stores tokens in calendar_integrations
5. Backend fetches events from Google
6. Backend inserts meetings with calendar_integration_id
7. User sees synced meetings
```

---

## 🎯 Benefits of This Architecture

1. **Security**: RLS enforces tenant isolation at database level
2. **Scalability**: Supports thousands of advisors
3. **Maintainability**: No manual filtering in application code
4. **Flexibility**: Separate auth from calendar integration
5. **Compliance**: GDPR-ready with proper data isolation
6. **Performance**: Optimized with indexes and RLS
7. **Developer Experience**: Clear separation of concerns

---

## 📚 Related Documentation

- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation
- `IMPLEMENTATION_SUMMARY.md` - What's done, what remains
- `QUICK_REFERENCE.md` - Quick lookup guide
- `docs/SUPABASE_AUTH_SETUP.md` - Supabase configuration

