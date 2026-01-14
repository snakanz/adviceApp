-- Migration: Add trigger for pipeline_notes changes to update pipeline_data_updated_at
-- Purpose: Ensure pipeline notes changes trigger AI summary regeneration
-- This completes the smart caching system by tracking ALL pipeline-relevant data changes

-- Create function to update pipeline_data_updated_at when client's pipeline_notes change
CREATE OR REPLACE FUNCTION update_client_pipeline_data_on_notes_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if pipeline_notes changed (ignore other client field updates)
  IF (TG_OP = 'UPDATE' AND NEW.pipeline_notes IS DISTINCT FROM OLD.pipeline_notes) THEN
    NEW.pipeline_data_updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on clients table to update pipeline_data_updated_at when pipeline_notes change
DROP TRIGGER IF EXISTS trigger_update_pipeline_data_on_notes_change ON clients;
CREATE TRIGGER trigger_update_pipeline_data_on_notes_change
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_client_pipeline_data_on_notes_change();

-- Update comment to reflect that notes are also tracked
COMMENT ON COLUMN clients.pipeline_data_updated_at IS 'Timestamp when pipeline-relevant data (business types, meetings, transcripts, pipeline notes) was last updated. Used to determine if AI summary needs regeneration.';
