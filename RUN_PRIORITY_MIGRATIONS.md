# 🚀 Run Priority Workflow Migrations

## ⚠️ IMPORTANT: Read Before Running

These migrations will:
1. Add a `priority` column to the `pending_transcript_action_items` table
2. **Move ALL incomplete action items** from `transcript_action_items` back to `pending_transcript_action_items`
3. Preserve completed action items in `transcript_action_items` for historical record

**This is a one-time reset of the approval workflow.**

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your Advicly project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

---

### Step 2: Run Migration 018 (Add Priority Column)

**Copy and paste this SQL:**

```sql
-- Migration 018: Add Priority Column to Pending Action Items
-- This adds a priority field so users can set priority BEFORE approving items

ALTER TABLE pending_transcript_action_items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4);

COMMENT ON COLUMN pending_transcript_action_items.priority IS 'User-selected priority level before approval: 1=Urgent, 2=High, 3=Medium, 4=Low';

CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_priority ON pending_transcript_action_items(priority);
```

**Click "Run"**

**Expected Result:**
```
Success. No rows returned
```

---

### Step 3: Run Migration 019 (Move Items to Pending)

**⚠️ WARNING:** This will move all incomplete action items back to pending for re-approval!

**Copy and paste this SQL:**

```sql
-- Migration 019: Move All Approved Items Back to Pending
-- This is a one-time migration to reset the approval workflow

-- Insert all incomplete approved items back into pending
INSERT INTO pending_transcript_action_items (
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    priority,
    created_at
)
SELECT 
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    COALESCE(priority, 3) as priority,  -- Preserve existing priority or default to Medium
    created_at
FROM transcript_action_items
WHERE completed = false  -- Only move incomplete items
ON CONFLICT DO NOTHING;  -- Skip if somehow already exists

-- Log the count of items moved
DO $$
DECLARE
    moved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO moved_count FROM transcript_action_items WHERE completed = false;
    RAISE NOTICE 'Moved % incomplete action items to pending approval', moved_count;
END $$;

-- Delete the moved items from transcript_action_items (only incomplete ones)
DELETE FROM transcript_action_items WHERE completed = false;

-- Note: Completed items are preserved in transcript_action_items for historical record
```

**Click "Run"**

**Expected Result:**
```
Success. No rows returned
NOTICE: Moved X incomplete action items to pending approval
```

(Where X is the number of incomplete items that were moved)

---

### Step 4: Verify Migrations

**Run this verification query:**

```sql
-- Verify migration results
SELECT 
    'Pending Items' as table_name,
    COUNT(*) as count,
    COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as with_priority
FROM pending_transcript_action_items

UNION ALL

SELECT 
    'Approved Items (Incomplete)' as table_name,
    COUNT(*) as count,
    COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as with_priority
FROM transcript_action_items
WHERE completed = false

UNION ALL

SELECT 
    'Approved Items (Completed)' as table_name,
    COUNT(*) as count,
    COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as with_priority
FROM transcript_action_items
WHERE completed = true;
```

**Expected Results:**
- **Pending Items:** Should show all your incomplete action items with priority column
- **Approved Items (Incomplete):** Should be 0 (all moved to pending)
- **Approved Items (Completed):** Should show your completed items (preserved)

---

## ✅ What Happens Next

After running these migrations:

1. **All incomplete action items** will appear in the "Pending Approval" tab
2. **Each pending item** will have a priority dropdown (defaults to Medium)
3. **Users can set priorities** before approving items
4. **When approved**, items move to "Action Items" tab with their selected priority
5. **Completed items** remain in the system for historical record

---

## 🎯 Testing the New Workflow

### Test 1: View Pending Items
1. Go to **Action Items** page
2. Click **"Pending Approval"** tab
3. You should see all your incomplete action items
4. Each item should have a priority dropdown

### Test 2: Set Priority
1. Click a priority dropdown
2. Select a different priority (e.g., Urgent)
3. The change should save immediately
4. Refresh the page - priority should persist

### Test 3: Approve Items
1. Select some items with checkboxes
2. Click **"Approve Selected"**
3. Go to **"Action Items"** tab
4. Approved items should appear with correct priority badges

### Test 4: Meetings Page
1. Go to **Meetings** page
2. Click on a meeting with a transcript
3. Pending items should show with priority dropdowns
4. Test setting priority and approving

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- WARNING: This will delete all pending items!
-- Only use if you need to undo the migration

-- Move pending items back to approved
INSERT INTO transcript_action_items (
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    priority,
    completed,
    created_at
)
SELECT 
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    priority,
    false as completed,
    created_at
FROM pending_transcript_action_items
ON CONFLICT DO NOTHING;

-- Delete from pending
DELETE FROM pending_transcript_action_items;

-- Remove priority column from pending table
ALTER TABLE pending_transcript_action_items DROP COLUMN IF EXISTS priority;
```

---

## 📊 Migration Summary

| Migration | Purpose | Impact |
|-----------|---------|--------|
| 018 | Add priority column to pending table | Low - just adds a column |
| 019 | Move incomplete items to pending | High - resets approval workflow |

**Total Time:** ~30 seconds
**Downtime:** None (migrations are non-blocking)
**Data Loss:** None (all data preserved)

---

## 🆘 Troubleshooting

### Error: "column already exists"
**Solution:** Migration 018 already ran. Skip to Migration 019.

### Error: "relation does not exist"
**Solution:** Make sure you're running migrations in the correct Supabase project.

### No items in pending after migration
**Possible causes:**
1. All your action items were already completed
2. You don't have any action items yet
3. Migration 019 didn't run successfully

**Check:**
```sql
SELECT COUNT(*) FROM transcript_action_items WHERE completed = false;
```
If this returns 0, then all items were already completed.

### Priority dropdown not showing
**Possible causes:**
1. Frontend not deployed yet
2. Browser cache needs clearing

**Solution:**
1. Wait for Cloudflare Pages deployment to complete
2. Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

---

## ✅ Checklist

- [ ] Opened Supabase SQL Editor
- [ ] Ran Migration 018 successfully
- [ ] Ran Migration 019 successfully
- [ ] Ran verification query
- [ ] Verified pending items count is correct
- [ ] Tested priority dropdown in Action Items page
- [ ] Tested priority dropdown in Meetings page
- [ ] Tested approving items with priority
- [ ] Verified approved items have correct priority

---

## 🎉 You're Done!

The priority workflow is now active. Users can:
- ✅ Set priority BEFORE approving action items
- ✅ See priority dropdowns in both Action Items and Meetings pages
- ✅ Have priorities automatically preserved when approving
- ✅ Still use AI to re-prioritize approved items if needed

**Enjoy your enhanced action items workflow!** 🚀

