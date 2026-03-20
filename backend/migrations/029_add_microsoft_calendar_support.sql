-- Add Microsoft Calendar support to calendar_connections table
-- This migration adds columns needed for Microsoft Graph API webhook subscriptions

-- Add Microsoft-specific columns
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS microsoft_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS microsoft_subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS microsoft_client_state TEXT;

-- Add index for faster Microsoft subscription lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_microsoft_subscription 
ON calendar_connections(microsoft_subscription_id) 
WHERE microsoft_subscription_id IS NOT NULL;

-- Update the provider check constraint to include 'microsoft'
ALTER TABLE calendar_connections 
DROP CONSTRAINT IF EXISTS calendar_connections_provider_check;

ALTER TABLE calendar_connections 
ADD CONSTRAINT calendar_connections_provider_check 
CHECK (provider IN ('google', 'microsoft', 'outlook', 'calendly'));

-- Add comments for documentation
COMMENT ON COLUMN calendar_connections.microsoft_subscription_id IS 'Microsoft Graph API subscription ID for webhook notifications';
COMMENT ON COLUMN calendar_connections.microsoft_subscription_expires_at IS 'Expiration time for Microsoft Graph webhook subscription (max 3 days)';
COMMENT ON COLUMN calendar_connections.microsoft_client_state IS 'Client state token for validating Microsoft webhook notifications';

