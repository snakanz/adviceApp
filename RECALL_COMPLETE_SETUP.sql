-- ============================================================================
-- RECALL.AI COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor to enable full Recall.ai integration
-- ============================================================================

-- 1. Add Recall.ai columns to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_bot_id TEXT UNIQUE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_recording_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_status TEXT DEFAULT 'pending' 
  CHECK (recall_status IN ('pending', 'recording', 'completed', 'error', 'unknown'));
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recall_error TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_source TEXT DEFAULT 'manual' 
  CHECK (transcript_source IN ('manual', 'recall', 'meeting_captions', 'google'));

-- 2. Add transcription_enabled column to calendar_connections
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN DEFAULT FALSE;

-- 3. Create recall_webhook_events table for tracking webhook events
CREATE TABLE IF NOT EXISTS recall_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  bot_id TEXT NOT NULL,
  event_type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_recall_bot_id ON meetings(recall_bot_id);
CREATE INDEX IF NOT EXISTS idx_meetings_recall_status ON meetings(recall_status);
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_source ON meetings(transcript_source);
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_bot_id ON recall_webhook_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_event_type ON recall_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_created_at ON recall_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_transcription_enabled 
ON calendar_connections(user_id, transcription_enabled);

-- 5. Verification queries (run these to confirm setup)
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'meetings' AND column_name IN ('recall_bot_id', 'recall_status', 'transcript_source');
-- SELECT COUNT(*) as webhook_events FROM recall_webhook_events;
-- SELECT COUNT(*) as connections_with_transcription FROM calendar_connections WHERE transcription_enabled = TRUE;

