-- Pending Transcript Action Items Migration
-- This migration creates a table for action items extracted from transcripts that are awaiting approval

-- Create pending_transcript_action_items table for AI-extracted action items pending approval
CREATE TABLE IF NOT EXISTS pending_transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_meeting_id ON pending_transcript_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_client_id ON pending_transcript_action_items(client_id);
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_advisor_id ON pending_transcript_action_items(advisor_id);

-- Add comments for documentation
COMMENT ON TABLE pending_transcript_action_items IS 'Action items extracted from meeting transcripts awaiting advisor approval before being added to the main action items list';
COMMENT ON COLUMN pending_transcript_action_items.action_text IS 'The action item text extracted from the transcript';
COMMENT ON COLUMN pending_transcript_action_items.display_order IS 'Order in which action items should be displayed (0-based)';

