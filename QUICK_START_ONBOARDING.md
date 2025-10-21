# Quick Start Guide - Multi-Tenant Onboarding

**For:** Developers setting up the multi-tenant onboarding flow  
**Time Required:** ~30 minutes  
**Last Updated:** October 21, 2025

---

## 🎯 What You're Setting Up

A complete multi-tenant onboarding system that:
- Allows users to register with email/password or Google OAuth
- Guides new users through a 5-step onboarding process
- Creates isolated tenant workspaces for each business
- Connects calendars (Google or Calendly) automatically
- Prevents session timeouts with automatic token refresh

---

## ⚡ Quick Setup (5 Steps)

### Step 1: Run Database Migrations (5 min)

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste `backend/migrations/020_multi_tenant_onboarding.sql`
3. Click **Run**
4. Verify you see success messages

**If you have existing users:**
5. Copy and paste `backend/migrations/021_migrate_existing_data.sql`
6. Click **Run**
7. Verify migration success messages

### Step 2: Update Environment Variables (5 min)

**Backend `.env`:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env`:**
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Step 3: Install Dependencies (2 min)

```bash
# Backend
cd backend
npm install

# Frontend
cd ..
npm install
```

### Step 4: Start Development Servers (1 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm start
```

### Step 5: Test the Flow (10 min)

1. Go to `http://localhost:3000/register`
2. Register a new account (email or Google)
3. Complete the onboarding flow:
   - Step 2: Enter business info
   - Step 3: Choose calendar (or skip)
   - Step 4: Connect calendar (or skip)
   - Step 5: Sync meetings (if connected)
   - Step 6: Complete!
4. Verify redirect to main app

---

## 🗂️ File Structure

### New Files Created

```
backend/
├── migrations/
│   ├── 020_multi_tenant_onboarding.sql       # Main migration
│   ├── 021_migrate_existing_data.sql         # Data migration
│   └── 020_MIGRATION_GUIDE.md                # Detailed guide
└── src/
    └── routes/
        └── tenants.js                         # NEW: Tenant management API

src/
├── pages/
│   ├── RegisterPage.js                        # NEW: Registration page
│   ├── LoginPage.js                           # UPDATED: Added email/password
│   └── Onboarding/
│       ├── OnboardingFlow.js                  # NEW: Main container
│       ├── Step2_BusinessProfile.js           # NEW: Business info
│       ├── Step3_CalendarChoice.js            # NEW: Calendar selection
│       ├── Step4_CalendarConnect.js           # NEW: Calendar OAuth
│       ├── Step5_InitialSync.js               # NEW: Meeting sync
│       └── Step6_Complete.js                  # NEW: Completion
└── context/
    └── AuthContext.js                         # UPDATED: Token refresh

Documentation/
├── MULTI_TENANT_ONBOARDING_IMPLEMENTATION.md  # Complete guide
├── TESTING_CHECKLIST.md                       # Testing checklist
└── QUICK_START_ONBOARDING.md                  # This file
```

---

## 🔑 Key Concepts

### Tenants
- Each business/organization is a **tenant**
- Users belong to one tenant
- All data is isolated by `tenant_id`
- RLS policies enforce isolation

### Onboarding Steps
1. **Authentication** (Login/Register) - Already working
2. **Business Profile** - Collect business info, create tenant
3. **Calendar Choice** - Choose Google or Calendly
4. **Calendar Connect** - OAuth flow or API token
5. **Initial Sync** - Import meetings and clients
6. **Complete** - Mark onboarding done, redirect to app

### Session Management
- Supabase Auth handles authentication
- Tokens auto-refresh every minute
- Prevents "authentication required" errors
- No manual token management needed

---

## 🧪 Testing Locally

### Test Registration
```bash
# 1. Go to registration page
open http://localhost:3000/register

# 2. Register with email
# Email: test@example.com
# Password: password123

# 3. Should redirect to onboarding
```

### Test Onboarding Resume
```bash
# 1. Start onboarding, complete step 2
# 2. Close browser
# 3. Log back in
# 4. Should resume at step 3
```

### Test API Endpoints
```bash
# Get onboarding status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/auth/onboarding/status

# Create tenant
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Business","business_type":"Financial Advisor"}' \
  http://localhost:3001/api/tenants
```

---

## 🚀 Deploying to Production

### 1. Update Production Environment Variables

**Render (Backend):**
- Go to Render Dashboard → Your Service → Environment
- Add all backend environment variables
- Update `GOOGLE_REDIRECT_URI` to production URL
- Update `FRONTEND_URL` to production URL

**Cloudflare Pages (Frontend):**
- Go to Cloudflare Dashboard → Pages → Your Project → Settings
- Add all frontend environment variables
- Update `REACT_APP_API_BASE_URL` to production backend URL

### 2. Run Migrations on Production Database

1. Go to Supabase Dashboard (production project)
2. SQL Editor → New Query
3. Run `020_multi_tenant_onboarding.sql`
4. Run `021_migrate_existing_data.sql` (if needed)

### 3. Deploy Code

```bash
# Commit and push
git add .
git commit -m "Add multi-tenant onboarding"
git push

# Render and Cloudflare will auto-deploy
```

### 4. Test Production

1. Go to your production URL
2. Register a new account
3. Complete onboarding
4. Verify everything works

---

## 🐛 Common Issues

### "Table 'tenants' does not exist"
**Solution:** Run the database migrations in Supabase SQL Editor

### "User already has a tenant"
**Solution:** This is expected if user already went through onboarding. Check `onboarding_completed` flag.

### "Authentication required" errors
**Solution:** 
- Check Supabase anon key is correct
- Verify token refresh is working (check console logs)
- Ensure backend is using user-scoped Supabase client

### Calendar connection fails
**Solution:**
- Verify Google OAuth credentials
- Check redirect URI matches exactly
- Ensure Google Calendar API is enabled

### Onboarding doesn't redirect
**Solution:**
- Check `onboarding_completed` flag in database
- Verify App.js has onboarding check logic
- Check browser console for errors

---

## 📚 Additional Resources

- **Full Implementation Guide:** `MULTI_TENANT_ONBOARDING_IMPLEMENTATION.md`
- **Testing Checklist:** `TESTING_CHECKLIST.md`
- **Migration Guide:** `backend/migrations/020_MIGRATION_GUIDE.md`
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Google OAuth Setup:** https://developers.google.com/identity/protocols/oauth2

---

## 💡 Tips

1. **Use Chrome DevTools** to debug auth issues (Application → Storage)
2. **Check Supabase Logs** for database errors
3. **Use Postman** to test API endpoints
4. **Enable verbose logging** during development
5. **Test with multiple users** to verify tenant isolation

---

## ✅ Success Checklist

- [ ] Database migrations completed
- [ ] Environment variables set
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can register new account
- [ ] Onboarding flow works end-to-end
- [ ] Can skip calendar connection
- [ ] Session stays active (no timeouts)
- [ ] Data appears in main app after onboarding

---

## 🎉 You're Done!

If all checklist items are complete, your multi-tenant onboarding is ready!

**Next Steps:**
1. Deploy to production
2. Test with real users
3. Monitor for issues
4. Iterate based on feedback

**Questions?** Check the full implementation guide or testing checklist.

---

**Happy Coding!** 🚀

