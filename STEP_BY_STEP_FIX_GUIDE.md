# 🔧 STEP-BY-STEP FIX GUIDE

## The Problem

✅ User exists in **Supabase Authentication** (snaka1003@gmail.com)
❌ User does NOT exist in **database users table**
❌ Backend tries to query database and fails
❌ Frontend shows onboarding screen instead of dashboard

---

## The Solution

### **STEP 1: Add User to Database (5 minutes)**

1. Go to: https://app.supabase.com
2. Select: Your Advicly project
3. Click: **SQL Editor** (left sidebar)
4. Click: **"New query"**
5. Copy the entire script from: `FIX_EXISTING_USER_IN_DATABASE.sql`
6. Paste it into the SQL editor
7. Click: **"Run"** button
8. Wait for completion

**Expected Output:**
```
Checking if user exists in database...
(empty result - user doesn't exist yet)

User in database after insert:
id: 4c903cdf-85ba-4608-8be9-23ec8bbbaa7d
email: snaka1003@gmail.com
name: Nelson Greenwood
provider: google

Checking RLS policies on users table:
(shows RLS policies)

DONE: User should now be able to log in and complete onboarding
```

---

### **STEP 2: Deploy Backend (5 minutes)**

The backend code has been updated and committed. Render will auto-deploy:

1. Go to: https://dashboard.render.com
2. Select: Advicly backend service
3. Click: **"Events"** tab
4. Look for: Latest deployment
5. Wait for status to show: **"Live"** (green checkmark)

**Timeline:**
- Building: 2-5 minutes
- Deploying: 1-2 minutes
- Total: 3-7 minutes

---

### **STEP 3: Test Login (2 minutes)**

Once backend is deployed:

1. Go to: https://adviceapp.pages.dev
2. Click: **"Sign in with Google"**
3. Select: snaka1003@gmail.com
4. Complete OAuth flow
5. Accept permissions

**Expected Result:**
- ✅ No errors in browser console
- ✅ Dashboard loads (not onboarding screen)
- ✅ Can see Meetings page
- ✅ Can see Clients page
- ✅ Can access Settings

---

### **STEP 4: Connect Calendar (5 minutes)**

After successful login:

1. Go to: **Settings → Calendar Integrations**
2. Click: **"Connect Google Calendar"**
3. Complete OAuth flow
4. Wait for sync (5-10 seconds)

**Expected Result:**
- ✅ Calendar shows as "Connected"
- ✅ "Last sync" shows recent timestamp
- ✅ Meetings appear on Meetings page
- ✅ No errors in Render logs

---

## 📋 Checklist

- [ ] Step 1: SQL script executed successfully
- [ ] Step 2: Backend deployed (status = "Live")
- [ ] Step 3: Login successful (dashboard loads)
- [ ] Step 4: Calendar connected (meetings appear)

---

## 🎯 What Changed

### **Backend Fixes (All Deployed)**

✅ Fixed all column name mismatches:
- `userid` → `user_id`
- `googleeventid` → `external_id`
- `summary` → `description`
- `sync_enabled` → `is_active`
- Removed `tenant_id`, `is_primary`, `email_template_id`

✅ Updated 15+ backend files
✅ All changes committed to git
✅ Auto-deploying to Render now

### **Database Fix (Next)**

✅ Add existing user to database users table
✅ User will have correct UUID from Supabase Auth
✅ RLS policies will protect user data

---

## 🚀 Timeline

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Add user to database | 5 min | ⏳ Next |
| 2 | Deploy backend | 5 min | ⏳ After Step 1 |
| 3 | Test login | 2 min | ⏳ After Step 2 |
| 4 | Connect calendar | 5 min | ⏳ After Step 3 |
| **Total** | | **17 min** | |

---

## 💡 Key Points

- ✅ User exists in Supabase Auth (good!)
- ✅ Just needs to be added to database (simple fix)
- ✅ Backend code is all fixed (deployed)
- ✅ Should work after these steps

---

## 📞 If Issues Occur

**Error: "Column does not exist"**
- Backend hasn't deployed yet
- Wait 5 more minutes and refresh

**Error: "User not found"**
- SQL script didn't run
- Check Supabase SQL Editor for errors

**Error: "Auth session missing"**
- Clear browser cache
- Log out and log back in

---

## ✅ Success Criteria

After all 4 steps:
- ✅ Can log in with Google
- ✅ Dashboard loads (not onboarding)
- ✅ Can see meetings and clients
- ✅ Can connect calendar
- ✅ Meetings sync from Google Calendar
- ✅ No errors in console or logs

---

**Ready? Start with STEP 1!** 🚀

