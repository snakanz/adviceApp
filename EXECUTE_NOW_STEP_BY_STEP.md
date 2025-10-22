# 🚀 Execute Database Wipe NOW - Step by Step

---

## ⚠️ CRITICAL: BACKUP FIRST

### Step 1: Create Backup (5 minutes)

**IMPORTANT: Do this FIRST!**

```
1. Go to: https://app.supabase.com
2. Select your Advicly project
3. Click: Settings (bottom left)
4. Click: Database
5. Click: Backups
6. Click: "Create a backup"
7. Wait for completion (usually 2-5 minutes)
8. Verify backup was created successfully
```

**✅ Backup Confirmation:**
- [ ] Backup created
- [ ] Backup shows in list
- [ ] Backup timestamp is recent

---

## 🗑️ Step 2: Execute Wipe & Clean Schema (5 minutes)

### In Supabase SQL Editor

```
1. Go to: https://app.supabase.com
2. Select your Advicly project
3. Click: SQL Editor (left sidebar)
4. Click: "New query"
5. Copy ENTIRE contents of: DATABASE_WIPE_AND_CLEAN_SCHEMA.sql
6. Paste into SQL Editor
7. Click: "Run" (top right)
8. Wait for completion (5-10 minutes)
```

### Expected Output

You should see:
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

**✅ Execution Confirmation:**
- [ ] SQL executed without errors
- [ ] All tables dropped
- [ ] Clean schema created
- [ ] 11 tables created
- [ ] RLS enabled on all tables
- [ ] RLS policies created

---

## ✔️ Step 3: Verify Database Structure (5 minutes)

### Verification Query 1: Check All Tables Exist

**In Supabase SQL Editor, run:**

```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected Result:**
```
ask_messages
ask_threads
calendar_connections
client_business_types
client_documents
client_todos
clients
meetings
pipeline_activities
transcript_action_items
users
(11 rows)
```

**✅ Confirmation:**
- [ ] All 11 tables exist
- [ ] No extra tables
- [ ] No deprecated tables

---

### Verification Query 2: Check RLS is Enabled

**In Supabase SQL Editor, run:**

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected Result:**
```
All tables have rowsecurity = true
```

**✅ Confirmation:**
- [ ] All 11 tables have RLS enabled
- [ ] No tables have RLS disabled

---

### Verification Query 3: Check RLS Policies Exist

**In Supabase SQL Editor, run:**

```sql
SELECT COUNT(*) as policy_count FROM pg_policies 
WHERE schemaname = 'public';
```

**Expected Result:**
```
policy_count: 11 (at least one policy per table)
```

**✅ Confirmation:**
- [ ] At least 11 policies created
- [ ] Each table has at least one policy

---

## 👤 Step 4: Re-Register User (2 minutes)

### User Re-Registration

**User needs to:**

```
1. Go to: https://adviceapp.pages.dev
2. Click: "Sign in with Google"
3. Select Google account
4. Complete OAuth flow
5. Accept permissions
6. Redirected to onboarding
```

**Expected:**
- [ ] User created in database
- [ ] User has UUID id
- [ ] Onboarding page appears
- [ ] No errors in console

**Verify in Supabase:**

```sql
SELECT id, email, onboarding_completed FROM users;
```

**Expected Result:**
```
id: (UUID like 550e8400-e29b-41d4-a716-446655440000)
email: snaka1003@gmail.com
onboarding_completed: false
```

**✅ Confirmation:**
- [ ] User created with UUID id
- [ ] Email matches
- [ ] Onboarding not completed yet

---

## 📅 Step 5: Connect Google Calendar (5 minutes)

### Re-Sync Calendar

**User needs to:**

```
1. Complete onboarding (or skip to main app)
2. Go to: Settings → Calendar Integrations
3. Click: "Connect Google Calendar"
4. Select Google account
5. Accept permissions
6. Redirected back to Settings
```

**Expected:**
- [ ] Calendar connection created
- [ ] Webhook setup automatic
- [ ] Initial sync automatic
- [ ] Meetings appear within 5 seconds
- [ ] "Last sync" shows recent timestamp

**Verify in Supabase:**

```sql
SELECT user_id, provider, is_active, last_sync_at 
FROM calendar_connections;
```

**Expected Result:**
```
user_id: (User's UUID)
provider: google
is_active: true
last_sync_at: (Recent timestamp)
```

**✅ Confirmation:**
- [ ] Calendar connection created
- [ ] Provider is 'google'
- [ ] is_active is true
- [ ] last_sync_at is recent

```sql
SELECT COUNT(*) as meeting_count FROM meetings;
```

**Expected Result:**
```
meeting_count: > 0 (at least some meetings synced)
```

**✅ Confirmation:**
- [ ] Meetings synced from Google Calendar
- [ ] Meeting count > 0
- [ ] Meetings appear in UI

---

## 🧪 Step 6: Verify Success (10 minutes)

### In Frontend (https://adviceapp.pages.dev)

```
1. Log in with Google
2. Check Meetings page
   - [ ] Meetings appear
   - [ ] No errors in console
3. Check Clients page
   - [ ] Page loads
   - [ ] No errors in console
4. Check Settings → Calendar Integrations
   - [ ] Calendar shows as connected
   - [ ] "Last sync" shows recent time
   - [ ] Provider shows "Google"
5. Check Ask Advicly
   - [ ] Can create new conversation
   - [ ] Can send messages
   - [ ] No errors in console
```

**✅ Success Confirmation:**
- [ ] User can log in
- [ ] Meetings appear
- [ ] Calendar connected
- [ ] No errors in console
- [ ] RLS policies work
- [ ] Data isolation verified

---

## 🎉 COMPLETE!

### All Steps Done?

- [ ] Backup created
- [ ] Database wiped
- [ ] Clean schema created
- [ ] 11 tables verified
- [ ] RLS enabled and verified
- [ ] User re-registered
- [ ] Calendar connected
- [ ] Meetings synced
- [ ] Frontend verified
- [ ] No errors in logs

---

## 📞 Troubleshooting

### Issue: "Table already exists"

**Solution:** Drop schema and recreate
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then run DATABASE_WIPE_AND_CLEAN_SCHEMA.sql again
```

### Issue: "RLS policy violation"

**Solution:** Check RLS policies
```sql
SELECT tablename, policyname, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### Issue: "User can't log in"

**Solution:** Check users table
```sql
SELECT * FROM users;
-- If empty, user needs to re-register
```

### Issue: "Meetings not showing"

**Solution:** Check calendar connection
```sql
SELECT * FROM calendar_connections;
-- If empty, user needs to connect calendar
```

---

## 🚀 Ready?

**Follow these steps in order:**

1. ✅ Create backup (5 min)
2. ✅ Execute wipe & schema (5 min)
3. ✅ Verify structure (5 min)
4. ✅ Re-register user (2 min)
5. ✅ Connect calendar (5 min)
6. ✅ Verify success (10 min)

**Total: 32 minutes**

---

**Let's do this! 🚀**

