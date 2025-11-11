-- Create table for Calendly webhook event deduplication
CREATE TABLE IF NOT EXISTS calendly_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_event_id ON calendly_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_created_at ON calendly_webhook_events(created_at);

-- Add comment
COMMENT ON TABLE calendly_webhook_events IS 'Stores processed Calendly webhook events for deduplication';

