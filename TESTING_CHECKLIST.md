# Multi-Tenant Onboarding - Testing Checklist

**Date:** October 21, 2025  
**Purpose:** Comprehensive testing checklist for the multi-tenant onboarding implementation

---

## 🗄️ Database Migration Testing

### Pre-Migration Checks
- [ ] Backup current database
- [ ] Verify users table has UUID id column
- [ ] Check existing user count
- [ ] Check existing meetings count
- [ ] Check existing clients count

### Migration Execution
- [ ] Run `020_multi_tenant_onboarding.sql` in Supabase SQL Editor
- [ ] Verify success messages in output
- [ ] Check all tables created: `tenants`, `tenant_members`, `calendar_connections`
- [ ] Verify `tenant_id` columns added to all tables
- [ ] Check RLS policies created

### Data Migration (if applicable)
- [ ] Run `021_migrate_existing_data.sql`
- [ ] Verify tenants created for all existing users
- [ ] Check all users have `tenant_id` set
- [ ] Verify all meetings have `tenant_id` set
- [ ] Verify all clients have `tenant_id` set
- [ ] Check calendar tokens migrated to `calendar_connections`

### Post-Migration Verification
```sql
-- Run these queries to verify:

-- 1. Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('tenants', 'tenant_members', 'calendar_connections');
-- Expected: 3 rows

-- 2. Check tenant_id columns
SELECT table_name FROM information_schema.columns 
WHERE column_name = 'tenant_id' ORDER BY table_name;
-- Expected: Multiple rows

-- 3. Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('tenants', 'tenant_members', 'calendar_connections');
-- Expected: Multiple policies

-- 4. Verify data integrity
SELECT COUNT(*) as tenant_count FROM tenants;
SELECT COUNT(*) as users_with_tenant FROM users WHERE tenant_id IS NOT NULL;
SELECT COUNT(*) as users_without_tenant FROM users WHERE tenant_id IS NULL;
-- Expected: users_without_tenant = 0
```

---

## 🔧 Backend API Testing

### Environment Setup
- [ ] Verify all environment variables set in backend `.env`
- [ ] Check `SUPABASE_URL` is correct
- [ ] Check `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] Check `SUPABASE_ANON_KEY` is set
- [ ] Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- [ ] Verify backend starts without errors: `npm run dev`

### Tenant Management Endpoints

**GET /api/tenants/my-tenant**
```bash
# Test getting user's tenant
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/tenants/my-tenant
```
- [ ] Returns tenant data for authenticated user
- [ ] Returns 401 for unauthenticated request
- [ ] Returns null if user has no tenant

**POST /api/tenants**
```bash
# Test creating tenant
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Business","business_type":"Financial Advisor","team_size":1}' \
  http://localhost:3001/api/tenants
```
- [ ] Creates new tenant
- [ ] Returns tenant data
- [ ] Adds user as owner in tenant_members
- [ ] Updates user's tenant_id
- [ ] Returns 400 if user already has tenant

### Onboarding Endpoints

**GET /api/auth/onboarding/status**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/auth/onboarding/status
```
- [ ] Returns onboarding status
- [ ] Shows current step
- [ ] Shows completion status

**POST /api/auth/onboarding/business-profile**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Test Co","business_type":"Financial Advisor","team_size":1}' \
  http://localhost:3001/api/auth/onboarding/business-profile
```
- [ ] Saves business profile
- [ ] Creates tenant if doesn't exist
- [ ] Updates onboarding_step to 2
- [ ] Returns tenant_id

**POST /api/auth/onboarding/complete**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/auth/onboarding/complete
```
- [ ] Marks onboarding as complete
- [ ] Sets onboarding_completed to true
- [ ] Sets onboarding_step to 6

---

## 🎨 Frontend Testing

### Environment Setup
- [ ] Verify all environment variables set in frontend `.env`
- [ ] Check `REACT_APP_SUPABASE_URL` is correct
- [ ] Check `REACT_APP_SUPABASE_ANON_KEY` is set
- [ ] Check `REACT_APP_API_BASE_URL` points to backend
- [ ] Verify frontend starts without errors: `npm start`

### Registration Page (`/register`)
- [ ] Page loads without errors
- [ ] Google sign up button visible
- [ ] Email/password form visible
- [ ] Form validation works:
  - [ ] Name required
  - [ ] Email required and valid format
  - [ ] Password required (min 6 characters)
  - [ ] Passwords must match
- [ ] Error messages display correctly
- [ ] Link to login page works
- [ ] Google OAuth redirects correctly
- [ ] Email registration creates account
- [ ] Successful registration redirects to onboarding

### Login Page (`/login`)
- [ ] Page loads without errors
- [ ] Google sign in button visible
- [ ] Email/password form visible
- [ ] Form validation works
- [ ] Error messages display correctly
- [ ] Link to register page works
- [ ] Google OAuth login works
- [ ] Email/password login works
- [ ] Successful login redirects appropriately

### Onboarding Flow (`/onboarding`)

**Step 2: Business Profile**
- [ ] Page loads correctly
- [ ] Progress bar shows step 1 of 5
- [ ] Business name field required
- [ ] Business type dropdown works
- [ ] Team size dropdown works
- [ ] Timezone auto-detected
- [ ] Form validation works
- [ ] Continue button saves data
- [ ] Moves to next step on success
- [ ] Error messages display correctly

**Step 3: Calendar Choice**
- [ ] Page loads correctly
- [ ] Progress bar shows step 2 of 5
- [ ] Google Calendar option visible
- [ ] Calendly option visible
- [ ] Selection highlights correctly
- [ ] Back button works
- [ ] Skip button works
- [ ] Continue button enabled when option selected
- [ ] Moves to next step on continue

**Step 4: Calendar Connect**
- [ ] Page loads correctly
- [ ] Progress bar shows step 3 of 5
- [ ] Shows correct provider (Google or Calendly)
- [ ] Google: OAuth button works
- [ ] Google: Redirects to Google auth
- [ ] Calendly: Token input field visible
- [ ] Calendly: Connect button works
- [ ] Connection status updates correctly
- [ ] Back button works
- [ ] Skip button works
- [ ] Continue enabled when connected

**Step 5: Initial Sync**
- [ ] Page loads correctly
- [ ] Progress bar shows step 4 of 5
- [ ] Sync button visible
- [ ] Sync starts on button click
- [ ] Loading state shows during sync
- [ ] Success state shows after sync
- [ ] Meeting count displays correctly
- [ ] Client count displays correctly
- [ ] Back button works
- [ ] Continue enabled after sync

**Step 6: Complete**
- [ ] Page loads correctly
- [ ] Progress bar shows step 5 of 5
- [ ] Success message displays
- [ ] Business name shown correctly
- [ ] Feature list displays
- [ ] Quick tips visible
- [ ] "Go to Dashboard" button works
- [ ] Redirects to main app on click

### Onboarding Resume
- [ ] Start onboarding, complete step 2
- [ ] Close browser
- [ ] Log back in
- [ ] Verify resumes at step 3
- [ ] Complete remaining steps
- [ ] Verify onboarding completes

### Session Management
- [ ] Log in successfully
- [ ] Wait 10 minutes (or adjust token expiry for testing)
- [ ] Perform an action (e.g., view meetings)
- [ ] Verify no "authentication required" error
- [ ] Check browser console for token refresh logs
- [ ] Verify session stays active

### Main App Access
- [ ] Complete onboarding
- [ ] Verify redirect to `/meetings`
- [ ] Check all navigation links work
- [ ] Verify user data loads correctly
- [ ] Check tenant isolation (can't see other tenants' data)

---

## 🔒 Security Testing

### RLS Policy Testing
```sql
-- Test as a specific user
SET request.jwt.claims.sub = 'user-uuid-here';

-- Try to access another tenant's data
SELECT * FROM tenants WHERE owner_id != 'user-uuid-here';
-- Expected: No rows (RLS blocks access)

-- Try to access own tenant
SELECT * FROM tenants WHERE owner_id = 'user-uuid-here';
-- Expected: User's tenant data
```

### Authentication Testing
- [ ] Unauthenticated requests to protected endpoints return 401
- [ ] Invalid tokens return 401
- [ ] Expired tokens refresh automatically
- [ ] User can only access their own tenant's data
- [ ] User can only see their own calendar connections

---

## 🚀 Deployment Testing

### Backend Deployment (Render)
- [ ] Push code to repository
- [ ] Verify Render auto-deploys
- [ ] Check deployment logs for errors
- [ ] Verify environment variables set in Render
- [ ] Test API endpoints on production URL
- [ ] Check backend logs for errors

### Frontend Deployment (Cloudflare Pages)
- [ ] Push code to repository
- [ ] Verify Cloudflare Pages auto-deploys
- [ ] Check build logs for errors
- [ ] Verify environment variables set in Cloudflare
- [ ] Test frontend on production URL
- [ ] Check browser console for errors

### End-to-End Production Testing
- [ ] Register new account on production
- [ ] Complete onboarding flow
- [ ] Connect calendar (Google or Calendly)
- [ ] Sync meetings
- [ ] Verify data appears in main app
- [ ] Test session persistence
- [ ] Log out and log back in
- [ ] Verify data still accessible

---

## 📊 Performance Testing

- [ ] Page load times < 2 seconds
- [ ] API response times < 500ms
- [ ] Onboarding flow completes smoothly
- [ ] No memory leaks in browser
- [ ] No excessive API calls
- [ ] Token refresh doesn't cause UI lag

---

## 🐛 Known Issues / Edge Cases

Document any issues found during testing:

1. **Issue:** _Description_
   - **Steps to reproduce:** _Steps_
   - **Expected:** _Expected behavior_
   - **Actual:** _Actual behavior_
   - **Status:** _Open/Fixed/Won't Fix_

---

## ✅ Sign-Off

- [ ] All database migrations completed successfully
- [ ] All backend endpoints tested and working
- [ ] All frontend pages tested and working
- [ ] Onboarding flow works end-to-end
- [ ] Session management prevents timeouts
- [ ] Security/RLS policies working correctly
- [ ] Production deployment successful
- [ ] No critical bugs found

**Tested by:** _________________  
**Date:** _________________  
**Approved for production:** ☐ Yes ☐ No

---

## 📝 Notes

Additional notes or observations from testing:

_[Add notes here]_

