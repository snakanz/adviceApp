-- Enhanced Calendly Data Migration
-- Adds additional columns for enhanced Calendly integration

-- Add enhanced Calendly columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendly_event_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS calendly_event_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS calendly_location_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS calendly_location_details TEXT,
ADD COLUMN IF NOT EXISTS calendly_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS calendly_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on Calendly queries
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_status ON meetings(calendly_event_status) WHERE meeting_source = 'calendly';
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_type ON meetings(calendly_event_type) WHERE meeting_source = 'calendly';
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_location_type ON meetings(calendly_location_type) WHERE meeting_source = 'calendly';

-- Update existing Calendly meetings with default values
UPDATE meetings 
SET 
  calendly_event_status = 'active',
  calendly_location_type = 'unknown'
WHERE meeting_source = 'calendly' 
  AND (calendly_event_status IS NULL OR calendly_location_type IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN meetings.calendly_event_status IS 'Status of the Calendly event (active, canceled, etc.)';
COMMENT ON COLUMN meetings.calendly_event_type IS 'Type of Calendly event/meeting template used';
COMMENT ON COLUMN meetings.calendly_location_type IS 'Type of location (zoom, google_meet, physical, phone, etc.)';
COMMENT ON COLUMN meetings.calendly_location_details IS 'Detailed location information including join URLs';
COMMENT ON COLUMN meetings.calendly_created_at IS 'When the Calendly event was originally created';
COMMENT ON COLUMN meetings.calendly_updated_at IS 'When the Calendly event was last updated';
