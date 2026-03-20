-- =====================================================
-- GOOGLE CALENDAR WEBHOOK SUPPORT
-- =====================================================
-- This migration adds support for Google Calendar Push Notifications
-- Stores webhook channel information for real-time calendar sync
-- =====================================================

-- Create table for storing Google Calendar watch channels
CREATE TABLE IF NOT EXISTS calendar_watch_channels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMP NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id) -- One watch channel per user
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS calendar_watch_channels_user_id_idx ON calendar_watch_channels(user_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_channel_id_idx ON calendar_watch_channels(channel_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_expiration_idx ON calendar_watch_channels(expiration);

-- Add comments for documentation
COMMENT ON TABLE calendar_watch_channels IS 'Stores Google Calendar webhook channel information for push notifications';
COMMENT ON COLUMN calendar_watch_channels.channel_id IS 'Unique channel ID from Google Calendar API';
COMMENT ON COLUMN calendar_watch_channels.resource_id IS 'Resource ID from Google Calendar API';
COMMENT ON COLUMN calendar_watch_channels.expiration IS 'When the watch channel expires (max 7 days)';
COMMENT ON COLUMN calendar_watch_channels.webhook_url IS 'URL where Google sends notifications';

-- =====================================================
-- NOTES
-- =====================================================
-- Google Calendar watch channels expire after a maximum of 7 days
-- The application should renew channels before they expire
-- When a channel expires, it must be re-registered
-- =====================================================

