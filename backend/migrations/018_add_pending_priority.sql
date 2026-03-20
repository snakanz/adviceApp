-- Add Priority Column to Pending Action Items
-- This migration adds a priority field to pending_transcript_action_items
-- so users can set priority BEFORE approving action items

-- Add priority column to pending_transcript_action_items table
ALTER TABLE pending_transcript_action_items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4);

-- Add comment for documentation
COMMENT ON COLUMN pending_transcript_action_items.priority IS 'User-selected priority level before approval: 1=Urgent, 2=High, 3=Medium, 4=Low';

-- Create index for faster filtering by priority
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_priority ON pending_transcript_action_items(priority);

