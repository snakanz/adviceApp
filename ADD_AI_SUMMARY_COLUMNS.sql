-- Add AI summary columns to clients table
-- Run this in Supabase SQL Editor

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the columns
COMMENT ON COLUMN clients.ai_summary IS 'AI-generated summary of client relationship status and progress';
COMMENT ON COLUMN clients.ai_summary_generated_at IS 'Timestamp when the AI summary was last generated';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clients_ai_summary_generated_at ON clients(ai_summary_generated_at);

