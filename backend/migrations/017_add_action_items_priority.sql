-- Add Priority Column to Action Items
-- This migration adds a priority field to transcript_action_items for AI-powered prioritization

-- Add priority column to transcript_action_items table
ALTER TABLE transcript_action_items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4);

-- Add comment for documentation
COMMENT ON COLUMN transcript_action_items.priority IS 'AI-assigned priority level: 1=Urgent, 2=High, 3=Medium, 4=Low';

-- Create index for faster filtering by priority
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_priority ON transcript_action_items(priority);

