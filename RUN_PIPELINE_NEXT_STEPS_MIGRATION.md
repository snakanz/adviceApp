# Run Pipeline Next Steps Migration

## Problem
The backend is trying to store AI-generated pipeline summaries in the `pipeline_next_steps` column, but this column doesn't exist in the `clients` table, causing the error:

```
Could not find the 'pipeline_next_steps' column of 'clients' in the schema cache
```

## Solution
Run migration `015_add_pipeline_next_steps.sql` to add the missing columns.

---

## Migration Instructions

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open `backend/migrations/015_add_pipeline_next_steps.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run Migration**
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - Wait for success message

5. **Verify Migration**
   - Run this query to verify the columns were created:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'clients' 
   AND column_name IN ('pipeline_next_steps', 'pipeline_next_steps_generated_at');
   ```
   - You should see 2 rows returned

---

### Option 2: psql Command Line

If you have direct database access:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
\i backend/migrations/015_add_pipeline_next_steps.sql

# Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('pipeline_next_steps', 'pipeline_next_steps_generated_at');
```

---

## What This Migration Does

### Adds Two Columns to `clients` Table:

1. **`pipeline_next_steps`** (TEXT)
   - Stores AI-generated summary of next steps to close the deal
   - Generated from: pipeline stage, business types, recent meeting action points
   - Example: "Schedule follow-up meeting to review pension transfer paperwork. Client needs to provide current provider statements. Target completion by end of month."

2. **`pipeline_next_steps_generated_at`** (TIMESTAMP WITH TIME ZONE)
   - Tracks when the summary was last generated
   - Used for cache invalidation (summaries older than 1 hour are regenerated)

### Creates Index:
- `idx_clients_pipeline_next_steps_generated_at` - Improves query performance

---

## Expected Behavior After Migration

### Pipeline Page:
- When you click on a client in the pipeline view
- AI automatically generates a summary of next steps
- Summary is cached for 1 hour
- Summary updates when pipeline data changes

### Clients Page:
- Client summary section will load without errors
- Shows AI-generated insights about the client

---

## Rollback (If Needed)

If you need to undo this migration:

```sql
-- Remove the columns
ALTER TABLE clients DROP COLUMN IF EXISTS pipeline_next_steps;
ALTER TABLE clients DROP COLUMN IF EXISTS pipeline_next_steps_generated_at;

-- Remove the index
DROP INDEX IF EXISTS idx_clients_pipeline_next_steps_generated_at;
```

---

## Testing After Migration

1. **Go to Pipeline Page**
2. **Click on a client** with pipeline data
3. **Check the detail panel** - should see "Next Steps" section
4. **Verify no errors** in browser console or backend logs
5. **Check Clients Page** - client summary should load without errors

---

## Notes

- This migration is **safe to run** - uses `IF NOT EXISTS` clauses
- **No data loss** - only adds new columns
- **Backward compatible** - existing queries continue to work
- **Performance impact**: Minimal - only adds one index

---

## Related Files

- **Migration**: `backend/migrations/015_add_pipeline_next_steps.sql`
- **Backend API**: `backend/src/routes/clients.js` (line 1726-1732)
- **Frontend**: `src/pages/Pipeline.js` (uses pipeline_next_steps)
- **Frontend**: `src/pages/Clients.js` (displays client summary)

