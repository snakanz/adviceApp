# Clean Onboarding Flow Implementation Plan

## Current State Analysis

### Database Audit Results for snaka1003@gmail.com
- **User ID**: 4c903cdf-85ba-4608-8be9-23ec8bbbaa7d
- **Email**: snaka1003@gmail.com
- **Calendar Connections**: 0 (empty)
- **Stale Calendly Meetings**: 403 (all from 2025-10-23)
- **Google Meetings**: 40
- **Total Clients**: 237

### Critical Issue Discovered
**The migration 020_multi_tenant_onboarding.sql was NEVER applied to the database.**

The `users` table is missing:
- `tenant_id` column (UUID, FK to tenants.id)
- This breaks all calendar connection logic that tries to insert with `tenant_id`

The `calendar_connections` table doesn't exist at all.

## Implementation Steps

### Phase 1: Apply Missing Migration (CRITICAL)
1. Run migration 020_multi_tenant_onboarding.sql on production database
   - Creates `tenants` table
   - Creates `tenant_members` table
   - Creates `calendar_connections` table
   - Adds `tenant_id` column to `users`, `meetings`, `clients` tables

### Phase 2: Clean Stale Data
1. Delete 403 stale Calendly meetings for this user
2. Identify and delete orphaned clients (created only from Calendly)
3. Preserve Google Calendar meetings and associated clients

### Phase 3: Verify Prerequisites
1. Confirm user has valid `tenant_id` after migration
2. If NULL, auto-create default tenant
3. Verify calendar connection logic includes `tenant_id`

### Phase 4: Test Fresh Connection
1. User logs in
2. Navigates to Calendar Settings
3. Clicks "Connect Calendly"
4. Completes OAuth flow
5. Verify connection saved to `calendar_connections` with `tenant_id`
6. Verify UI shows green checkmark (connected)
7. Verify initial sync triggered

### Phase 5: Add Sync Progress Visibility
1. Create sync status tracking endpoint
2. Add loading indicator component
3. Display real-time progress (X/Y meetings synced)
4. Show estimated time remaining
5. Display success/error messages

## Expected Outcome
- User has clean slate with no stale data
- Fresh Calendly connection saves properly
- UI shows correct connection status
- Initial sync displays progress feedback
- Future meetings sync automatically via webhooks

## Timeline
- Phase 1: 5 minutes (apply migration)
- Phase 2: 10 minutes (clean data)
- Phase 3: 5 minutes (verify)
- Phase 4: 15 minutes (test)
- Phase 5: 30 minutes (implement UI)

**Total: ~65 minutes**

