-- =====================================================
-- ADD SKIP_TRANSCRIPTION_FOR_MEETING COLUMN
-- =====================================================
-- This migration adds a column to allow users to disable
-- Recall bot for specific meetings (per-meeting override)

-- Add skip_transcription_for_meeting column to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS skip_transcription_for_meeting BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_meetings_skip_transcription ON meetings(skip_transcription_for_meeting);

-- Verification query
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
AND column_name = 'skip_transcription_for_meeting';

