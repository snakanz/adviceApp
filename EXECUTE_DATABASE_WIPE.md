# Execute Database Wipe: Step-by-Step Instructions

---

## ⚠️ CRITICAL: BACKUP FIRST

### Step 1: Create Backup in Supabase

**DO THIS FIRST - Safety is critical!**

```
1. Go to: https://app.supabase.com
2. Select your project
3. Go to: Settings → Database → Backups
4. Click: "Create a backup"
5. Wait for completion (usually 2-5 minutes)
6. Verify backup was created successfully
```

**Screenshot confirmation needed before proceeding!**

---

## Execute Database Wipe

### Step 2: Run Wipe & Clean Schema SQL

**In Supabase SQL Editor:**

```
1. Go to: https://app.supabase.com
2. Select your project
3. Go to: SQL Editor
4. Click: "New query"
5. Copy entire contents of: DATABASE_WIPE_AND_CLEAN_SCHEMA.sql
6. Paste into SQL Editor
7. Click: "Run"
8. Wait for completion (5-10 minutes)
```

**Expected output:**
```
All tables dropped
Clean schema created
Indexes created
RLS enabled on all tables
RLS policies created
VERIFICATION RESULTS:
table_count: 11
(All 11 tables listed with RLS enabled)
```

---

## Verify Database Structure

### Step 3: Verify Clean Schema

**Run verification queries in Supabase SQL Editor:**

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected: 11 tables
-- users, calendar_connections, meetings, clients, 
-- client_business_types, pipeline_activities, client_todos,
-- client_documents, ask_threads, ask_messages, transcript_action_items

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected: All tables have rowsecurity = true

-- Check RLS policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected: Each table has at least one policy
```

---

## Re-Register User

### Step 4: User Re-Registration

**User needs to:**

```
1. Go to: https://adviceapp.pages.dev
2. Click: "Sign in with Google"
3. Complete Google OAuth flow
4. User created with UUID id
5. Onboarding starts
```

**Expected:**
- ✅ User created in users table with UUID id
- ✅ Onboarding page appears
- ✅ No errors in console

---

## Re-Sync Calendar

### Step 5: Connect Google Calendar

**User needs to:**

```
1. Complete onboarding (or skip to main app)
2. Go to: Settings → Calendar Integrations
3. Click: "Connect Google Calendar"
4. Complete Google OAuth flow
5. Webhook setup automatic
6. Initial sync automatic
```

**Expected:**
- ✅ Calendar connection created
- ✅ Webhook setup successful
- ✅ Initial sync completes
- ✅ Meetings appear within 5 seconds
- ✅ "Last sync" shows recent timestamp

---

## Verify Success

### Step 6: Final Verification

**Check in Supabase:**

```sql
-- Check user was created
SELECT id, email, onboarding_completed FROM users;

-- Expected: 1 row with user's email and UUID id

-- Check calendar connection
SELECT user_id, provider, is_active FROM calendar_connections;

-- Expected: 1 row with user_id, provider='google', is_active=true

-- Check meetings synced
SELECT COUNT(*) as meeting_count FROM meetings;

-- Expected: > 0 (meetings from Google Calendar)

-- Check RLS works
SELECT * FROM meetings;

-- Expected: Only current user's meetings (RLS enforced)
```

**Check in Frontend:**

```
1. Go to: https://adviceapp.pages.dev
2. Log in with Google
3. Check Meetings page
4. Expected: Meetings appear
5. Check Clients page
6. Expected: Clients appear (if any)
7. Check Settings → Calendar Integrations
8. Expected: Calendar connected, "Last sync" shows recent time
```

---

## Backend Code Updates (If Needed)

### Step 7: Update Backend Code

**Check if backend code needs updates:**

The backend should already be using the correct column names:
- `user_id` (not `userid` or `advisor_id`)
- `external_id` (not `googleeventid`)

**If you see errors like:**
- "Column 'userid' does not exist"
- "Column 'advisor_id' does not exist"

**Then update backend code:**

```javascript
// OLD (WRONG):
.eq('userid', userId)
.eq('advisor_id', userId)

// NEW (CORRECT):
.eq('user_id', userId)
.eq('user_id', userId)
```

**Files to check:**
- backend/src/routes/auth.js
- backend/src/routes/calendar.js
- backend/src/routes/clients.js
- backend/src/routes/meetings.js
- backend/src/services/googleCalendarWebhook.js

---

## Troubleshooting

### Issue: "Table already exists"

**Cause:** Tables weren't fully dropped

**Solution:**
```sql
-- Drop all tables manually
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Then run DATABASE_WIPE_AND_CLEAN_SCHEMA.sql again
```

### Issue: "RLS policy violation"

**Cause:** RLS policies not working correctly

**Solution:**
```sql
-- Check RLS policies
SELECT tablename, policyname, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Verify policies use: user_id = auth.uid()
```

### Issue: "Foreign key constraint violation"

**Cause:** Data migration failed

**Solution:**
```sql
-- Check for orphaned records
SELECT COUNT(*) FROM meetings WHERE user_id IS NULL;
SELECT COUNT(*) FROM clients WHERE user_id IS NULL;

-- If any NULL values, restore from backup and try again
```

### Issue: "User can't log in"

**Cause:** User creation failed

**Solution:**
```sql
-- Check users table
SELECT * FROM users;

-- If empty, user needs to re-register
-- Go to login page and sign in with Google again
```

---

## Timeline

| Step | Task | Time |
|------|------|------|
| 1 | Create backup | 5 min |
| 2 | Run wipe & schema | 5 min |
| 3 | Verify structure | 5 min |
| 4 | Re-register user | 2 min |
| 5 | Connect calendar | 5 min |
| 6 | Verify success | 10 min |
| 7 | Update backend (if needed) | 10 min |
| **Total** | | **42 min** |

---

## Success Checklist

- [ ] Backup created
- [ ] Wipe & schema SQL executed
- [ ] 11 tables created
- [ ] RLS enabled on all tables
- [ ] RLS policies created
- [ ] User re-registered
- [ ] Calendar connected
- [ ] Meetings appear
- [ ] No errors in console
- [ ] Backend code updated (if needed)
- [ ] All tests pass

---

## Next Steps After Wipe

### Week 2: Token Refresh (2-4 hours)
- Implement automatic token refresh
- Prevent 24-hour logout
- Improve user experience

### Week 3: Webhook Improvements (4-8 hours)
- Add retry logic
- Add error logging
- Add monitoring dashboard

---

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the analysis documents:
   - CRITICAL_ANALYSIS_MIGRATION_VS_WIPE.md
   - AUTHENTICATION_SYSTEM_DEEP_DIVE.md
3. Check backend logs on Render
4. Check Supabase logs

---

**Ready to execute? Follow the steps above carefully!** ✅

