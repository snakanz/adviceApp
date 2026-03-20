# 🚀 Manual Execution Guide - Database Wipe & Clean Schema

---

## ⚠️ IMPORTANT: This is the Most Reliable Method

Due to Supabase API limitations, the most reliable way to execute the database wipe is through the **Supabase SQL Editor** directly.

This guide will walk you through it step-by-step.

---

## 📋 Prerequisites

- ✅ Backup created (verify in Supabase Dashboard)
- ✅ DATABASE_WIPE_AND_CLEAN_SCHEMA.sql file ready
- ✅ Access to Supabase Dashboard
- ✅ 10-15 minutes available

---

## 🎯 Step 1: Open Supabase SQL Editor

```
1. Go to: https://app.supabase.com
2. Select your Advicly project
3. Click: SQL Editor (left sidebar)
4. Click: "New query"
```

**Screenshot:**
- You should see a blank SQL editor with "Run" button in top right

---

## 📄 Step 2: Copy the SQL Script

**In your terminal or text editor:**

```bash
# Copy the entire SQL script
cat DATABASE_WIPE_AND_CLEAN_SCHEMA.sql | pbcopy
```

**Or manually:**
1. Open: `DATABASE_WIPE_AND_CLEAN_SCHEMA.sql`
2. Select all (Cmd+A)
3. Copy (Cmd+C)

---

## 🔧 Step 3: Paste into SQL Editor

**In Supabase SQL Editor:**

```
1. Click in the SQL editor area
2. Paste (Cmd+V)
3. You should see the entire SQL script
```

**Expected:**
- Script starts with: `BEGIN;`
- Script ends with: `COMMIT;`
- Contains 280+ lines

---

## ▶️ Step 4: Execute the Script

**In Supabase SQL Editor:**

```
1. Click: "Run" button (top right)
2. Wait for execution (5-10 minutes)
```

**Expected Output:**
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

## ✅ Step 5: Verify Success

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

---

## 👤 Step 6: Re-Register User

**User needs to:**

```
1. Go to: https://adviceapp.pages.dev
2. Click: "Sign in with Google"
3. Complete OAuth flow
4. Accept permissions
```

**Verify in SQL Editor:**

```sql
SELECT id, email, onboarding_completed FROM users;
```

**Expected:**
```
id: (UUID)
email: snaka1003@gmail.com
onboarding_completed: false
```

---

## 📅 Step 7: Connect Calendar

**User needs to:**

```
1. Complete onboarding (or skip)
2. Go to: Settings → Calendar Integrations
3. Click: "Connect Google Calendar"
4. Complete OAuth flow
```

**Verify in SQL Editor:**

```sql
SELECT user_id, provider, is_active FROM calendar_connections;
```

**Expected:**
```
user_id: (User's UUID)
provider: google
is_active: true
```

---

## 🧪 Step 8: Verify Meetings Synced

**In SQL Editor:**

```sql
SELECT COUNT(*) as meeting_count FROM meetings;
```

**Expected:**
```
meeting_count: > 0
```

---

## 🎉 Complete!

### All Steps Done?

- [ ] Backup created
- [ ] SQL script executed
- [ ] 11 tables verified
- [ ] RLS enabled verified
- [ ] Policies created verified
- [ ] User re-registered
- [ ] Calendar connected
- [ ] Meetings synced
- [ ] No errors in logs

---

## 🆘 Troubleshooting

### Issue: "Syntax error"

**Solution:**
- Make sure you copied the ENTIRE script
- Check that it starts with `BEGIN;` and ends with `COMMIT;`
- Try running smaller sections

### Issue: "Table already exists"

**Solution:**
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then run the script again
```

### Issue: "Permission denied"

**Solution:**
- Make sure you're using the service role key
- Check that you have admin access to the project

### Issue: "Execution timeout"

**Solution:**
- The script might be taking longer than expected
- Wait 15-20 minutes
- Check Supabase logs for errors

---

## 📞 Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Review the error message carefully
3. Check Supabase logs (Settings → Logs)
4. Try running verification queries to see current state

---

## 🚀 Next Steps After Execution

### Immediately After

1. ✅ Verify all 11 tables created
2. ✅ Verify RLS enabled
3. ✅ Verify policies created

### Then

1. ✅ User re-registers
2. ✅ User connects calendar
3. ✅ Verify meetings appear

### Finally

1. ✅ Check frontend (no errors)
2. ✅ Check backend logs (no errors)
3. ✅ Celebrate! 🎉

---

**Ready? Let's do this! 🚀**

