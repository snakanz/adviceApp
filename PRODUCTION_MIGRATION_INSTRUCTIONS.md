# 🚀 Production Migration Instructions for Advicly Platform

## 📋 **Required Database Migrations**

### **Migration 1: Calendly Integration Fix**
**File**: `backend/migrations/008_calendly_comprehensive_fix.sql`
**Priority**: HIGH - Required for Calendly sync to work properly

**What it fixes:**
- Makes `googleeventid` nullable for Calendly meetings
- Adds Calendly-specific columns (`calendly_event_uri`, `calendly_event_uuid`, `client_email`)
- Updates meeting source constraints to include 'calendly'
- Adds performance indexes for Calendly lookups
- Creates monitoring functions for sync health

**To run in Supabase:**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the entire content of `backend/migrations/008_calendly_comprehensive_fix.sql`
4. Click "Run" to execute the migration

### **Migration 2: Action Items Schema (if not already run)**
**File**: `backend/migrations/007_action_items_schema.sql`
**Priority**: MEDIUM - Required for Action Items feature

**What it adds:**
- `advisor_tasks` table for ad-hoc task management
- `email_summaries` table for tracking sent emails
- Dashboard views for action items
- Proper indexes and constraints

## 🔧 **Post-Migration Steps**

### **1. Verify Calendly Integration**
After running the migration, test the Calendly sync:

```bash
# In your backend, test the Calendly connection
curl -X GET "https://your-backend-url/api/calendly/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Run a sync test
curl -X POST "https://your-backend-url/api/calendly/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **2. Check Migration Success**
Run these queries in Supabase SQL Editor to verify:

```sql
-- Check if Calendly columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('calendly_event_uri', 'calendly_event_uuid', 'client_email', 'sync_status');

-- Check meeting source constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'meetings_meeting_source_check';

-- Test the new sync status function
SELECT get_calendly_sync_status(1);
```

## 🎯 **Expected Results After Migration**

### **Calendly Sync Improvements:**
- ✅ Fetch meetings from **2 years back** to **1 year forward** (previously only 3 months back)
- ✅ Handle **pagination** for accounts with 100+ meetings
- ✅ Proper **database schema** with Calendly-specific fields
- ✅ **Enhanced error handling** and sync status monitoring
- ✅ **Performance optimizations** with proper indexes

### **New Features Available:**
- ✅ **Comprehensive client creation** from Clients and Pipeline pages
- ✅ **Multi-business type support** with contribution methods
- ✅ **Action Items dashboard** (if migration 007 is run)
- ✅ **Enhanced meeting management** with edit capabilities

## 🚨 **Troubleshooting**

### **If Calendly Sync Still Fails:**

1. **Check Environment Variables:**
   ```bash
   # Ensure this is set in your backend environment
   CALENDLY_PERSONAL_ACCESS_TOKEN=your_token_here
   ```

2. **Verify Token Permissions:**
   - Token must have read access to scheduled events
   - Test with: `GET https://api.calendly.com/users/me`

3. **Check Database Connectivity:**
   ```sql
   -- Test if functions were created
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name IN ('get_calendly_sync_status', 'get_user_meetings_comprehensive');
   ```

4. **Monitor Sync Logs:**
   - Check backend logs for detailed error messages
   - Look for pagination and API rate limit issues

### **If Client Creation Fails:**

1. **Check Business Types Table:**
   ```sql
   -- Verify multi-business types table exists
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'client_business_types';
   ```

2. **Verify Pipeline Stages:**
   ```sql
   -- Check valid pipeline stages
   SELECT DISTINCT pipeline_stage FROM clients WHERE pipeline_stage IS NOT NULL;
   ```

## 📊 **Monitoring and Health Checks**

### **Calendly Sync Health:**
```sql
-- Check sync status for all users
SELECT userid, get_calendly_sync_status(userid) as status
FROM users 
WHERE id IN (SELECT DISTINCT userid FROM meetings WHERE meeting_source = 'calendly');
```

### **Integration Overview:**
```sql
-- View integration status
SELECT * FROM integration_status;
```

### **Recent Sync Activity:**
```sql
-- Check recent Calendly meetings
SELECT COUNT(*), DATE(starttime) as meeting_date
FROM meetings 
WHERE meeting_source = 'calendly' 
AND starttime >= NOW() - INTERVAL '30 days'
GROUP BY DATE(starttime)
ORDER BY meeting_date DESC;
```

## 🎉 **Success Indicators**

After successful migration and testing, you should see:

1. **Calendly meetings spanning 2+ years** in your meetings list
2. **No database errors** in backend logs
3. **Proper client creation** from multiple entry points
4. **Enhanced meeting management** with edit capabilities
5. **Action items dashboard** functioning (if migration 007 run)

## 📞 **Support**

If you encounter any issues:
1. Check the backend logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database migrations completed successfully
4. Test API endpoints individually to isolate issues

**The platform is now significantly more robust and feature-complete!** 🚀
