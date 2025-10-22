# 🚀 LIVE EXECUTION GUIDE - Database Wipe & Clean Schema

**Status:** IN PROGRESS
**Timeline:** 30-45 minutes
**Risk:** Very Low

---

## ⚠️ STEP 1: CREATE BACKUP (5 minutes)

### Action: Create Backup in Supabase

```
1. Go to: https://app.supabase.com
2. Select your Advicly project
3. Click: Settings (bottom left sidebar)
4. Click: Database
5. Click: Backups
6. Click: "Create a backup" button
7. Wait for completion (usually 2-5 minutes)
```

### Expected Result:
- Backup appears in the list
- Status shows "Completed"
- Timestamp is recent

### ✅ Confirmation:
- [ ] Backup created successfully
- [ ] Backup shows in list
- [ ] Ready to proceed

**When done, tell me: "Backup created"**

---

## 🗑️ STEP 2: OPEN SQL EDITOR (1 minute)

### Action: Open Supabase SQL Editor

```
1. Go to: https://app.supabase.com
2. Select your Advicly project
3. Click: SQL Editor (left sidebar)
4. Click: "New query" button
```

### Expected Result:
- Blank SQL editor appears
- "Run" button visible in top right
- Ready to paste SQL

### ✅ Confirmation:
- [ ] SQL Editor open
- [ ] Blank query ready
- [ ] Run button visible

**When done, tell me: "SQL Editor open"**

---

## 📄 STEP 3: COPY SQL SCRIPT (1 minute)

### Action: Copy the SQL Script

**Option A: From Terminal**
```bash
cat DATABASE_WIPE_AND_CLEAN_SCHEMA.sql | pbcopy
```

**Option B: Manual**
1. Open file: `DATABASE_WIPE_AND_CLEAN_SCHEMA.sql`
2. Select all (Cmd+A)
3. Copy (Cmd+C)

### Expected Result:
- Entire SQL script copied to clipboard
- Script is 280+ lines
- Starts with `BEGIN;`
- Ends with `COMMIT;`

### ✅ Confirmation:
- [ ] SQL script copied
- [ ] Ready to paste

**When done, tell me: "SQL copied"**

---

## 🔧 STEP 4: PASTE INTO SQL EDITOR (1 minute)

### Action: Paste SQL into Editor

```
1. Click in the SQL editor area
2. Paste (Cmd+V)
3. You should see the entire SQL script
```

### Expected Result:
- SQL script appears in editor
- Script starts with: `BEGIN;`
- Script ends with: `COMMIT;`
- 280+ lines visible

### ✅ Confirmation:
- [ ] SQL pasted successfully
- [ ] Script visible in editor
- [ ] Ready to execute

**When done, tell me: "SQL pasted"**

---

## ▶️ STEP 5: EXECUTE SQL (5-10 minutes)

### Action: Run the SQL Script

```
1. Click: "Run" button (top right)
2. Wait for execution (5-10 minutes)
3. Watch for completion message
```

### Expected Output:
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

### ✅ Confirmation:
- [ ] SQL executed without errors
- [ ] All tables dropped
- [ ] Clean schema created
- [ ] 11 tables created
- [ ] RLS enabled on all tables
- [ ] RLS policies created

**When done, tell me: "SQL executed successfully"**

---

## ✅ STEP 6: VERIFY STRUCTURE (5 minutes)

### Verification Query 1: Check Tables

**In SQL Editor, run:**

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

### ✅ Confirmation:
- [ ] All 11 tables exist
- [ ] No extra tables
- [ ] No deprecated tables

---

### Verification Query 2: Check RLS

**In SQL Editor, run:**

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

### ✅ Confirmation:
- [ ] All 11 tables have RLS enabled
- [ ] No tables have RLS disabled

---

### Verification Query 3: Check Policies

**In SQL Editor, run:**

```sql
SELECT COUNT(*) as policy_count FROM pg_policies 
WHERE schemaname = 'public';
```

**Expected Result:**
```
policy_count: 11 (or more)
```

### ✅ Confirmation:
- [ ] At least 11 policies created
- [ ] Each table has at least one policy

**When done, tell me: "Database structure verified"**

---

## 👤 STEP 7: RE-REGISTER USER (2 minutes)

### Action: User Re-Registration

**User needs to:**

```
1. Go to: https://adviceapp.pages.dev
2. Click: "Sign in with Google"
3. Select Google account
4. Complete OAuth flow
5. Accept permissions
6. Redirected to onboarding
```

### Expected Result:
- User created in database
- User has UUID id
- Onboarding page appears
- No errors in console

### ✅ Confirmation:
- [ ] User can log in
- [ ] Onboarding page appears
- [ ] No errors in browser console

**When done, tell me: "User re-registered"**

---

## 📅 STEP 8: CONNECT CALENDAR (5 minutes)

### Action: Connect Google Calendar

**User needs to:**

```
1. Complete onboarding (or skip to main app)
2. Go to: Settings → Calendar Integrations
3. Click: "Connect Google Calendar"
4. Select Google account
5. Accept permissions
6. Redirected back to Settings
```

### Expected Result:
- Calendar connection created
- Webhook setup automatic
- Initial sync automatic
- Meetings appear within 5 seconds
- "Last sync" shows recent timestamp

### ✅ Confirmation:
- [ ] Calendar connection created
- [ ] Calendar shows as connected
- [ ] "Last sync" shows recent time
- [ ] Meetings appear on Meetings page

**When done, tell me: "Calendar connected and synced"**

---

## 🎉 FINAL VERIFICATION (5 minutes)

### Check Frontend

```
1. Go to: https://adviceapp.pages.dev
2. Log in with Google
3. Check Meetings page
   - [ ] Meetings appear
   - [ ] No errors in console
4. Check Clients page
   - [ ] Page loads
   - [ ] No errors in console
5. Check Settings → Calendar Integrations
   - [ ] Calendar shows as connected
   - [ ] "Last sync" shows recent time
6. Check Ask Advicly
   - [ ] Can create new conversation
   - [ ] Can send messages
   - [ ] No errors in console
```

### ✅ Final Confirmation:
- [ ] User can log in
- [ ] Meetings appear
- [ ] Calendar connected
- [ ] No errors in console
- [ ] All features working

**When done, tell me: "Everything verified and working!"**

---

## 🎉 SUCCESS!

### All Steps Complete?

- [ ] Backup created
- [ ] SQL executed
- [ ] 11 tables verified
- [ ] RLS enabled verified
- [ ] Policies created verified
- [ ] User re-registered
- [ ] Calendar connected
- [ ] Meetings synced
- [ ] Frontend verified
- [ ] No errors in logs

---

## 🆘 TROUBLESHOOTING

### Issue: "Syntax error"
**Solution:** Make sure you copied the ENTIRE script (starts with BEGIN; ends with COMMIT;)

### Issue: "Table already exists"
**Solution:** Drop schema and recreate:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then run the script again
```

### Issue: "User can't log in"
**Solution:** Check users table:
```sql
SELECT * FROM users;
-- If empty, user needs to re-register
```

### Issue: "Meetings not showing"
**Solution:** Check calendar connection:
```sql
SELECT * FROM calendar_connections;
-- If empty, user needs to connect calendar
```

---

## 📞 NEED HELP?

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the error message carefully
3. Tell me the exact error and I'll help

---

**Ready? Let's go! 🚀**

**Next: Tell me "Backup created" when Step 1 is done**

