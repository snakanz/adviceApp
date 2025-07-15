-- Add pipeline-related columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS likely_value NUMERIC,
ADD COLUMN IF NOT EXISTS likely_close_month DATE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meetings_business_type ON meetings(business_type);
CREATE INDEX IF NOT EXISTS idx_meetings_likely_value ON meetings(likely_value);
CREATE INDEX IF NOT EXISTS idx_meetings_likely_close_month ON meetings(likely_close_month); 