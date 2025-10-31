-- =====================================================
-- ADD PAYLOAD COLUMN TO RECALL_WEBHOOK_EVENTS TABLE
-- =====================================================
-- This migration adds a payload column to store the full
-- webhook data for debugging and audit purposes

ALTER TABLE recall_webhook_events
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_event_type 
ON recall_webhook_events(event_type);

-- Add comment for documentation
COMMENT ON COLUMN recall_webhook_events.payload IS 'Full webhook payload data for debugging and audit purposes';

