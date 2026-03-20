# Phase 1: Multi-Tenant Database Migration

## Overview

This migration transforms the Advicly database from a single-user system to a multi-tenant architecture compatible with Supabase Auth.

## What Changes

### Before Migration
- `users.id`: TEXT or INTEGER
- Custom JWT authentication
- Calendar tokens stored in `users` table
- Manual filtering by `advisor_id` in application code
- RLS policies not enforcing (service role key bypass)

### After Migration
- `users.id`: UUID (compatible with Supabase Auth)
- Supabase Auth with `auth.uid()`
- Calendar tokens in separate `calendar_integrations` table
- Automatic RLS enforcement at database level
- Proper multi-tenant isolation

## Migration Files

1. **PHASE1_MULTI_TENANT_MIGRATION.sql** - Part 1
   - Backs up existing data
   - Drops foreign key constraints
   - Creates new UUID-based users table
   - Migrates existing user data
   - Updates all foreign key columns to UUID
   - Recreates foreign key constraints

2. **PHASE1_MULTI_TENANT_MIGRATION_PART2.sql** - Part 2
   - Creates `calendar_integrations` table
   - Migrates existing calendar tokens
   - Creates updated RLS policies
   - Adds performance indexes
   - Verification queries

## Pre-Migration Checklist

- [ ] **CRITICAL: Backup your database** using Supabase dashboard
- [ ] Verify you have only one user (user ID 1) in the system
- [ ] Note down the user's email address
- [ ] Ensure no active users are using the system
- [ ] Have Supabase project URL and service role key ready

## Running the Migration

### Step 1: Backup Database

In Supabase Dashboard:
1. Go to Database → Backups
2. Create a manual backup
3. Wait for backup to complete

### Step 2: Run Part 1

1. Open Supabase SQL Editor
2. Copy contents of `PHASE1_MULTI_TENANT_MIGRATION.sql`
3. Paste and run
4. Verify no errors in output
5. Check that backup tables were created:
   ```sql
   SELECT COUNT(*) FROM _backup_users;
   SELECT COUNT(*) FROM _backup_meetings;
   SELECT COUNT(*) FROM _backup_clients;
   ```

### Step 3: Run Part 2

1. In Supabase SQL Editor
2. Copy contents of `PHASE1_MULTI_TENANT_MIGRATION_PART2.sql`
3. Paste and run
4. Verify no errors in output
5. Check verification queries at the end

### Step 4: Verify Migration

Run these verification queries:

```sql
-- Check users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Verify user was migrated
SELECT id, email, name, onboarding_completed 
FROM users;

-- Check calendar_integrations table
SELECT * FROM calendar_integrations;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'meetings', 'clients', 'calendar_integrations');

-- Verify foreign keys
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'users';

-- Count data
SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM meetings) as meetings,
    (SELECT COUNT(*) FROM clients) as clients,
    (SELECT COUNT(*) FROM calendar_integrations) as calendar_integrations;
```

## Expected Results

After successful migration:

1. **Users Table**
   - 1 user with UUID: `550e8400-e29b-41d4-a716-446655440000`
   - `onboarding_completed = TRUE`
   - All original data preserved

2. **Calendar Integrations Table**
   - 1 record (if user had calendar connected)
   - `provider = 'google'`
   - `is_primary = TRUE`

3. **Meetings Table**
   - All meetings preserved
   - `userid` now UUID instead of TEXT/INTEGER
   - `calendar_integration_id` populated

4. **Clients Table**
   - All clients preserved
   - `advisor_id` now UUID instead of TEXT/INTEGER

5. **RLS Policies**
   - All tables have RLS enabled
   - Policies use `auth.uid()` instead of manual filtering

## Rollback Procedure

If something goes wrong:

```sql
-- Restore from backup tables
DROP TABLE users CASCADE;
ALTER TABLE _old_users RENAME TO users;

-- Restore foreign keys (you'll need to recreate them manually)
-- Or restore from Supabase backup

-- Clean up
DROP TABLE IF EXISTS _backup_users;
DROP TABLE IF EXISTS _backup_meetings;
DROP TABLE IF EXISTS _backup_clients;
DROP TABLE IF EXISTS _backup_calendartoken;
```

## Post-Migration Steps

After successful migration:

1. **DO NOT** delete backup tables yet
2. Test the application with Phase 2 changes
3. Verify RLS policies are working
4. After 1 week of successful operation, clean up:
   ```sql
   DROP TABLE IF EXISTS _backup_users;
   DROP TABLE IF EXISTS _backup_meetings;
   DROP TABLE IF EXISTS _backup_clients;
   DROP TABLE IF EXISTS _backup_calendartoken;
   DROP TABLE IF EXISTS _old_users;
   ```

## Troubleshooting

### Error: "column does not exist"
- Check that you ran Part 1 before Part 2
- Verify table names match your schema

### Error: "foreign key violation"
- Check that user was migrated successfully
- Verify UUID is correct: `550e8400-e29b-41d4-a716-446655440000`

### Error: "policy already exists"
- Drop existing policies first:
  ```sql
  DROP POLICY IF EXISTS "policy_name" ON table_name;
  ```

### Data Missing After Migration
- Check backup tables:
  ```sql
  SELECT * FROM _backup_users;
  SELECT * FROM _backup_meetings;
  ```
- Restore from Supabase backup if needed

## Important Notes

1. **Fixed UUID**: The migration uses a fixed UUID (`550e8400-e29b-41d4-a716-446655440000`) for the existing user to ensure consistency.

2. **Onboarding Status**: Existing user is marked as `onboarding_completed = TRUE` since they're already using the system.

3. **Calendar Tokens**: Existing calendar tokens are migrated to the new `calendar_integrations` table.

4. **RLS Enforcement**: After this migration, RLS policies will be enforced. Phase 2 will update the backend to use Supabase Auth instead of service role key.

5. **Breaking Change**: This is a breaking change. The backend code must be updated (Phase 2) before the application will work again.

## Next Steps

After completing Phase 1:
1. Proceed to Phase 2: Switch from Custom JWT to Supabase Auth
2. Update backend to use Supabase Auth
3. Update frontend to use Supabase Auth
4. Test complete authentication flow

## Support

If you encounter issues:
1. Check the verification queries
2. Review the Supabase logs
3. Restore from backup if needed
4. Contact support with error messages and verification query results

