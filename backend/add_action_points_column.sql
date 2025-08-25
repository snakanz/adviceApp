-- Add action_points column to meetings table for AI-extracted action items
-- This column stores key action items that the user needs to complete from each meeting

-- Add action_points column
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS action_points TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_action_points ON meetings(action_points);

-- Add comment to document the column purpose
COMMENT ON COLUMN meetings.action_points IS 'AI-extracted action items that the user needs to complete from the meeting';

-- Verify the new column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name = 'action_points';

-- Show current summary-related columns in meetings table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('quick_summary', 'detailed_summary', 'brief_summary', 'email_summary_draft', 'action_points')
ORDER BY column_name;
