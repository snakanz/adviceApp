-- Migration: Add pipeline_data_updated_at to track when pipeline-relevant data changes
-- Purpose: Enables smart AI summary regeneration only when data actually changes
-- This prevents wasteful token usage by only regenerating when meetings, business types, or notes change

-- Add column to track when pipeline-relevant data last changed
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS pipeline_data_updated_at TIMESTAMP WITH TIME ZONE;

-- Backfill with updated_at for existing records
UPDATE clients
SET pipeline_data_updated_at = updated_at
WHERE pipeline_data_updated_at IS NULL;

-- Create function to update pipeline_data_updated_at
CREATE OR REPLACE FUNCTION update_client_pipeline_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the parent client's pipeline_data_updated_at when business types change
  UPDATE clients
  SET pipeline_data_updated_at = NOW()
  WHERE id = NEW.client_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on client_business_types to update client's pipeline_data_updated_at
DROP TRIGGER IF EXISTS trigger_update_pipeline_data_on_business_type_change ON client_business_types;
CREATE TRIGGER trigger_update_pipeline_data_on_business_type_change
AFTER INSERT OR UPDATE ON client_business_types
FOR EACH ROW
EXECUTE FUNCTION update_client_pipeline_data_timestamp();

-- Create function to update pipeline_data_updated_at when meetings change
CREATE OR REPLACE FUNCTION update_client_pipeline_data_on_meeting_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if transcript or action_points changed (meaningful data for pipeline)
  IF (TG_OP = 'INSERT') OR
     (TG_OP = 'UPDATE' AND (
       NEW.transcript IS DISTINCT FROM OLD.transcript OR
       NEW.action_points IS DISTINCT FROM OLD.action_points OR
       NEW.quick_summary IS DISTINCT FROM OLD.quick_summary
     )) THEN
    UPDATE clients
    SET pipeline_data_updated_at = NOW()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on meetings to update client's pipeline_data_updated_at
DROP TRIGGER IF EXISTS trigger_update_pipeline_data_on_meeting_change ON meetings;
CREATE TRIGGER trigger_update_pipeline_data_on_meeting_change
AFTER INSERT OR UPDATE ON meetings
FOR EACH ROW
EXECUTE FUNCTION update_client_pipeline_data_on_meeting_change();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_data_updated_at
ON clients(pipeline_data_updated_at);

-- Add comments
COMMENT ON COLUMN clients.pipeline_data_updated_at IS 'Timestamp when pipeline-relevant data (business types, meetings, transcripts) was last updated. Used to determine if AI summary needs regeneration.';
