# Multi-Tenant Onboarding Implementation - Complete Guide

**Date:** October 21, 2025  
**Status:** ✅ Implementation Complete - Ready for Testing

---

## 📋 Overview

This document describes the complete multi-tenant onboarding flow implementation for Advicly, including database migrations, backend APIs, frontend components, and deployment instructions.

## ✅ What Was Implemented

### Phase 1: Database Migrations ✅

**Files Created:**
- `backend/migrations/020_multi_tenant_onboarding.sql` - Main migration
- `backend/migrations/021_migrate_existing_data.sql` - Data migration script
- `backend/migrations/020_MIGRATION_GUIDE.md` - Detailed migration guide

**Database Changes:**
1. **New Tables:**
   - `tenants` - Business/organization tenants
   - `tenant_members` - User-to-tenant relationships with roles
   - `calendar_connections` - Calendar integration connections (replaces `calendartoken`)

2. **Added `tenant_id` to existing tables:**
   - `users`
   - `meetings`
   - `clients`
   - `advisor_tasks`
   - `client_documents`
   - `ask_threads`
   - `transcript_action_items`

3. **Row Level Security (RLS) Policies:**
   - Tenant data isolation
   - User-specific calendar connections
   - Role-based access control

4. **Helper Functions:**
   - `get_user_tenant_id(user_uuid)` - Get user's tenant ID
   - `is_tenant_owner(user_uuid, tenant_uuid)` - Check tenant ownership

### Phase 2: Backend API - Tenant Management ✅

**Files Created/Modified:**
- `backend/src/routes/tenants.js` - NEW tenant management endpoints
- `backend/src/routes/auth.js` - UPDATED with onboarding endpoints
- `backend/src/routes/index.js` - UPDATED to register tenant routes

**New API Endpoints:**

**Tenant Management:**
- `GET /api/tenants/my-tenant` - Get current user's tenant
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id` - Update tenant (owner only)
- `GET /api/tenants/:id/members` - Get tenant members
- `POST /api/tenants/:id/members` - Add member (owner/admin only)

**Onboarding:**
- `GET /api/auth/onboarding/status` - Get onboarding status
- `PUT /api/auth/onboarding/step` - Update onboarding step
- `POST /api/auth/onboarding/business-profile` - Save business profile
- `POST /api/auth/onboarding/complete` - Mark onboarding complete
- `POST /api/auth/onboarding/skip-calendar` - Skip calendar connection

### Phase 3: Backend API - Session Management ✅

**Files Modified:**
- `src/context/AuthContext.js` - UPDATED with automatic token refresh

**Improvements:**
- Automatic token refresh check every minute
- Proactive refresh when token expires in < 5 minutes
- Prevents "authentication required" errors from session timeouts
- Better error handling and logging

### Phase 4: Frontend - Auth Pages ✅

**Files Created/Modified:**
- `src/pages/RegisterPage.js` - NEW registration page
- `src/pages/LoginPage.js` - UPDATED with email/password login

**Features:**
- Email/password registration and login
- Google OAuth registration and login
- Form validation and error handling
- Links between login and registration pages
- Professional UI with Advicly branding

### Phase 5: Frontend - Onboarding Flow ✅

**Files Created:**
- `src/pages/Onboarding/OnboardingFlow.js` - Main onboarding container
- `src/pages/Onboarding/Step2_BusinessProfile.js` - Business info collection
- `src/pages/Onboarding/Step3_CalendarChoice.js` - Calendar provider selection
- `src/pages/Onboarding/Step4_CalendarConnect.js` - Calendar OAuth flow
- `src/pages/Onboarding/Step5_InitialSync.js` - Initial meeting sync
- `src/pages/Onboarding/Step6_Complete.js` - Completion screen

**Features:**
- Progress bar showing current step
- Resume capability (saves progress to database)
- Skip calendar connection option
- Automatic tenant creation
- Calendar integration (Google/Calendly)
- Meeting and client sync
- Professional, guided UX

### Phase 6: App Routing & Integration ✅

**Files Modified:**
- `src/App.js` - UPDATED with onboarding routes and checks

**Features:**
- Automatic onboarding status check on login
- Redirect to onboarding if not completed
- Separate routes for login, register, and onboarding
- Protected routes for main app
- Loading states during auth checks

---

## 🚀 Deployment Instructions

### Step 1: Run Database Migrations

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run Main Migration**
   ```sql
   -- Copy and paste contents of:
   backend/migrations/020_multi_tenant_onboarding.sql
   ```
   Click "Run" and verify success messages

3. **Run Data Migration (if you have existing users)**
   ```sql
   -- Copy and paste contents of:
   backend/migrations/021_migrate_existing_data.sql
   ```
   This will:
   - Create tenants for existing users
   - Migrate calendar tokens to new table
   - Link all data to tenants

4. **Verify Migration**
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_name IN ('tenants', 'tenant_members', 'calendar_connections');
   
   -- Check tenant_id columns added
   SELECT table_name FROM information_schema.columns 
   WHERE column_name = 'tenant_id';
   ```

### Step 2: Update Environment Variables

Ensure your backend `.env` has:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/google/callback

# JWT
JWT_SECRET=your-jwt-secret

# Frontend URL
FRONTEND_URL=https://your-frontend.pages.dev
```

Ensure your frontend `.env` has:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_API_BASE_URL=https://your-backend.onrender.com
```

### Step 3: Deploy Backend

```bash
cd backend
npm install
git add .
git commit -m "Add multi-tenant onboarding implementation"
git push
```

Render will automatically deploy the backend.

### Step 4: Deploy Frontend

```bash
cd ..
npm install
git add .
git commit -m "Add multi-tenant onboarding frontend"
git push
```

Cloudflare Pages will automatically deploy the frontend.

### Step 5: Test the Complete Flow

1. **Test Registration:**
   - Go to `/register`
   - Register with email/password or Google OAuth
   - Verify redirect to onboarding

2. **Test Onboarding:**
   - Complete Step 2: Business Profile
   - Complete Step 3: Calendar Choice
   - Complete Step 4: Calendar Connect (or skip)
   - Complete Step 5: Initial Sync (if connected)
   - Complete Step 6: Completion
   - Verify redirect to main app

3. **Test Resume:**
   - Start onboarding
   - Close browser mid-flow
   - Log back in
   - Verify resume from saved step

4. **Test Session Management:**
   - Log in
   - Wait 10+ minutes
   - Perform an action
   - Verify no "authentication required" error

---

## 🔧 Configuration Notes

### Supabase Auth Setup

Make sure Supabase Auth is configured:

1. **Enable Email Provider:**
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure email templates

2. **Enable Google OAuth:**
   - Go to Authentication → Providers
   - Enable Google provider
   - Add your Google Client ID and Secret
   - Add authorized redirect URLs

3. **Configure Site URL:**
   - Go to Authentication → URL Configuration
   - Set Site URL to your frontend URL
   - Add redirect URLs for auth callback

### Google Calendar API Setup

1. **Enable Google Calendar API:**
   - Go to Google Cloud Console
   - Enable Calendar API
   - Create OAuth 2.0 credentials

2. **Configure OAuth Consent Screen:**
   - Add scopes: calendar, calendar.events, userinfo.email, userinfo.profile
   - Add test users (for development)

3. **Add Authorized Redirect URIs:**
   - `https://your-backend.onrender.com/api/auth/google/callback`
   - `http://localhost:3001/api/auth/google/callback` (for development)

---

## 📊 Database Schema Summary

### Tenants Table
```sql
tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT,
  team_size INTEGER,
  owner_id UUID → users(id),
  timezone TEXT,
  currency TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Tenant Members Table
```sql
tenant_members (
  id UUID PRIMARY KEY,
  tenant_id UUID → tenants(id),
  user_id UUID → users(id),
  role TEXT ('owner', 'admin', 'member'),
  permissions JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(tenant_id, user_id)
)
```

### Calendar Connections Table
```sql
calendar_connections (
  id UUID PRIMARY KEY,
  user_id UUID → users(id),
  tenant_id UUID → tenants(id),
  provider TEXT ('google', 'outlook', 'calendly'),
  provider_account_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_primary BOOLEAN,
  is_active BOOLEAN,
  sync_enabled BOOLEAN,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, provider, provider_account_email)
)
```

---

## 🎯 Next Steps (Future Enhancements)

1. **Outlook Calendar Integration**
   - Add Microsoft OAuth
   - Implement Outlook calendar sync

2. **Team Collaboration**
   - Invite team members
   - Share clients and meetings
   - Role-based permissions

3. **Advanced Onboarding**
   - Import data from CSV
   - Connect multiple calendars
   - Customize dashboard

4. **Analytics**
   - Track onboarding completion rates
   - Monitor user engagement
   - Identify drop-off points

---

## 🐛 Troubleshooting

### Users stuck in onboarding loop
- Check `onboarding_completed` flag in database
- Manually set to `true` if needed:
  ```sql
  UPDATE users SET onboarding_completed = true WHERE email = 'user@example.com';
  ```

### Calendar connection fails
- Verify Google OAuth credentials
- Check redirect URIs match exactly
- Ensure Calendar API is enabled

### Session timeout errors
- Verify Supabase anon key is correct
- Check token refresh logic in AuthContext
- Ensure backend is using user-scoped Supabase client

---

## 📞 Support

For issues or questions:
1. Check the migration guide: `backend/migrations/020_MIGRATION_GUIDE.md`
2. Review Supabase logs in dashboard
3. Check browser console for frontend errors
4. Review backend logs in Render dashboard

---

**Implementation Complete!** 🎉

The multi-tenant onboarding flow is now fully implemented and ready for testing and deployment.

