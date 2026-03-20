# Migration Guide: Calendly Sync Optimization (022)

## Overview

This migration adds intelligent incremental sync capabilities and webhook support to the Calendly integration.

## What This Migration Does

1. **Adds sync tracking columns to `users` table**
   - `last_calendly_sync` - Timestamp of last successful sync
   - `calendly_initial_sync_complete` - Has full sync been completed?
   - `calendly_webhook_enabled` - Are webhooks configured?

2. **Creates `calendly_webhook_events` table**
   - Tracks webhook events for deduplication
   - Stores event payloads for audit trail
   - Auto-cleanup function for events older than 30 days

3. **Adds `synced_via_webhook` column to `meetings` table**
   - Tracks which meetings came from webhooks vs polling

4. **Creates `calendly_sync_health` view**
   - Monitoring view for sync status per user
   - Shows active/deleted/webhook-synced meeting counts

## How to Run the Migration

### Option 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" in the left sidebar

2. **Copy Migration SQL**
   - Open `database/migrations/022_calendly_sync_optimization.sql`
   - Copy the entire contents

3. **Run Migration**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success message

4. **Verify Migration**
   ```sql
   -- Check new columns exist
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name LIKE '%calendly%';
   
   -- Check new table exists
   SELECT * FROM calendly_webhook_events LIMIT 1;
   
   -- Check new view exists
   SELECT * FROM calendly_sync_health;
   ```

### Option 2: Command Line (psql)

```bash
# Connect to your database
psql -h your-db-host -U your-user -d your-db

# Run migration
\i database/migrations/022_calendly_sync_optimization.sql

# Verify
\d users
\d calendly_webhook_events
\d+ calendly_sync_health
```

## After Migration

### 1. Backend Deployment

The backend code is already deployed to Render. After running the migration:

1. **Restart backend** (if needed)
   - Render should auto-deploy from GitHub push
   - Check Render logs for successful startup

2. **Verify sync works**
   - Click "Sync Calendly" button in UI
   - Check logs for "FULL SYNC" or "INCREMENTAL SYNC"

### 2. Test Initial Sync

**First sync after migration:**
```
🎯 Initial sync needed - will fetch 2 years of historical data
📅 FULL SYNC: Fetching all Calendly events (2 years back, 1 year forward)
✅ FULL fetch complete: 150 active, 25 canceled
✅ Initial sync complete - future syncs will be incremental
🎉 FULL Calendly sync complete: 150 new, 0 updated, 0 deleted
```

**Second sync (should be faster):**
```
⚡ Incremental sync - fetching recent data only (3 months back, 6 months forward)
📅 INCREMENTAL SYNC: Fetching recent Calendly events
✅ INCREMENTAL fetch complete: 25 active, 2 canceled
🎉 INCREMENTAL Calendly sync complete: 1 new, 24 updated, 2 deleted
```

### 3. Optional: Setup Webhooks

For real-time updates (optional but recommended):

1. **Get webhook URL**
   ```bash
   curl https://your-backend.com/api/calendly/webhook/test
   ```

2. **Configure in Calendly**
   - Go to Calendly → Integrations → Webhooks
   - Create new webhook subscription
   - URL: `https://your-backend.com/api/calendly/webhook`
   - Events: `invitee.created`, `invitee.canceled`
   - Copy signing key

3. **Add to Render environment variables**
   - Go to Render dashboard
   - Select your backend service
   - Environment → Add variable
   - Key: `CALENDLY_WEBHOOK_SIGNING_KEY`
   - Value: [paste signing key from Calendly]
   - Save

4. **Test webhook**
   - Schedule a test meeting in Calendly
   - Check Render logs for:
     ```
     ✅ New meeting scheduled via webhook: ...
     ✅ Meeting created from webhook: ...
     ```

## Monitoring

### Check Sync Health

```sql
SELECT * FROM calendly_sync_health;
```

Expected output:
```
user_id | email        | last_calendly_sync  | calendly_initial_sync_complete | active_calendly_meetings | webhook_synced_meetings
--------|--------------|---------------------|-------------------------------|-------------------------|------------------------
1       | user@ex.com  | 2025-10-17 16:00:00 | true                          | 148                     | 5
```

### Check Webhook Events

```sql
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_received
FROM calendly_webhook_events
GROUP BY event_type;
```

Expected output:
```
event_type         | count | last_received
-------------------|-------|------------------
invitee.created    | 12    | 2025-10-17 15:45
invitee.canceled   | 3     | 2025-10-17 14:30
```

### Clean Old Webhook Events

Run periodically to clean up old events:

```sql
SELECT clean_old_webhook_events();
```

Returns number of deleted events.

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove new columns from users
ALTER TABLE users 
DROP COLUMN IF EXISTS last_calendly_sync,
DROP COLUMN IF EXISTS calendly_initial_sync_complete,
DROP COLUMN IF EXISTS calendly_webhook_enabled;

-- Remove new column from meetings
ALTER TABLE meetings 
DROP COLUMN IF EXISTS synced_via_webhook;

-- Drop new table
DROP TABLE IF EXISTS calendly_webhook_events;

-- Drop view
DROP VIEW IF EXISTS calendly_sync_health;

-- Drop function
DROP FUNCTION IF EXISTS clean_old_webhook_events();
```

## Troubleshooting

### Migration Fails

**Error: "column already exists"**
- Safe to ignore - column was already added
- Migration uses `IF NOT EXISTS` to be idempotent

**Error: "permission denied"**
- Make sure you're connected as database owner
- Or use Supabase SQL Editor (has proper permissions)

### Sync Not Working After Migration

1. **Check backend logs**
   ```
   Should see: "🎯 Initial sync needed" or "⚡ Incremental sync"
   ```

2. **Check user table**
   ```sql
   SELECT id, email, calendly_initial_sync_complete, last_calendly_sync 
   FROM users;
   ```

3. **Force full sync**
   ```sql
   UPDATE users SET calendly_initial_sync_complete = false WHERE id = 1;
   ```
   Then click "Sync Calendly" button

### Webhooks Not Working

1. **Check environment variable**
   - Render dashboard → Environment
   - Verify `CALENDLY_WEBHOOK_SIGNING_KEY` is set

2. **Check webhook URL is accessible**
   ```bash
   curl https://your-backend.com/api/calendly/webhook/test
   ```

3. **Check Calendly webhook configuration**
   - Calendly → Integrations → Webhooks
   - Verify URL matches your backend
   - Verify events are subscribed

4. **Check logs for webhook errors**
   ```
   Look for: "❌ Error processing Calendly webhook"
   ```

## Performance Expectations

### Before Migration

- Every sync: 2 years of data (150-250 events)
- Sync time: 15-30 seconds
- Data fetched per hour: ~1,000 events

### After Migration

- Initial sync: 2 years of data (150-250 events) - one time
- Incremental sync: 3 months of data (20-40 events)
- Sync time: 3-8 seconds
- Data fetched per hour: ~160 events
- **84% reduction in data fetched!**

### With Webhooks

- New/canceled meetings: Instant (<1 second)
- No polling needed for real-time updates
- Incremental sync still runs every 15 min as backup

## Success Criteria

✅ Migration runs without errors  
✅ New columns exist in `users` table  
✅ New table `calendly_webhook_events` exists  
✅ New view `calendly_sync_health` exists  
✅ First sync shows "FULL SYNC" in logs  
✅ Second sync shows "INCREMENTAL SYNC" in logs  
✅ Sync completes faster (3-8s vs 15-30s)  
✅ Optional: Webhooks deliver instant updates  

## Support

If you encounter issues:

1. Check Render logs for error messages
2. Check Supabase logs for database errors
3. Verify migration ran successfully
4. Try forcing a full sync
5. Check webhook configuration (if using webhooks)

The migration is designed to be safe and backward-compatible. Existing syncs will continue to work even if migration hasn't run yet.

