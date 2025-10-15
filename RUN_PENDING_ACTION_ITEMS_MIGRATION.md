# 🚨 Run This Migration for Action Items Approval Workflow

## What This Does

This migration creates a new table `pending_transcript_action_items` that stores action items extracted from transcripts **before** they are approved by the user.

## How to Run

### Option 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Migration**
   - Open the file: `backend/migrations/013_pending_transcript_action_items.sql`
   - Copy ALL content
   - Paste into Supabase SQL Editor

4. **Run the Migration**
   - Click "Run" button (or press Cmd+Enter / Ctrl+Enter)
   - Wait for completion (~2 seconds)

5. **Verify Success**
   - You should see: "Success. No rows returned"
   - This is normal for CREATE TABLE statements

### Option 2: Using Node.js Script

```bash
cd backend
node run-single-migration.js migrations/013_pending_transcript_action_items.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if the table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pending_transcript_action_items'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'pending_transcript_action_items';
```

You should see:
- Table with columns: id, meeting_id, client_id, advisor_id, action_text, display_order, created_at
- 3 indexes for performance

## What Happens Next

After this migration:
1. Transcript uploads will save action items to `pending_transcript_action_items` (not yet approved)
2. Users will see pending action items with checkboxes to select which ones to approve
3. Only approved items move to `transcript_action_items` table
4. Approved items appear on Action Items page and Client detail page

## Rollback (if needed)

If you need to undo this migration:

```sql
DROP TABLE IF EXISTS pending_transcript_action_items CASCADE;
```

⚠️ **Warning**: This will delete all pending action items data!

