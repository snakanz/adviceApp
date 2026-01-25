-- Detailed Meeting Summary Migration
-- Adds a detailed_summary column to store comprehensive AI-generated meeting analysis

-- Add detailed_summary column to meetings table
-- This stores the full 1000+ word categorized breakdown of the meeting transcript
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS detailed_summary TEXT;

-- Add index for faster lookups (nullable column, may not always be populated)
CREATE INDEX IF NOT EXISTS idx_meetings_detailed_summary_exists
ON meetings ((detailed_summary IS NOT NULL));

-- Add comment for documentation
COMMENT ON COLUMN meetings.detailed_summary IS 'Comprehensive AI-generated meeting analysis (1000+ words). Includes categorized discussion topics, key points, and detailed notes extracted from the transcript.';

SELECT 'Migration 017 completed: detailed_summary column added to meetings table' as status;
