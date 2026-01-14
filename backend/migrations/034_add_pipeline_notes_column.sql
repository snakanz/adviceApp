-- Migration: Add pipeline_notes column if it doesn't exist
-- Purpose: Store pipeline-specific notes that are used in AI summary generation
-- This is separate from the general 'notes' column

-- Add pipeline_notes column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS pipeline_notes TEXT;

-- Add index for performance when filtering by pipeline notes
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_notes
ON clients(pipeline_notes) WHERE pipeline_notes IS NOT NULL;

-- Migrate existing notes to pipeline_notes if pipeline_notes is NULL
-- This ensures backward compatibility
UPDATE clients
SET pipeline_notes = notes
WHERE pipeline_notes IS NULL AND notes IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN clients.pipeline_notes IS 'Pipeline-specific notes used in AI summary generation. Tracked by pipeline_data_updated_at trigger for smart caching.';
