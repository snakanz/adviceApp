# Run Business Type Expected Close Date Migration

## Migration File
`backend/migrations/010_add_business_type_close_date.sql`

## What This Migration Does
1. Adds `expected_close_date` column to `client_business_types` table
2. Creates an index for performance when querying by close date
3. Updates the `client_business_summary` view to include earliest and latest close dates

## How to Run

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Migration SQL**
   - Open `backend/migrations/010_add_business_type_close_date.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" button
   - Wait for confirmation that all statements executed successfully

5. **Verify the Migration**
   - The last query in the migration will show the new column
   - You should see: `expected_close_date | date | YES`

### Option 2: Using psql Command Line

If you have direct database access:

```bash
psql "postgresql://[YOUR_CONNECTION_STRING]" -f backend/migrations/010_add_business_type_close_date.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check that the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_business_types' 
AND column_name = 'expected_close_date';

-- Check that the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'client_business_types'
AND indexname = 'idx_client_business_types_expected_close_date';
```

## What Happens After Migration

Once the migration is complete:

1. ✅ The database will have the new `expected_close_date` column
2. ✅ The frontend will display a date picker in the Business Type Manager
3. ✅ Users can set individual expected close dates for each business type
4. ✅ The Client Pipeline page can use these dates for organizing business

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the column
ALTER TABLE client_business_types DROP COLUMN IF EXISTS expected_close_date;

-- Remove the index
DROP INDEX IF EXISTS idx_client_business_types_expected_close_date;

-- Restore the old view (without close dates)
CREATE OR REPLACE VIEW client_business_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.pipeline_stage,
    c.likely_close_month,
    COUNT(cbt.id) as business_type_count,
    ARRAY_AGG(
        DISTINCT cbt.business_type 
        ORDER BY cbt.business_type
    ) as business_types,
    SUM(cbt.business_amount) as total_business_amount,
    SUM(cbt.iaf_expected) as total_iaf_expected,
    STRING_AGG(
        DISTINCT cbt.contribution_method, 
        ', ' 
        ORDER BY cbt.contribution_method
    ) as contribution_methods
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;
```

## Notes

- This migration is **safe to run** - it only adds a new column, doesn't modify existing data
- The column is **nullable** - existing business types will have NULL for expected_close_date
- The migration uses **IF NOT EXISTS** - safe to run multiple times
- The frontend code is already deployed and will work with or without the migration

