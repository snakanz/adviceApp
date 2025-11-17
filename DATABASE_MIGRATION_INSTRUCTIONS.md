# 🗄️ Database Migration Instructions for Render

## ⚠️ Critical Migration Required

Your production database needs to be updated to fix the `advisor_id` column issue that's causing action items to fail.

---

## 📋 Migration Overview

**Migration File:** `backend/migrations/020_rename_user_id_to_advisor_id.sql`

**What it does:**
- Renames `user_id` column to `advisor_id` in `pending_transcript_action_items` table
- Renames `user_id` column to `advisor_id` in `transcript_action_items` table
- Adds `updated_at` column to `pending_transcript_action_items` if missing
- Adds column comments for documentation
- Includes verification checks to ensure migration succeeded

**Why it's needed:**
- Your code references `advisor_id` but the database has `user_id`
- This is causing errors: `column pending_transcript_action_items.advisor_id does not exist`
- Action items queries are failing in production

---

## 🚀 How to Run the Migration on Render

### Option 1: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Navigate to: https://dashboard.render.com
   - Select your Postgres database

2. **Open the SQL Shell**
   - Click on the "Shell" tab or "Connect" button
   - This will open a psql terminal connected to your database

3. **Copy and paste the migration SQL:**

```sql
-- Migration: Rename user_id to advisor_id in action items tables
-- This aligns the database schema with the codebase expectations
-- Date: 2025-11-17

-- Update pending_transcript_action_items table
ALTER TABLE pending_transcript_action_items 
RENAME COLUMN user_id TO advisor_id;

-- Update transcript_action_items table
ALTER TABLE transcript_action_items 
RENAME COLUMN user_id TO advisor_id;

-- Add updated_at column to pending_transcript_action_items if missing
ALTER TABLE pending_transcript_action_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update column comments for clarity
COMMENT ON COLUMN pending_transcript_action_items.advisor_id IS 'UUID of the advisor who owns this action item (references users.id)';
COMMENT ON COLUMN transcript_action_items.advisor_id IS 'UUID of the advisor who owns this action item (references users.id)';

-- Verify the changes
DO $$
BEGIN
    -- Check if advisor_id column exists in pending_transcript_action_items
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pending_transcript_action_items' 
        AND column_name = 'advisor_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: advisor_id column not found in pending_transcript_action_items';
    END IF;

    -- Check if advisor_id column exists in transcript_action_items
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'transcript_action_items' 
        AND column_name = 'advisor_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: advisor_id column not found in transcript_action_items';
    END IF;

    RAISE NOTICE 'Migration completed successfully: user_id renamed to advisor_id in both tables';
END $$;
```

4. **Press Enter to execute**
   - You should see: `Migration completed successfully: user_id renamed to advisor_id in both tables`

5. **Verify the migration:**

```sql
-- Check the schema of pending_transcript_action_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pending_transcript_action_items' 
ORDER BY ordinal_position;

-- Check the schema of transcript_action_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transcript_action_items' 
ORDER BY ordinal_position;
```

You should see `advisor_id` in both tables (not `user_id`).

---

### Option 2: Using Supabase Dashboard (If using Supabase)

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query
4. Paste the migration SQL from above
5. Click "Run" to execute
6. Verify with the verification queries

---

## ✅ Expected Results

After running the migration, you should see:

**Before:**
```
pending_transcript_action_items:
- user_id (UUID) ❌

transcript_action_items:
- user_id (UUID) ❌
```

**After:**
```
pending_transcript_action_items:
- advisor_id (UUID) ✅
- updated_at (TIMESTAMP) ✅

transcript_action_items:
- advisor_id (UUID) ✅
```

---

## 🔍 Verification Steps

After running the migration, verify it worked:

1. **Check Render logs** for action items errors:
   - Should no longer see: `column advisor_id does not exist`

2. **Test manual transcript upload:**
   - Upload a transcript manually
   - Check that action items are created
   - Check that summaries are generated

3. **Test Recall.ai webhook** (if connected):
   - Let a meeting complete with Recall.ai
   - Check that action items are created
   - Check that summaries are generated

---

## 🎯 What This Fixes

✅ **Action items will now work correctly**
- Pending action items can be fetched
- Action items can be approved/rejected
- Action items can be moved to the approved table

✅ **Manual transcript upload will auto-generate summaries**
- Quick summary (for Clients page)
- Email summary (for email drafts)
- Action points (for action items)

✅ **Recall.ai webhook will continue to work**
- Already working, but now action items will save correctly

---

## 🚨 Important Notes

- **This migration is safe** - it only renames columns, doesn't delete data
- **No data loss** - all existing action items will be preserved
- **Backward compatible** - the code already expects `advisor_id`
- **Run during low traffic** - to minimize any potential disruption
- **Backup recommended** - Render should have automatic backups, but verify

---

## 📞 Support

If you encounter any issues:
1. Check Render logs for error messages
2. Verify the migration ran successfully with the verification queries
3. Check that your Render deployment has pulled the latest code from GitHub

---

## 🎉 After Migration

Once the migration is complete:

1. **Render will auto-deploy** the latest code from GitHub (already pushed)
2. **Test the features:**
   - Upload a transcript manually
   - Verify summaries are generated
   - Verify action items appear in the pending list
3. **Monitor logs** for any errors

Your manual transcript upload will now work identically to Recall.ai webhook! 🚀

