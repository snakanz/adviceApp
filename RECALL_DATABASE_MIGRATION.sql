-- Recall.ai Database Migration
-- Run this in Supabase SQL Editor

-- 1. Add transcription_enabled column to calendar_connections
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN DEFAULT FALSE;

-- 2. Create recall_webhook_events table for tracking webhook events
CREATE TABLE IF NOT EXISTS recall_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  bot_id TEXT NOT NULL,
  event_type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_bot_id ON recall_webhook_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_event_type ON recall_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_created_at ON recall_webhook_events(created_at);

-- 4. Create index on calendar_connections for transcription_enabled
CREATE INDEX IF NOT EXISTS idx_calendar_connections_transcription_enabled 
ON calendar_connections(user_id, transcription_enabled);

-- 5. Verify meetings table has all required columns
-- (These should already exist from previous migrations)
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_bot_id TEXT;
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_status TEXT DEFAULT 'pending';
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_source TEXT DEFAULT 'manual';

-- 6. Create indexes on meetings table for Recall tracking
CREATE INDEX IF NOT EXISTS idx_meetings_recall_bot_id ON meetings(recall_bot_id);
CREATE INDEX IF NOT EXISTS idx_meetings_recall_status ON meetings(recall_status);
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_source ON meetings(transcript_source);

-- 7. Enable RLS on recall_webhook_events (optional - for audit trail)
-- ALTER TABLE recall_webhook_events ENABLE ROW LEVEL SECURITY;

-- 8. Set default transcription_enabled to TRUE for existing calendar connections
-- (Uncomment if you want to enable transcription for all existing users)
-- UPDATE calendar_connections SET transcription_enabled = TRUE WHERE provider IN ('google', 'calendly');

-- Verification queries:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'calendar_connections' AND column_name = 'transcription_enabled';
-- SELECT COUNT(*) FROM recall_webhook_events;
-- SELECT * FROM calendar_connections LIMIT 1;

