# How to Run the Annual Review Migration

## ⚠️ IMPORTANT: Database Migration Required

The Annual Review feature requires a database migration to add new tables and fields. The backend routes won't work until this migration is run.

## Option 1: Run via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your Advicly project

2. **Open SQL Editor:**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration:**
   - Open the file: `backend/migrations/011_annual_review_tracking.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration:**
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - Wait for success message
   - You should see: "Success. No rows returned"

5. **Verify Migration:**
   - Run this query to verify:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'meetings' 
   AND column_name = 'is_annual_review';
   ```
   - You should see one row returned with `is_annual_review` column

## Option 2: Run via Command Line (Advanced)

If you have direct database access:

```bash
# Using psql
psql -h <your-supabase-host> -U postgres -d postgres -f backend/migrations/011_annual_review_tracking.sql

# Or using Supabase CLI
supabase db push
```

## What the Migration Does

The migration creates:

1. **New Column in `meetings` table:**
   - `is_annual_review` (BOOLEAN, default: false)
   - Index for performance

2. **New Table: `client_annual_reviews`**
   - Tracks annual review status per client per year
   - Fields: id, client_id, advisor_id, review_year, review_date, meeting_id, status, notes

3. **New View: `annual_review_dashboard`**
   - Combines client and annual review data
   - Computes review status (pending, scheduled, completed, overdue)

4. **Triggers and Functions:**
   - Auto-updates annual review records when meetings are flagged
   - Initializes annual review records for current year

## After Running Migration

1. **Wait for Backend Deployment:**
   - Render should auto-deploy the backend (takes 2-5 minutes)
   - Check Render dashboard: https://dashboard.render.com/

2. **Verify Backend is Running:**
   - Check the Render logs for successful deployment
   - Look for: "✅ Calendar routes mounted"

3. **Test the Feature:**
   - Refresh your Advicly app
   - Go to Meetings page
   - Click on a meeting to open detail panel
   - Click the star button to mark as annual review
   - Should see amber badge appear

## Troubleshooting

### Error: "relation 'meetings' does not exist"
- Your database might not have the meetings table
- Check if you're connected to the correct database

### Error: "column 'is_annual_review' already exists"
- Migration has already been run
- You can skip this migration

### Error: "permission denied"
- Make sure you're logged in as a superuser or database owner
- In Supabase, use the postgres user

### Backend Still Returns 404
1. Check Render deployment status
2. Check Render logs for errors
3. Verify the backend is running the latest code
4. Try manual redeploy in Render dashboard

## Need Help?

If you encounter issues:
1. Check Render logs for backend errors
2. Check Supabase logs for database errors
3. Check browser console for frontend errors
4. Verify migration ran successfully with the verification query above

