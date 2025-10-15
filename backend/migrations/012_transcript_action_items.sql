-- Transcript Action Items Migration
-- This migration creates a table for individual action items extracted from meeting transcripts

-- Create transcript_action_items table for AI-extracted action items
CREATE TABLE IF NOT EXISTS transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
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
COMMENT ON TABLE transcript_action_items IS 'Individual action items extracted from meeting transcripts using AI';
COMMENT ON COLUMN transcript_action_items.action_text IS 'The action item text extracted from the transcript';
COMMENT ON COLUMN transcript_action_items.completed IS 'Whether the action item has been completed';
COMMENT ON COLUMN transcript_action_items.display_order IS 'Order in which action items should be displayed (0-based)';

