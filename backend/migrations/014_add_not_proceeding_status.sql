-- Add Not Proceeding Status to Business Types
-- This migration adds fields to track business opportunities that are not proceeding
-- (e.g., client decided not to go ahead, deal fell through, went with another advisor)

-- Add not_proceeding boolean column
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding BOOLEAN DEFAULT FALSE;

-- Add not_proceeding_reason text column to capture why it's not proceeding
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding_reason TEXT;

-- Add not_proceeding_date to track when it was marked as not proceeding
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS not_proceeding_date TIMESTAMP WITH TIME ZONE;

-- Add index for performance when filtering not proceeding items
CREATE INDEX IF NOT EXISTS idx_client_business_types_not_proceeding 
ON client_business_types(not_proceeding);

-- Add comments for documentation
COMMENT ON COLUMN client_business_types.not_proceeding IS 'Whether this business opportunity is not proceeding (client decided not to go ahead, deal fell through, etc.)';
COMMENT ON COLUMN client_business_types.not_proceeding_reason IS 'Optional reason why this business opportunity is not proceeding';
COMMENT ON COLUMN client_business_types.not_proceeding_date IS 'Date when this business opportunity was marked as not proceeding';

-- Update the client_business_summary view to exclude not proceeding items by default
-- and add counts for not proceeding items
CREATE OR REPLACE VIEW client_business_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.pipeline_stage,
    c.likely_close_month,
    COUNT(cbt.id) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as business_type_count,
    COUNT(cbt.id) FILTER (WHERE cbt.not_proceeding = TRUE) as not_proceeding_count,
    ARRAY_AGG(
        DISTINCT cbt.business_type 
        ORDER BY cbt.business_type
    ) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as business_types,
    SUM(cbt.business_amount) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as total_business_amount,
    SUM(cbt.iaf_expected) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as total_iaf_expected,
    STRING_AGG(
        DISTINCT cbt.contribution_method, 
        ', ' 
        ORDER BY cbt.contribution_method
    ) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as contribution_methods,
    MIN(cbt.expected_close_date) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as earliest_close_date,
    MAX(cbt.expected_close_date) FILTER (WHERE cbt.not_proceeding = FALSE OR cbt.not_proceeding IS NULL) as latest_close_date
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;

-- Add comment to view
COMMENT ON VIEW client_business_summary IS 'Summary of client business types excluding not proceeding items by default. Includes not_proceeding_count for reference.';

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

