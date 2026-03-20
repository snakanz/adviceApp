-- Add meeting_url column to meetings table
-- This stores the video conferencing URL (Google Meet, Zoom, Teams, etc.)
-- for both Recall.ai bot joining and user-facing "Join Meeting" functionality

ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_url TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN meetings.meeting_url IS 'Video conferencing URL (Google Meet, Zoom, Teams, Webex) extracted from calendar events for bot joining and user access';

