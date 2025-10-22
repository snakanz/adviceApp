# How to Run the Calendar Migration

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **xjqjzievgepqpgtggcjx**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Copy the Migration SQL

Copy this SQL code:

```sql
-- Fix calendar_connections table to make tenant_id nullable
-- This allows backwards compatibility with existing users who don't have a tenant_id yet

-- ============================================================================
-- STEP 1: Make tenant_id nullable in calendar_connections
-- ============================================================================

ALTER TABLE calendar_connections 
ALTER COLUMN tenant_id DROP NOT NULL;

-- ============================================================================
-- STEP 2: Update foreign key constraint to allow NULL
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE calendar_connections
DROP CONSTRAINT IF EXISTS calendar_connections_tenant_id_fkey;

-- Add new foreign key constraint that allows NULL
ALTER TABLE calendar_connections
ADD CONSTRAINT calendar_connections_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 3: Backfill tenant_id for calendar connections without one
-- ============================================================================

-- For calendar connections without a tenant_id, try to get it from the user
UPDATE calendar_connections cc
SET tenant_id = u.tenant_id
FROM users u
WHERE cc.user_id = u.id
  AND cc.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Log the changes
-- ============================================================================

DO $$
DECLARE
    null_tenant_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM calendar_connections;
    SELECT COUNT(*) INTO null_tenant_count FROM calendar_connections WHERE tenant_id IS NULL;
    
    RAISE NOTICE '✅ Fixed calendar_connections schema:';
    RAISE NOTICE '   - Total connections: %', total_count;
    RAISE NOTICE '   - Connections without tenant_id: %', null_tenant_count;
    RAISE NOTICE '   - tenant_id is now nullable for backwards compatibility';
END $$;
```

## Step 3: Paste and Run

1. Paste the SQL code into the SQL Editor
2. Click **Run** button (or press Cmd+Enter / Ctrl+Enter)
3. Wait for the query to complete

## Step 4: Verify Success

You should see output like:
```
✅ Fixed calendar_connections schema:
   - Total connections: X
   - Connections without tenant_id: Y
   - tenant_id is now nullable for backwards compatibility
```

## Step 5: Verify the Change

Run this verification query to confirm:

```sql
-- Check that tenant_id is now nullable
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'calendar_connections'
AND column_name = 'tenant_id';
```

Expected result:
- `is_nullable`: YES
- `data_type`: uuid

## What This Migration Does

1. **Makes tenant_id nullable** - Allows existing users without a tenant to connect calendars
2. **Updates foreign key** - Allows NULL values in the constraint
3. **Backfills data** - Assigns tenant_id from users table where possible
4. **Logs results** - Shows how many connections were affected

## Troubleshooting

### Error: "relation does not exist"
- The calendar_connections table hasn't been created yet
- Run the main multi-tenant migration first

### Error: "constraint already exists"
- The constraint was already updated
- This is safe to run again

### Error: "permission denied"
- You need admin access to the Supabase project
- Contact your Supabase project owner

## Next Steps

After running this migration:

1. ✅ Migration complete
2. ✅ Backend auto-deployed (already done)
3. ✅ Frontend auto-deployed (already done)
4. 📋 Test the calendar integration (see CALENDAR_INTEGRATION_TESTING_GUIDE.md)
5. 🚀 Monitor logs on Render dashboard

## Questions?

If you encounter any issues:
1. Check the error message in Supabase SQL Editor
2. Verify the table exists: `SELECT * FROM calendar_connections LIMIT 1;`
3. Check the column: `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'calendar_connections';`

