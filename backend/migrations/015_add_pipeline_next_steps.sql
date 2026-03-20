-- Migration: Add pipeline_next_steps column to clients table
-- Purpose: Store AI-generated next steps summary for pipeline management
-- Date: 2025-10-15

-- Add pipeline_next_steps column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_next_steps TEXT;

-- Add timestamp column to track when the summary was generated
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_next_steps_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance when querying by generation timestamp
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_next_steps_generated_at 
ON clients(pipeline_next_steps_generated_at);

-- Add comment to document the column purpose
COMMENT ON COLUMN clients.pipeline_next_steps IS 'AI-generated summary of next steps to close the deal, generated from pipeline stage, business types, and recent meeting action points';
COMMENT ON COLUMN clients.pipeline_next_steps_generated_at IS 'Timestamp when the pipeline next steps summary was last generated';

