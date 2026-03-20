# Multi-Tenant Onboarding Migration Guide

## Overview

This migration transforms Advicly into a complete multi-tenant platform with proper tenant isolation, calendar connections, and onboarding flow support.

## What This Migration Does

### 1. Creates New Tables

- **`tenants`** - Business/organization tenants
  - Stores business name, type, team size
  - Links to owner (user)
  - Supports timezone and currency settings

- **`tenant_members`** - User-to-tenant relationships
  - Maps users to tenants with roles (owner, admin, member)
  - Supports future permissions system
  - Ensures unique user-tenant relationships

- **`calendar_connections`** - Calendar integration connections
  - Replaces the old `calendartoken` table
  - Supports Google Calendar, Outlook, and Calendly
  - Stores OAuth tokens and webhook information
  - Tracks sync status and errors

### 2. Adds Tenant Isolation

Adds `tenant_id` column to all data tables:
- `users`
- `meetings`
- `clients`
- `advisor_tasks` (if exists)
- `client_documents` (if exists)
- `ask_threads` (if exists)
- `transcript_action_items` (if exists)

### 3. Implements Row Level Security (RLS)

Creates RLS policies to ensure:
- Users can only see data from their own tenant
- Tenant owners can manage their tenant settings
- Admins can manage tenant members
- Calendar connections are private to each user

### 4. Adds Helper Functions

- `get_user_tenant_id(user_uuid)` - Get a user's tenant ID
- `is_tenant_owner(user_uuid, tenant_uuid)` - Check if user owns a tenant

## Prerequisites

Before running this migration, ensure:

1. ✅ Users table has UUID `id` column (not TEXT or INTEGER)
2. ✅ Users table has onboarding tracking columns:
   - `onboarding_completed` (BOOLEAN)
   - `onboarding_step` (INTEGER)
   - `business_name` (TEXT)
   - `timezone` (TEXT)

If these don't exist, run the Phase 1 migrations first:
- `PHASE1_MULTI_TENANT_MIGRATION_FIXED.sql`
- `PHASE1_MULTI_TENANT_MIGRATION_PART2.sql`

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `020_multi_tenant_onboarding.sql`
5. Click **Run**
6. Check for success messages in the output

### Option 2: Supabase CLI

```bash
# From the project root
supabase db push --file backend/migrations/020_multi_tenant_onboarding.sql
```

### Option 3: psql Command Line

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f backend/migrations/020_multi_tenant_onboarding.sql
```

## Verification

After running the migration, verify it worked:

### 1. Check Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('tenants', 'tenant_members', 'calendar_connections')
AND table_schema = 'public';
```

Expected: 3 rows returned

### 2. Check tenant_id Columns Added

```sql
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name = 'tenant_id' 
AND table_schema = 'public'
ORDER BY table_name;
```

Expected: Multiple rows showing tenant_id in various tables

### 3. Check RLS Policies

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('tenants', 'tenant_members', 'calendar_connections')
ORDER BY tablename, policyname;
```

Expected: Multiple policies for each table

### 4. Check Helper Functions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_user_tenant_id', 'is_tenant_owner')
AND routine_schema = 'public';
```

Expected: 2 rows returned

## Post-Migration Steps

### 1. Update Environment Variables

Ensure your backend `.env` has:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (for calendar)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/google/callback
```

### 2. Migrate Existing Data (If Applicable)

If you have existing users, you'll need to:

1. Create a tenant for each existing user
2. Link the user to their tenant
3. Update all their data with the tenant_id

Example migration script:

```sql
-- For each existing user, create a tenant and link data
DO $$
DECLARE
    user_record RECORD;
    new_tenant_id UUID;
BEGIN
    FOR user_record IN SELECT id, email, name, business_name FROM users WHERE tenant_id IS NULL
    LOOP
        -- Create tenant for this user
        INSERT INTO tenants (name, owner_id, business_type)
        VALUES (
            COALESCE(user_record.business_name, user_record.name || '''s Business'),
            user_record.id,
            'Financial Advisor'
        )
        RETURNING id INTO new_tenant_id;
        
        -- Add user as tenant owner
        INSERT INTO tenant_members (tenant_id, user_id, role)
        VALUES (new_tenant_id, user_record.id, 'owner');
        
        -- Update user with tenant_id
        UPDATE users SET tenant_id = new_tenant_id WHERE id = user_record.id;
        
        -- Update all user's data with tenant_id
        UPDATE meetings SET tenant_id = new_tenant_id WHERE userid = user_record.id;
        UPDATE clients SET tenant_id = new_tenant_id WHERE advisor_id = user_record.id;
        
        -- Update other tables if they exist
        UPDATE advisor_tasks SET tenant_id = new_tenant_id WHERE advisor_id = user_record.id;
        UPDATE client_documents SET tenant_id = new_tenant_id WHERE advisor_id = user_record.id;
        UPDATE ask_threads SET tenant_id = new_tenant_id WHERE advisor_id = user_record.id;
        UPDATE transcript_action_items SET tenant_id = new_tenant_id WHERE advisor_id = user_record.id;
        
        RAISE NOTICE 'Created tenant % for user %', new_tenant_id, user_record.email;
    END LOOP;
END $$;
```

### 3. Migrate Calendar Tokens

If you have existing calendar tokens in the `calendartoken` table:

```sql
-- Migrate existing calendar tokens to calendar_connections
INSERT INTO calendar_connections (
    user_id,
    tenant_id,
    provider,
    provider_account_email,
    access_token,
    refresh_token,
    token_expires_at,
    is_primary,
    is_active,
    created_at,
    updated_at
)
SELECT 
    ct.userid::uuid,
    u.tenant_id,
    ct.provider,
    u.email, -- Use user's email as provider account email
    ct.accesstoken,
    ct.refreshtoken,
    ct.expiresat,
    true, -- Set as primary
    true, -- Set as active
    NOW(),
    NOW()
FROM calendartoken ct
JOIN users u ON ct.userid::text = u.id::text
WHERE NOT EXISTS (
    SELECT 1 FROM calendar_connections cc 
    WHERE cc.user_id = ct.userid::uuid 
    AND cc.provider = ct.provider
);
```

### 4. Update Backend Code

The backend code needs to be updated to:
- Use `calendar_connections` instead of `calendartoken`
- Filter all queries by `tenant_id`
- Use the new tenant management endpoints

This is handled in Phase 2 of the implementation.

### 5. Test the Migration

1. Try logging in with an existing user
2. Check that their data is still accessible
3. Verify RLS policies are working (users can't see other tenants' data)
4. Test creating a new user and going through onboarding

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop new tables
DROP TABLE IF EXISTS calendar_connections CASCADE;
DROP TABLE IF EXISTS tenant_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Remove tenant_id columns
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE clients DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE advisor_tasks DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE client_documents DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE ask_threads DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE transcript_action_items DROP COLUMN IF EXISTS tenant_id;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_user_tenant_id(UUID);
DROP FUNCTION IF EXISTS is_tenant_owner(UUID, UUID);
```

## Troubleshooting

### Error: "relation 'users' does not exist"
- The users table hasn't been created yet
- Run the Phase 1 migrations first

### Error: "column 'onboarding_completed' does not exist"
- The users table doesn't have onboarding columns
- Run `PHASE1_MULTI_TENANT_MIGRATION_PART2.sql` first

### Error: "foreign key constraint violation"
- You're trying to add tenant_id to tables with existing data
- Run the data migration script first (see Post-Migration Steps)

### RLS Policies Not Working
- Make sure you're using the Supabase anon key (not service role key) in your frontend
- Check that `auth.uid()` returns the correct user ID
- Verify the user has a tenant_id set

## Next Steps

After successful migration:

1. ✅ Proceed to Phase 2: Backend API Implementation
2. ✅ Create tenant management endpoints
3. ✅ Update existing endpoints to use tenant_id
4. ✅ Implement onboarding flow endpoints
5. ✅ Build frontend onboarding components

## Support

If you encounter issues:
1. Check the Supabase logs in the dashboard
2. Review the RLS policies
3. Verify environment variables are set correctly
4. Check that all prerequisites are met

