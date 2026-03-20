# Run Not Proceeding Status Migration

## Migration File
`backend/migrations/014_add_not_proceeding_status.sql`

## What This Migration Does
1. Adds `not_proceeding` boolean column to `client_business_types` table (default: FALSE)
2. Adds `not_proceeding_reason` text column to capture why it's not proceeding
3. Adds `not_proceeding_date` timestamp column to track when it was marked as not proceeding
4. Creates an index for performance when filtering not proceeding items
5. Updates the `client_business_summary` view to:
   - Exclude not proceeding items from counts and totals by default
   - Add `not_proceeding_count` field for reference

## How to Run

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open `backend/migrations/014_add_not_proceeding_status.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - Wait for success message

5. **Verify Results**
   - You should see a table showing the new columns were created
   - Check that all 3 columns appear: `not_proceeding`, `not_proceeding_reason`, `not_proceeding_date`

### Option 2: Using psql Command Line

If you have direct database access:

```bash
psql "postgresql://[YOUR_CONNECTION_STRING]" -f backend/migrations/014_add_not_proceeding_status.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check that the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'client_business_types' 
AND column_name IN ('not_proceeding', 'not_proceeding_reason', 'not_proceeding_date')
ORDER BY column_name;

-- Check that the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'client_business_types'
AND indexname = 'idx_client_business_types_not_proceeding';

-- Check the updated view
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_business_summary'
AND column_name IN ('business_type_count', 'not_proceeding_count')
ORDER BY column_name;
```

## What Happens After Migration

Once the migration is complete:

1. ✅ The database will have the new `not_proceeding` fields
2. ✅ All existing business types will have `not_proceeding = FALSE` by default
3. ✅ The frontend will display a "Mark as Not Proceeding" option in the Pipeline detail panel
4. ✅ Not proceeding items will be filtered out of the pipeline view by default
5. ✅ Users can optionally show not proceeding items via a toggle
6. ✅ Not proceeding items will still appear on the Clients page with a badge

## Expected Schema After Migration

The `client_business_types` table will have these columns:

| Column Name | Data Type | Nullable | Default | Description |
|-------------|-----------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| client_id | UUID | NO | - | Foreign key to clients |
| business_type | TEXT | NO | - | Type of business |
| business_amount | NUMERIC | YES | - | Business amount |
| contribution_method | TEXT | YES | - | Contribution method |
| regular_contribution_amount | TEXT | YES | - | Regular contribution |
| iaf_expected | NUMERIC | YES | - | Expected IAF |
| notes | TEXT | YES | - | Notes |
| expected_close_date | DATE | YES | - | Expected close date |
| **not_proceeding** | **BOOLEAN** | **YES** | **FALSE** | **Not proceeding flag** |
| **not_proceeding_reason** | **TEXT** | **YES** | **NULL** | **Reason for not proceeding** |
| **not_proceeding_date** | **TIMESTAMP WITH TIME ZONE** | **YES** | **NULL** | **Date marked as not proceeding** |
| created_at | TIMESTAMP WITH TIME ZONE | YES | NOW() | Created timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | YES | NOW() | Updated timestamp |

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the columns
ALTER TABLE client_business_types DROP COLUMN IF EXISTS not_proceeding;
ALTER TABLE client_business_types DROP COLUMN IF EXISTS not_proceeding_reason;
ALTER TABLE client_business_types DROP COLUMN IF EXISTS not_proceeding_date;

-- Remove the index
DROP INDEX IF EXISTS idx_client_business_types_not_proceeding;

-- Restore the original view (without not proceeding filters)
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
    ) as contribution_methods,
    MIN(cbt.expected_close_date) as earliest_close_date,
    MAX(cbt.expected_close_date) as latest_close_date
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;
```

## Next Steps

After running this migration:

1. **Deploy Backend Changes** - The backend API endpoint will be added to mark items as not proceeding
2. **Deploy Frontend Changes** - The Pipeline and Clients pages will be updated to support the new status
3. **Test the Feature** - Mark a business type as not proceeding and verify it's filtered correctly

## Support

If you encounter any issues:
- Check the Supabase logs for error messages
- Verify your database connection
- Ensure you have the necessary permissions to alter tables
- Contact support if the issue persists

