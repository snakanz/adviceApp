# ⚡ QUICK FIX GUIDE - Pipeline Data Persistence

## 🚨 THE PROBLEM
Pipeline data not saving to database when adding clients to pipeline.

## ✅ THE SOLUTION (2 STEPS)

### **STEP 1: Run Database Migration** ⏱️ 2 minutes

1. Open: https://supabase.com/dashboard
2. Go to: **SQL Editor**
3. Copy: `PIPELINE_DATA_FIX_MIGRATION.sql` (entire file)
4. Paste into SQL Editor
5. Click: **"Run"**
6. Wait for: ✅ Success messages

### **STEP 2: Test It Works** ⏱️ 3 minutes

1. Open: https://adviceapp.pages.dev
2. Go to: **Clients** page
3. Click: **"Pipeline"** on any client
4. Fill form:
   - Pipeline Stage: "Waiting to Sign"
   - Business Type: "Pension"
   - IAF Expected: 5000
   - Business Amount: 250000
5. Click: **"Create Pipeline Entry"**
6. Go to: **Pipeline** page
7. Verify: Client appears with data ✅

## 🎯 EXPECTED RESULT

- ✅ No errors
- ✅ Client appears in Pipeline view
- ✅ All data displays correctly
- ✅ Data persists after refresh

## 🔍 IF IT DOESN'T WORK

**Check backend logs for:**
```
❌ Error updating client pipeline: column "iaf_expected" does not exist
```
**Solution:** Run Step 1 again (migration not applied)

**Check for:**
```
❌ Error updating client pipeline: invalid input syntax for type numeric
```
**Solution:** Backend needs restart (already done if you see this guide)

## 📊 WHAT WAS FIXED

**Backend:** `backend/src/routes/clients.js`
- ✅ Handles empty strings correctly
- ✅ Converts types properly
- ✅ Better error logging

**Database:** `PIPELINE_DATA_FIX_MIGRATION.sql`
- ✅ Adds missing columns
- ✅ Updates constraints
- ✅ Creates indexes

## 📁 FILES CREATED

1. `PIPELINE_DATA_FIX_MIGRATION.sql` - **RUN THIS IN SUPABASE**
2. `PIPELINE_DATA_PERSISTENCE_FIX.md` - Full documentation
3. `PIPELINE_FIX_SUMMARY.md` - Detailed summary
4. `QUICK_FIX_GUIDE.md` - This guide
5. `test-pipeline-fix.js` - Testing helper

## ⏰ TOTAL TIME: 5 MINUTES

**That's it! Your pipeline data will now save correctly.** 🎉

