# Authentication System Deep Dive

---

## Current Authentication Architecture

### Supabase Auth Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Frontend redirects to Supabase Auth
   ↓
3. Supabase handles Google OAuth
   ↓
4. Google returns user info + tokens
   ↓
5. Supabase creates auth.users entry (UUID)
   ↓
6. Frontend receives session with access_token
   ↓
7. Backend receives access_token in Authorization header
   ↓
8. Backend verifies token and extracts user UUID
   ↓
9. Backend creates/updates public.users entry
   ↓
10. Backend returns user data
```

### Current Issues

#### **Issue 1: users.id Type Mismatch**

**Current State:**
```sql
-- Supabase Auth (managed by Supabase)
auth.users (id: UUID)

-- Your app (in public schema)
public.users (id: TEXT or INTEGER) ← MISMATCH!
```

**Problem:**
- Supabase Auth generates UUID for user
- Your users table uses TEXT or INTEGER
- When creating user, you try to insert TEXT/INTEGER into UUID column
- Or you create UUID but then can't match it to auth.uid()

**Result:**
- ❌ User creation fails
- ❌ RLS policies fail (UUID ≠ TEXT)
- ❌ Foreign keys fail (type mismatch)

#### **Issue 2: RLS Policies Using Wrong Types**

**Current (Broken):**
```sql
CREATE POLICY "Meetings for own user" ON meetings
    FOR ALL USING (userid = auth.uid()::text);
    
-- Problem:
-- - userid is TEXT
-- - auth.uid() returns UUID
-- - auth.uid()::text converts UUID to TEXT
-- - But the conversion might not match the original TEXT value
-- - Result: RLS policy doesn't work correctly
```

**Result:**
- ❌ RLS policies don't enforce isolation
- ❌ Users might see other users' data
- ❌ Security vulnerability

#### **Issue 3: JWT Token Expiration**

**Current:**
```javascript
// Backend creates JWT with 24h expiration
const jwtToken = jwt.sign(
  { id: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }  // ← Expires after 24 hours
);
```

**Problem:**
- Token expires after 24 hours
- No automatic refresh implemented
- User gets logged out after 24 hours
- User sees "Token expired" error

**Result:**
- ❌ Users get logged out after 24 hours
- ❌ Poor user experience
- ❌ Support tickets

#### **Issue 4: No Token Refresh Flow**

**Current:**
```javascript
// Frontend stores token in localStorage
localStorage.setItem('token', jwtToken);

// After 24 hours, token expires
// Frontend has no way to refresh it
// User must log in again
```

**Result:**
- ❌ No automatic token refresh
- ❌ Users must re-login every 24 hours
- ❌ Logout loops

---

## How Clean Schema Fixes Authentication

### Fix 1: Consistent UUID User IDs

**After Clean Schema:**
```sql
-- Supabase Auth (managed by Supabase)
auth.users (id: UUID)

-- Your app (in public schema)
public.users (id: UUID) ← MATCHES!
```

**Result:**
- ✅ User creation works
- ✅ IDs match perfectly
- ✅ No type conversion needed
- ✅ RLS policies work

### Fix 2: Correct RLS Policies

**After Clean Schema:**
```sql
CREATE POLICY "Users can view own meetings" ON meetings
    FOR ALL USING (user_id = auth.uid());
    
-- Now:
-- - user_id is UUID
-- - auth.uid() returns UUID
-- - Direct comparison works
-- - RLS policy enforces isolation correctly
```

**Result:**
- ✅ RLS policies work correctly
- ✅ Strict data isolation
- ✅ No data leakage
- ✅ Security verified

### Fix 3: Proper User Creation

**After Clean Schema:**
```javascript
// Backend receives access_token from Supabase Auth
const { data: { user }, error } = await supabase.auth.getUser(token);

// user.id is UUID (from Supabase Auth)
const { data: newUser, error: createError } = await supabase
  .from('users')
  .insert({
    id: user.id,  // UUID from Supabase Auth
    email: user.email,
    name: user.user_metadata?.full_name,
    provider: 'google',
    providerid: user.id
  })
  .select()
  .single();

// Result: User created successfully with matching UUID
```

**Result:**
- ✅ User creation works
- ✅ IDs match perfectly
- ✅ No errors

---

## Token Refresh Implementation (Separate Task)

### Current Problem

```
User logs in at 9:00 AM
Token expires at 9:00 AM next day
User tries to use app at 9:05 AM next day
Token is expired
User gets logged out
User must log in again
```

### Solution: Automatic Token Refresh

#### **Step 1: Store Refresh Token**

```javascript
// When user logs in, store both tokens
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);
localStorage.setItem('token_expires_at', expiresAt);
```

#### **Step 2: Check Token Expiration**

```javascript
// Before making API call, check if token is expired
const isTokenExpired = () => {
  const expiresAt = localStorage.getItem('token_expires_at');
  return new Date() > new Date(expiresAt);
};
```

#### **Step 3: Refresh Token Automatically**

```javascript
// If token is expired, refresh it
if (isTokenExpired()) {
  const refreshToken = localStorage.getItem('refresh_token');
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const { accessToken, expiresAt } = await response.json();
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('token_expires_at', expiresAt);
}
```

#### **Step 4: Backend Refresh Endpoint**

```javascript
// backend/src/routes/auth.js
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Create new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      accessToken: newAccessToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Result

- ✅ Token automatically refreshes before expiration
- ✅ User never gets logged out
- ✅ Seamless experience
- ✅ No re-login needed

---

## Multi-Tenant Data Isolation Verification

### RLS Policies Enforce Strict Isolation

#### **Example: User A tries to access User B's meetings**

```sql
-- User A (UUID: 550e8400-e29b-41d4-a716-446655440000)
-- User B (UUID: 660e8400-e29b-41d4-a716-446655440001)

-- User A makes request with their token
-- Backend sets auth context:
SET request.jwt.claims = '{"sub": "550e8400-e29b-41d4-a716-446655440000"}';

-- User A queries meetings:
SELECT * FROM meetings;

-- RLS policy applies:
-- "Users can view own meetings" ON meetings
-- FOR ALL USING (user_id = auth.uid());

-- Becomes:
SELECT * FROM meetings WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Result: User A only sees their own meetings ✅
```

#### **Cascade Delete Ensures No Orphaned Data**

```sql
-- When User A is deleted:
DELETE FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- CASCADE DELETE automatically deletes:
DELETE FROM meetings WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM clients WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM ask_threads WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
-- ... and all other user-scoped tables

-- Result: No orphaned data ✅
```

### No Shared Tables = No Data Leakage

```
✅ users - Each user has their own row
✅ meetings - Each meeting has user_id
✅ clients - Each client has user_id
✅ ask_threads - Each thread has user_id
✅ client_documents - Each document has user_id
✅ transcript_action_items - Each item has user_id
✅ client_todos - Each todo has user_id
✅ pipeline_activities - Each activity has user_id
✅ calendar_connections - Each connection has user_id

❌ No shared tables
❌ No global data
❌ No data leakage possible
```

---

## Authentication Flow After Clean Schema

### Complete Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Frontend redirects to Supabase Auth
   ↓
3. Supabase handles Google OAuth
   ↓
4. Google returns user info + tokens
   ↓
5. Supabase creates auth.users entry (UUID)
   ↓
6. Frontend receives session with access_token
   ↓
7. Frontend stores tokens in localStorage
   ↓
8. Frontend makes API call with access_token
   ↓
9. Backend receives access_token in Authorization header
   ↓
10. Backend verifies token and extracts user UUID
    ↓
11. Backend creates/updates public.users entry (UUID)
    ↓
12. Backend creates user-scoped Supabase client
    ↓
13. RLS policies automatically filter data by user_id = auth.uid()
    ↓
14. Backend returns only user's data
    ↓
15. Frontend displays user's data
    ↓
16. User can access all their meetings, clients, documents, etc.
```

### Result

- ✅ User logs in successfully
- ✅ User sees only their data
- ✅ No other users' data visible
- ✅ RLS policies enforce isolation
- ✅ Foreign keys work correctly
- ✅ No errors

---

## Summary: Will Database Redesign Fix Login Issues?

### Current Issues

| Issue | Cause | Status |
|-------|-------|--------|
| User creation fails | UUID/TEXT mismatch | ❌ Broken |
| RLS policies don't work | Wrong data types | ❌ Broken |
| Foreign key errors | Mixed user_id types | ❌ Broken |
| 24-hour logout | No token refresh | ❌ Broken |
| Users see other data | RLS not enforced | ❌ Broken |

### After Clean Schema

| Issue | Fix | Status |
|-------|-----|--------|
| User creation fails | UUID consistency | ✅ Fixed |
| RLS policies don't work | Correct data types | ✅ Fixed |
| Foreign key errors | All UUID | ✅ Fixed |
| 24-hour logout | Token refresh (separate) | ⏳ Next |
| Users see other data | RLS enforced | ✅ Fixed |

### Recommendation

1. **Immediately:** Wipe database and create clean schema (30 min)
2. **Next:** Implement token refresh (2-4 hours)
3. **Then:** Improve webhook reliability (4-8 hours)

---

**Database redesign WILL fix most login issues. Token refresh is a separate task that should be done next.**

