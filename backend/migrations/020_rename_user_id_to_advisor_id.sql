-- Migration: Rename user_id to advisor_id in action items tables
-- This aligns the database schema with the codebase expectations
-- Date: 2025-11-17

-- Update pending_transcript_action_items table
ALTER TABLE pending_transcript_action_items 
RENAME COLUMN user_id TO advisor_id;

-- Update transcript_action_items table
ALTER TABLE transcript_action_items 
RENAME COLUMN user_id TO advisor_id;

-- Add updated_at column to pending_transcript_action_items if missing
ALTER TABLE pending_transcript_action_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update column comments for clarity
COMMENT ON COLUMN pending_transcript_action_items.advisor_id IS 'UUID of the advisor who owns this action item (references users.id)';
COMMENT ON COLUMN transcript_action_items.advisor_id IS 'UUID of the advisor who owns this action item (references users.id)';

-- Verify the changes
DO $$
BEGIN
    -- Check if advisor_id column exists in pending_transcript_action_items
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pending_transcript_action_items' 
        AND column_name = 'advisor_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: advisor_id column not found in pending_transcript_action_items';
    END IF;

    -- Check if advisor_id column exists in transcript_action_items
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'transcript_action_items' 
        AND column_name = 'advisor_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: advisor_id column not found in transcript_action_items';
    END IF;

    RAISE NOTICE 'Migration completed successfully: user_id renamed to advisor_id in both tables';
END $$;

