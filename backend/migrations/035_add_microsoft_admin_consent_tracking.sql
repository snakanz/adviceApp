-- Add Microsoft admin consent tracking to calendar_connections table
-- This migration adds columns to track when users from enterprise organizations
-- need IT administrator approval before connecting their Microsoft calendar.

-- Add admin consent tracking columns
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS pending_admin_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_consent_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_consent_error TEXT,
ADD COLUMN IF NOT EXISTS admin_consent_error_type TEXT,
ADD COLUMN IF NOT EXISTS microsoft_tenant_id TEXT;

-- Add index for finding users with pending admin consent
CREATE INDEX IF NOT EXISTS idx_calendar_connections_pending_admin_consent
ON calendar_connections(user_id, pending_admin_consent)
WHERE pending_admin_consent = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN calendar_connections.pending_admin_consent IS 'True when user needs IT admin approval for Microsoft 365';
COMMENT ON COLUMN calendar_connections.admin_consent_requested_at IS 'When the admin consent was first requested';
COMMENT ON COLUMN calendar_connections.admin_consent_error IS 'Human-readable error message from Microsoft OAuth';
COMMENT ON COLUMN calendar_connections.admin_consent_error_type IS 'AADSTS error type (e.g., admin_consent_required, org_policy_blocked)';
COMMENT ON COLUMN calendar_connections.microsoft_tenant_id IS 'Azure AD tenant ID for organization-specific consent URL';
