# Run Webhook Migration - REQUIRED

## ⚠️ IMPORTANT: This migration MUST be run for webhooks to work!

The automatic webhook sync requires the `calendar_watch_channels` table to use UUID for user_id (compatible with Supabase Auth).

## Quick Steps

### 1. Go to Supabase SQL Editor
- Open https://app.supabase.com
- Select your project
- Go to SQL Editor

### 2. Copy the Migration SQL
Copy the entire SQL from `backend/migrations/025_update_calendar_watch_channels_for_uuid.sql`

### 3. Paste and Run
- Paste the SQL into the SQL Editor
- Click "Run" button
- Wait for completion (should take < 5 seconds)

### 4. Verify Success
You should see:
```
calendar_watch_channels table created/updated
```

## What This Migration Does

1. **Drops old table** - Removes the old `calendar_watch_channels` table with INTEGER user_id
2. **Creates new table** - Creates new table with UUID user_id (compatible with Supabase Auth)
3. **Adds indexes** - Creates indexes for performance
4. **Enables RLS** - Adds Row Level Security policies
5. **Verifies** - Runs verification queries

## Why This Is Needed

- Old table used INTEGER user_id (from legacy schema)
- New schema uses UUID user_id (Supabase Auth standard)
- Webhook service expects UUID user_id
- Without this migration, webhook setup will fail

## After Running Migration

1. ✅ Reconnect Google Calendar in Settings
2. ✅ Webhook will be set up automatically
3. ✅ Initial sync will fetch all existing meetings
4. ✅ "Last sync" will show the sync time
5. ✅ Meetings will appear in Meetings page

## Troubleshooting

### Migration Failed
- Check error message in SQL Editor
- Make sure you're in the right project
- Try running again

### Still Seeing "Last sync: Never"
1. Check if migration ran successfully
2. Reconnect Google Calendar
3. Check backend logs on Render for errors
4. Look for "Setting up Google Calendar watch" message

### Webhook Not Receiving Notifications
1. Verify migration ran
2. Check `calendar_watch_channels` table exists
3. Check backend logs for webhook setup messages
4. Try reconnecting Google Calendar

## SQL to Run

```sql
-- =====================================================
-- UPDATE CALENDAR_WATCH_CHANNELS FOR UUID USERS
-- =====================================================

-- Drop the old table if it exists with INTEGER user_id
DROP TABLE IF EXISTS calendar_watch_channels CASCADE;

-- Create the new table with UUID user_id
CREATE TABLE IF NOT EXISTS calendar_watch_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMP NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id) -- One watch channel per user
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS calendar_watch_channels_user_id_idx ON calendar_watch_channels(user_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_channel_id_idx ON calendar_watch_channels(channel_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_expiration_idx ON calendar_watch_channels(expiration);

-- Enable Row Level Security
ALTER TABLE calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only see their own watch channels
CREATE POLICY "Users can view their own watch channels"
  ON calendar_watch_channels
  FOR SELECT
  USING (user_id = auth.uid());

-- Create RLS policy: Users can only insert their own watch channels
CREATE POLICY "Users can insert their own watch channels"
  ON calendar_watch_channels
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create RLS policy: Users can only update their own watch channels
CREATE POLICY "Users can update their own watch channels"
  ON calendar_watch_channels
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create RLS policy: Users can only delete their own watch channels
CREATE POLICY "Users can delete their own watch channels"
  ON calendar_watch_channels
  FOR DELETE
  USING (user_id = auth.uid());

-- Add comment
COMMENT ON TABLE calendar_watch_channels IS 'Stores Google Calendar webhook channel information for push notifications. One channel per user.';
COMMENT ON COLUMN calendar_watch_channels.channel_id IS 'Unique channel ID for the webhook subscription';
COMMENT ON COLUMN calendar_watch_channels.resource_id IS 'Google Calendar resource ID for the watch';
COMMENT ON COLUMN calendar_watch_channels.expiration IS 'When the webhook subscription expires (max 7 days)';
COMMENT ON COLUMN calendar_watch_channels.webhook_url IS 'The URL where Google sends webhook notifications';

-- Verification queries
SELECT 'calendar_watch_channels table created/updated' as status;
SELECT COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'calendar_watch_channels';
SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'calendar_watch_channels';
```

## Next Steps

After running the migration:

1. **Reconnect Google Calendar**
   - Go to Settings → Calendar Integrations
   - Click "Disconnect" (if already connected)
   - Click "Connect Google Calendar"
   - Complete OAuth flow

2. **Verify Webhook Setup**
   - Check backend logs on Render
   - Look for "Setting up Google Calendar watch" message
   - Look for "Initial sync completed" message

3. **Check Meetings**
   - Go to Meetings page
   - Verify meetings appear
   - Check "Last sync" shows recent time

4. **Test Real-Time Sync**
   - Create new meeting in Google Calendar
   - Wait 5 seconds
   - Refresh Meetings page
   - New meeting should appear

## Support

If you have issues:
1. Check that migration ran successfully
2. Verify backend is deployed
3. Check Render logs for errors
4. Try reconnecting Google Calendar
5. Contact support with error details

