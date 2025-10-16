-- Add Not Proceeding Status to Business Types
-- This migration adds fields to track business opportunities that are not proceeding
-- (e.g., client decided not to go ahead, deal fell through, went with another advisor)

-- Add not_proceeding boolean column (if it doesn't exist)
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding BOOLEAN DEFAULT FALSE;

-- Add not_proceeding_reason text column to capture why it's not proceeding
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding_reason TEXT;

-- Add not_proceeding_date to track when it was marked as not proceeding
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding_date TIMESTAMP WITH TIME ZONE;

-- Add index for performance when filtering by not_proceeding status
CREATE INDEX IF NOT EXISTS idx_client_business_types_not_proceeding 
ON client_business_types(not_proceeding);

-- Add comments for documentation
COMMENT ON COLUMN client_business_types.not_proceeding IS 'Boolean flag indicating if this business opportunity is not proceeding';
COMMENT ON COLUMN client_business_types.not_proceeding_reason IS 'Reason why this business opportunity is not proceeding (e.g., client decided not to go ahead, went with another advisor)';
COMMENT ON COLUMN client_business_types.not_proceeding_date IS 'Timestamp when this business opportunity was marked as not proceeding';

-- Verification query
SELECT 
    'client_business_types table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_business_types' 
AND column_name IN ('not_proceeding', 'not_proceeding_reason', 'not_proceeding_date')
ORDER BY column_name;

