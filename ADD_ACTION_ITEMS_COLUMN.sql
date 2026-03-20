-- Add action_items column to clients table to store AI-extracted action items
-- Run this in Supabase SQL Editor

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN clients.action_items IS 'Array of action items extracted from meeting transcripts. Format: [{"text": "...", "completed": false, "due_date": "...", "source_meeting_id": "..."}]';

-- Create index for faster queries on action items
CREATE INDEX IF NOT EXISTS idx_clients_action_items ON clients USING GIN (action_items);

-- Example action item structure:
-- {
--   "text": "Send pension transfer paperwork",
--   "completed": false,
--   "due_date": "2025-11-01",
--   "source_meeting_id": "123",
--   "created_at": "2025-10-13T10:00:00Z"
-- }

