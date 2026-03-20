-- Add detailed_summary column to meetings table for proper summary separation
-- This migration separates single-sentence summaries from detailed structured summaries

-- Add detailed_summary column for structured bullet-point summaries (Meetings page)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS detailed_summary TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_detailed_summary ON meetings(detailed_summary);

-- Add comment to document the column purpose
COMMENT ON COLUMN meetings.detailed_summary IS 'Structured summary with bullet points and formatting for Meetings page display';

-- Update existing comments for clarity
COMMENT ON COLUMN meetings.quick_summary IS 'Single-sentence summary for Clients page display';
COMMENT ON COLUMN meetings.brief_summary IS 'Legacy brief summary field (may be deprecated)';

-- Verify the new column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name = 'detailed_summary';

-- Show current summary-related columns in meetings table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('quick_summary', 'detailed_summary', 'brief_summary', 'email_summary_draft')
ORDER BY column_name;

-- Show sample of existing data to understand current state
SELECT 
  googleeventid,
  title,
  CASE 
    WHEN quick_summary IS NOT NULL THEN 'HAS_QUICK'
    ELSE 'NO_QUICK'
  END as quick_status,
  CASE 
    WHEN brief_summary IS NOT NULL THEN 'HAS_BRIEF'
    ELSE 'NO_BRIEF'
  END as brief_status,
  CASE 
    WHEN detailed_summary IS NOT NULL THEN 'HAS_DETAILED'
    ELSE 'NO_DETAILED'
  END as detailed_status
FROM meetings 
WHERE transcript IS NOT NULL
ORDER BY starttime DESC
LIMIT 10;
