-- Transcript Action Items Migration
-- This migration creates a table for individual action items extracted from meeting transcripts
-- IMPORTANT: advisor_id is UUID (matches users.id) for multi-tenant support

-- Drop existing table if it has wrong schema (INTEGER advisor_id instead of UUID)
DROP TABLE IF EXISTS transcript_action_items CASCADE;

-- Create transcript_action_items table for AI-extracted action items (APPROVED items only)
CREATE TABLE IF NOT EXISTS transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_meeting_id ON transcript_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_client_id ON transcript_action_items(client_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_advisor_id ON transcript_action_items(advisor_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_completed ON transcript_action_items(completed);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_created_at ON transcript_action_items(created_at DESC);

-- Enable RLS
ALTER TABLE transcript_action_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Advisors can only see their own action items
DROP POLICY IF EXISTS "Transcript action items for own advisor" ON transcript_action_items;
CREATE POLICY "Transcript action items for own advisor" ON transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcript_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_transcript_action_items_updated_at
    BEFORE UPDATE ON transcript_action_items
    FOR EACH ROW
    EXECUTE FUNCTION update_transcript_action_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE transcript_action_items IS 'APPROVED action items extracted from meeting transcripts using AI. PRIMARY PATH: Recall.ai webhook auto-generates transcripts and action items. FALLBACK: Manual transcript upload. Items start in pending_transcript_action_items table and move here after approval.';
COMMENT ON COLUMN transcript_action_items.action_text IS 'The action item text extracted from the transcript';
COMMENT ON COLUMN transcript_action_items.priority IS 'Priority level: 1=Urgent, 2=High, 3=Medium, 4=Low';
COMMENT ON COLUMN transcript_action_items.completed IS 'Whether the action item has been completed';
COMMENT ON COLUMN transcript_action_items.display_order IS 'Order in which action items should be displayed (0-based)';

