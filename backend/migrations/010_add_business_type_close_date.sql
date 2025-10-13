-- Add expected close date to business types
-- This allows each business type to have its own expected close date

-- Add expected_close_date column to client_business_types table
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Add index for performance when querying by close date
CREATE INDEX IF NOT EXISTS idx_client_business_types_expected_close_date 
ON client_business_types(expected_close_date);

-- Add comment for documentation
COMMENT ON COLUMN client_business_types.expected_close_date IS 'Expected date when this business type will close/complete';

-- Update the view to include expected close dates
CREATE OR REPLACE VIEW client_business_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.pipeline_stage,
    c.likely_close_month,
    COUNT(cbt.id) as business_type_count,
    ARRAY_AGG(
        DISTINCT cbt.business_type 
        ORDER BY cbt.business_type
    ) as business_types,
    SUM(cbt.business_amount) as total_business_amount,
    SUM(cbt.iaf_expected) as total_iaf_expected,
    STRING_AGG(
        DISTINCT cbt.contribution_method, 
        ', ' 
        ORDER BY cbt.contribution_method
    ) as contribution_methods,
    MIN(cbt.expected_close_date) as earliest_close_date,
    MAX(cbt.expected_close_date) as latest_close_date
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;

-- Verification query
SELECT 
    'client_business_types table' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_business_types' 
AND column_name = 'expected_close_date';

