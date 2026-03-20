# Code Changes Needed for Supabase Auth Migration

## Overview

Your backend has TWO patterns of authentication that need to be updated:

### Pattern 1: Using `authenticateUser` middleware
```javascript
// OLD
const { authenticateUser } = require('../middleware/auth');
router.get('/endpoint', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { data } = await getSupabase()
    .from('table')
    .select('*')
    .eq('advisor_id', userId); // Manual filtering
});

// NEW
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
router.get('/endpoint', authenticateSupabaseUser, async (req, res) => {
  const userId = req.user.id; // Still works!
  const { data } = await req.supabase // Use req.supabase instead
    .from('table')
    .select('*'); // RLS auto-filters
});
```

### Pattern 2: Inline JWT verification
```javascript
// OLD
router.get('/endpoint', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  const token = auth.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;
  
  const { data } = await getSupabase()
    .from('table')
    .select('*')
    .eq('advisor_id', userId);
});

// NEW
router.get('/endpoint', authenticateSupabaseUser, async (req, res) => {
  const userId = req.user.id;
  
  const { data } = await req.supabase
    .from('table')
    .select('*'); // RLS auto-filters
});
```

## Files That Need Updates

### High Priority (User-facing routes)

1. **backend/src/routes/clients.js** - 1765 lines
   - Pattern 2 (inline JWT) throughout
   - Many routes need conversion
   - Critical for client management

2. **backend/src/routes/pipeline.js**
   - Pattern 2 (inline JWT)
   - Critical for pipeline management

3. **backend/src/routes/actionItems.js**
   - Pattern 2 (inline JWT)
   - Critical for action items

4. **backend/src/routes/ask-advicly.js**
   - Pattern 2 (inline JWT)
   - Critical for AI chat

5. **backend/src/routes/transcriptActionItems.js**
   - Pattern 2 (inline JWT)
   - Critical for meeting action items

6. **backend/src/routes/clientDocuments.js**
   - Pattern 2 (inline JWT)
   - Critical for document management

### Medium Priority (Calendar/Integration routes)

7. **backend/src/routes/calendar.js** - 1519 lines
   - Pattern 1 (authenticateUser middleware)
   - Large file with many routes

8. **backend/src/routes/calendly.js**
   - Webhook handler - KEEP service role
   - Only update user-facing routes

### Low Priority (Utility routes)

9. **backend/src/routes/auth.js**
   - Will be replaced with Supabase Auth
   - Keep for now, update later

10. **backend/src/routes/dataImport.js**
    - Admin functionality
    - Update when needed

11. **backend/src/routes/notifications.js**
    - Push notifications
    - Update when needed

## Automated Update Strategy

Given the size and complexity, I recommend a **phased approach**:

### Phase A: Update Middleware Imports (Quick)
- Replace `authenticateUser` imports with `authenticateSupabaseUser`
- This is safe and doesn't break anything

### Phase B: Update Route Handlers (Careful)
- Convert inline JWT to middleware
- Replace `getSupabase()` with `req.supabase`
- Remove manual `.eq('advisor_id', userId)` filters

### Phase C: Test Each Route
- Test one route at a time
- Verify RLS is working
- Check data isolation

## What I Can Do Automatically

I can create a **migration helper script** that:
1. Shows you exactly what needs to change in each file
2. Provides before/after examples
3. Helps you verify changes

## What You Should Do Manually

For safety and control:
1. Update one file at a time
2. Test after each change
3. Commit after each successful update
4. Roll back if something breaks

## Quick Win: Update Just the Imports First

Let me update all the middleware imports right now. This is safe and prepares the files for the full migration.

Then you can update the route handlers one file at a time, testing as you go.

## Estimated Time

- **Automated import updates:** 5 minutes (I do this)
- **Manual route updates:** 2-4 hours (you do this, one file at a time)
- **Testing:** 1-2 hours (you do this)

**Total: 3-6 hours for complete migration**

## Recommendation

**Option 1: Full Automation (Risky)**
- I update all files right now
- You test everything at once
- Higher risk of breaking something
- Faster if it works

**Option 2: Phased Approach (Safe)**
- I update imports only
- You update route handlers one file at a time
- Lower risk, easier to debug
- Takes longer but more controlled

**Which approach do you prefer?**

1. **"Do it all now"** - I'll update everything automatically
2. **"Phased approach"** - I'll update imports, you do the rest
3. **"Show me one example"** - I'll fully update one file as an example

Let me know and I'll proceed accordingly!

