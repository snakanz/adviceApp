# Investigation Summary: Calendar Integration Issues

## Problem Statement

User `snaka1003@gmail.com` wanted to implement a clean onboarding flow for calendar integration with:
1. User creates account
2. User connects calendar (Calendly or Google)
3. System shows loading indicator with sync progress
4. Meetings populate as sync completes

However, the user had stale Calendly data and connection issues.

---

## Root Cause Analysis

### Discovery Process

1. **Audited database state** for user `4c903cdf-85ba-4608-8be9-23ec8bbbaa7d`
   - Found 403 stale Calendly meetings (all from 2025-10-23)
   - Found 40 Google Calendar meetings
   - Found 237 clients
   - Found 0 calendar connections

2. **Checked database schema**
   - ❌ `tenants` table: MISSING
   - ❌ `users.tenant_id` column: MISSING
   - ✅ `calendar_connections` table: EXISTS
   - ✅ `calendar_connections.tenant_id` column: EXISTS

3. **Reviewed backend code**
   - Backend expects `users.tenant_id` to exist
   - Backend tries to insert `tenant_id` into `calendar_connections`
   - Backend has auto-create tenant logic on Google OAuth login
   - All code is correct and ready

### The Critical Issue

**Migration 020 was never applied to the production database.**

The migration file exists at `backend/migrations/020_multi_tenant_onboarding.sql` but was never executed on the Supabase database.

This means:
- The `tenants` table doesn't exist
- The `users.tenant_id` column doesn't exist
- Calendar connections cannot be saved (foreign key constraint fails)
- Multi-tenant architecture is incomplete

---

## What I've Prepared

### 1. Migration Files

**MIGRATION_020_MINIMAL.sql**
- Creates only the missing pieces
- Creates `tenants` table
- Creates `tenant_members` table
- Adds `tenant_id` to `users`, `meetings`, `clients` tables
- Creates necessary indexes
- Ready to paste into Supabase SQL Editor

**MIGRATION_020_READY_TO_APPLY.sql**
- Full migration with all tables and columns
- Includes calendar_connections table (already exists)
- More comprehensive but may have conflicts

### 2. Documentation

**CRITICAL_NEXT_STEPS.md**
- Step-by-step instructions to apply migration
- SQL commands to create default tenant
- SQL to clean stale data
- Verification queries
- Troubleshooting guide

**ONBOARDING_IMPLEMENTATION_PLAN.md**
- Complete implementation roadmap
- 5 phases with timeline
- Expected outcomes

**INVESTIGATION_SUMMARY.md** (this file)
- Root cause analysis
- What was discovered
- What was prepared

### 3. Verification Scripts

**backend/check-migration-status.js**
- Checks if migration has been applied
- Verifies tenants table exists
- Verifies users.tenant_id column exists
- Verifies calendar_connections table exists

**backend/check-calendar-connections.js**
- Lists all calendar connections for a user
- Shows connection details

---

## Current Backend Code Status

### ✅ Already Fixed (Previous Work)

1. **Calendar Connections Insert** (`backend/src/routes/calendar.js`, line 2005)
   ```javascript
   const { error: insertError } = await getSupabase()
     .from('calendar_connections')
     .insert({
       user_id: userId,
       tenant_id: user.tenant_id,  // ✅ Includes tenant_id
       provider: 'calendly',
       access_token: accessToken,
       // ...
     });
   ```

2. **Auto-Create Default Tenant** (`backend/src/routes/auth.js`, lines 173-203)
   ```javascript
   if (!tenantId) {
     // Auto-create default tenant if user doesn't have one
     const { data: newTenant } = await getSupabase()
       .from('tenants')
       .insert({
         name: `${user.name || user.email}'s Business`,
         owner_id: user.id,
         timezone: 'UTC',
         currency: 'USD'
       })
       .select()
       .single();
     // ...
   }
   ```

3. **Calendly Token Connection** (`backend/src/routes/calendar-settings.js`, lines 347-386)
   - Fetches user's `tenant_id`
   - Validates tenant_id exists
   - Includes `tenant_id` in insert

### ✅ No Backend Changes Needed

The backend code is already prepared for the multi-tenant architecture. It just needs the database schema to exist.

---

## What Needs to Happen Next

### Phase 1: Apply Migration (BLOCKING)
- [ ] User applies MIGRATION_020_MINIMAL.sql to Supabase
- [ ] Verify migration succeeded
- [ ] Create default tenant for user
- [ ] Verify user has tenant_id

### Phase 2: Clean Stale Data
- [ ] Delete 403 stale Calendly meetings
- [ ] Evaluate which clients to delete
- [ ] Document what was deleted

### Phase 3: Test Fresh Connection
- [ ] User logs in
- [ ] User connects Calendly
- [ ] Verify connection saves to database
- [ ] Verify UI shows "Connected"
- [ ] Verify initial sync starts

### Phase 4: Implement Sync Progress UI
- [ ] Create sync status component
- [ ] Add real-time progress updates
- [ ] Show estimated time remaining
- [ ] Display success/error messages

---

## Key Insights

1. **The backend code is correct** - No changes needed there
2. **The database schema is incomplete** - Migration 020 must be applied
3. **The calendar_connections table already exists** - Partial migration was applied
4. **The user has stale data** - 403 Calendly meetings from before connection was lost
5. **The fix is straightforward** - Apply migration, create tenant, test connection

---

## Files Created

```
CRITICAL_NEXT_STEPS.md              ← START HERE
MIGRATION_020_MINIMAL.sql           ← SQL to apply
MIGRATION_020_READY_TO_APPLY.sql    ← Alternative SQL
ONBOARDING_IMPLEMENTATION_PLAN.md   ← Full roadmap
INVESTIGATION_SUMMARY.md            ← This file
backend/check-migration-status.js   ← Verification script
```

---

## Estimated Timeline

- **Apply migration**: 5 minutes
- **Create default tenant**: 2 minutes
- **Clean stale data**: 2 minutes
- **Test connection**: 10 minutes
- **Implement sync progress UI**: 30 minutes

**Total: ~50 minutes**

---

## Next Action

👉 **Read CRITICAL_NEXT_STEPS.md and apply MIGRATION_020_MINIMAL.sql**

This is the critical blocker that must be resolved before any other work can proceed.

