-- Pending Transcript Action Items Migration
-- This migration creates a table for action items extracted from transcripts that are awaiting approval
-- IMPORTANT: advisor_id is UUID (matches users.id) for multi-tenant support

-- Drop existing table if it has wrong schema (INTEGER advisor_id instead of UUID)
DROP TABLE IF EXISTS pending_transcript_action_items CASCADE;

-- Create pending_transcript_action_items table for AI-extracted action items pending approval
CREATE TABLE IF NOT EXISTS pending_transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_meeting_id ON pending_transcript_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_client_id ON pending_transcript_action_items(client_id);
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_advisor_id ON pending_transcript_action_items(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_created_at ON pending_transcript_action_items(created_at DESC);

-- Enable RLS
ALTER TABLE pending_transcript_action_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Advisors can only see their own pending action items
DROP POLICY IF EXISTS "Pending transcript action items for own advisor" ON pending_transcript_action_items;
CREATE POLICY "Pending transcript action items for own advisor" ON pending_transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE pending_transcript_action_items IS 'Action items extracted from meeting transcripts awaiting advisor approval before being added to the main action items list. PRIMARY PATH: Recall.ai webhook auto-generates these. FALLBACK: Manual transcript upload.';
COMMENT ON COLUMN pending_transcript_action_items.action_text IS 'The action item text extracted from the transcript';
COMMENT ON COLUMN pending_transcript_action_items.display_order IS 'Order in which action items should be displayed (0-based)';
COMMENT ON COLUMN pending_transcript_action_items.priority IS 'Priority level: 1=Urgent, 2=High, 3=Medium, 4=Low';

