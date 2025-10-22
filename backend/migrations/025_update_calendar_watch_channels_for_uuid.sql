-- =====================================================
-- UPDATE CALENDAR_WATCH_CHANNELS FOR UUID USERS
-- =====================================================
-- This migration updates the calendar_watch_channels table
-- to use UUID for user_id (compatible with Supabase Auth)
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

