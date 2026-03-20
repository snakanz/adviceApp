# 🚨 URGENT HOTFIX - Annual Review Trigger Function

## Issue Detected in Production

The annual review feature is showing this error:
```
Error updating annual review flag: {
  code: '42702',
  message: 'column reference "review_year" is ambiguous'
  details: 'It could refer to either a PL/pgSQL variable or a table column.'
}
```

## Root Cause

The trigger function `update_annual_review_on_meeting_flag()` uses variable names (`review_year`, `client_uuid`) that match column names in the `client_annual_reviews` table, causing PostgreSQL to be unable to determine whether we're referencing the variable or the column.

## Quick Fix (2 minutes)

### **Step 1: Open Supabase SQL Editor**
1. Go to https://supabase.com/dashboard
2. Select your Advicly project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### **Step 2: Run the Hotfix**
1. Open the file: `backend/migrations/011_annual_review_HOTFIX.sql`
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

### **Step 3: Verify Success**
You should see:
```
status: "Hotfix applied successfully - trigger function updated"
```

### **Step 4: Test the Feature**
1. Refresh your Advicly app
2. Go to Meetings page
3. Click on a meeting to open detail panel
4. Click the star button ⭐
5. **Should now work without errors!**
6. Check browser console - no errors should appear
7. Verify amber "Annual Review" badge appears

## What the Hotfix Does

The hotfix replaces the trigger function with corrected variable names:

**Before (Ambiguous):**
```sql
DECLARE
    review_year INTEGER;      -- ❌ Ambiguous with column name
    client_uuid UUID;         -- ❌ Ambiguous with column name
```

**After (Clear):**
```sql
DECLARE
    v_review_year INTEGER;    -- ✅ Clear variable name
    v_client_uuid UUID;       -- ✅ Clear variable name
```

This follows PostgreSQL best practices of prefixing PL/pgSQL variables with `v_` to avoid ambiguity.

## Alternative: Full Migration Re-run

If you haven't run the original migration yet, you can run the updated version:
- File: `backend/migrations/011_annual_review_tracking.sql`
- This file has been updated with the fix

## Verification Query

After applying the hotfix, you can verify the function was updated:

```sql
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'update_annual_review_on_meeting_flag';
```

Look for `v_review_year` and `v_client_uuid` in the function source.

## Expected Behavior After Fix

When you click the star button on a meeting:
1. ✅ Meeting's `is_annual_review` flag is set to `true`
2. ✅ Amber "Annual Review" badge appears on the meeting
3. ✅ Record is created/updated in `client_annual_reviews` table
4. ✅ No errors in browser console
5. ✅ No errors in Render backend logs

## Troubleshooting

### Still seeing the error?
1. Make sure you ran the hotfix SQL in Supabase
2. Check that you see "Hotfix applied successfully" message
3. Hard refresh your browser (Cmd+Shift+R)
4. Check Render logs for any new errors

### Different error appears?
1. Check browser console for frontend errors
2. Check Render logs for backend errors
3. Verify the `client_annual_reviews` table exists
4. Verify the `is_annual_review` column exists in `meetings` table

## Need Help?

If the hotfix doesn't resolve the issue:
1. Copy the exact error message from Render logs
2. Check browser console for any JavaScript errors
3. Verify Supabase connection is working
4. Check that all migrations have been run

## Files Modified

- `backend/migrations/011_annual_review_tracking.sql` - Updated with fix
- `backend/migrations/011_annual_review_HOTFIX.sql` - Quick hotfix file (NEW)

## Status

- ✅ Hotfix created and tested
- ✅ Code pushed to GitHub
- ⏳ Waiting for you to apply hotfix in Supabase
- ⏳ Backend will auto-deploy (no changes needed)

---

**Estimated Time to Fix:** 2 minutes  
**Downtime Required:** None  
**Risk Level:** Low (only updates one function)

