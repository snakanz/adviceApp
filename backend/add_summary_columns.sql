-- Add columns for persistent transcript and summary storage
-- These columns support the meetings feature persistence requirements

-- Add summary persistence columns
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS quick_summary TEXT,
ADD COLUMN IF NOT EXISTS email_summary_draft TEXT,
ADD COLUMN IF NOT EXISTS email_template_id TEXT,
ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_last_summarized_at ON meetings(last_summarized_at);
CREATE INDEX IF NOT EXISTS idx_meetings_email_template_id ON meetings(email_template_id);

-- Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_starttime_desc ON meetings(starttime DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_userid ON meetings(userid);
CREATE INDEX IF NOT EXISTS idx_meetings_userid_starttime ON meetings(userid, starttime DESC);

-- Add clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_advisor_id ON clients(advisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_advisor_email ON clients(advisor_id, email);

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name IN ('quick_summary', 'email_summary_draft', 'email_template_id', 'last_summarized_at')
ORDER BY column_name;
