-- Add brief_summary column to meetings table for improved summary display
-- This column stores single-sentence summaries for the Clients page

-- Add brief_summary column
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS brief_summary TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_brief_summary ON meetings(brief_summary);

-- Add comment to document the column purpose
COMMENT ON COLUMN meetings.brief_summary IS 'Single-sentence summary for display on Clients page';

-- Verify the new column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name = 'brief_summary';

-- Show current meetings table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;
