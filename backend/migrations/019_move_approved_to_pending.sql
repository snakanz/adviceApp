-- Move All Approved Action Items Back to Pending
-- This is a one-time migration to reset the approval workflow
-- All existing action items will be moved back to pending for re-approval with priority selection

-- Insert all existing approved action items into pending table
INSERT INTO pending_transcript_action_items (
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    priority,
    created_at
)
SELECT 
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    COALESCE(priority, 3) as priority,  -- Preserve existing priority or default to Medium
    created_at
FROM transcript_action_items
WHERE completed = false  -- Only move incomplete items
ON CONFLICT DO NOTHING;  -- Skip if somehow already exists

-- Log the count of items moved
DO $$
DECLARE
    moved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO moved_count FROM transcript_action_items WHERE completed = false;
    RAISE NOTICE 'Moved % incomplete action items to pending approval', moved_count;
END $$;

-- Delete the moved items from transcript_action_items (only incomplete ones)
DELETE FROM transcript_action_items WHERE completed = false;

-- Note: Completed items are preserved in transcript_action_items for historical record

