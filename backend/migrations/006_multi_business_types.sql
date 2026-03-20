-- Multi-Business Types Migration
-- This migration creates a new table to support multiple business types per client
-- with contribution methods (Transfer, Regular Monthly, Lump Sum)

-- Create client_business_types table for multiple business types per client
CREATE TABLE IF NOT EXISTS client_business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL CHECK (business_type IN (
        'Pension',
        'ISA', 
        'Bond',
        'Investment',
        'Insurance',
        'Mortgage'
    )),
    business_amount NUMERIC,
    contribution_method TEXT CHECK (contribution_method IN (
        'Transfer',
        'Regular Monthly Contribution',
        'Lump Sum'
    )),
    regular_contribution_amount TEXT, -- e.g., "£3,000 per month"
    iaf_expected NUMERIC, -- Initial Advice Fee Expected for this business type
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_business_types_client_id ON client_business_types(client_id);
CREATE INDEX IF NOT EXISTS idx_client_business_types_business_type ON client_business_types(business_type);
CREATE INDEX IF NOT EXISTS idx_client_business_types_contribution_method ON client_business_types(contribution_method);

-- Add comments for documentation
COMMENT ON TABLE client_business_types IS 'Multiple business types per client with contribution methods';
COMMENT ON COLUMN client_business_types.business_type IS 'Type of business (Pension, ISA, Bond, Investment, Insurance, Mortgage)';
COMMENT ON COLUMN client_business_types.business_amount IS 'The monetary value for this business type';
COMMENT ON COLUMN client_business_types.contribution_method IS 'How the client will contribute (Transfer, Regular Monthly, Lump Sum)';
COMMENT ON COLUMN client_business_types.regular_contribution_amount IS 'Amount for regular contributions (e.g., "£3,000 per month")';
COMMENT ON COLUMN client_business_types.iaf_expected IS 'Initial Advice Fee Expected for this specific business type';

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_business_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_client_business_types_updated_at
    BEFORE UPDATE ON client_business_types
    FOR EACH ROW
    EXECUTE FUNCTION update_client_business_types_updated_at();

-- Migrate existing business type data from clients table to new table
-- This will create one business type entry for each existing client that has business type data
INSERT INTO client_business_types (
    client_id,
    business_type,
    business_amount,
    contribution_method,
    regular_contribution_amount,
    iaf_expected
)
SELECT 
    id as client_id,
    CASE 
        WHEN business_type = 'pension' THEN 'Pension'
        WHEN business_type = 'isa' THEN 'ISA'
        WHEN business_type = 'bond' THEN 'Bond'
        WHEN business_type = 'investment' THEN 'Investment'
        WHEN business_type = 'insurance' THEN 'Insurance'
        WHEN business_type = 'mortgage' THEN 'Mortgage'
        ELSE business_type
    END as business_type,
    business_amount,
    CASE 
        WHEN regular_contribution_type IS NOT NULL AND regular_contribution_type != '' 
        THEN 'Regular Monthly Contribution'
        ELSE NULL
    END as contribution_method,
    regular_contribution_amount,
    iaf_expected
FROM clients 
WHERE business_type IS NOT NULL 
AND business_type != '';

-- Add a view to easily get client business type summaries
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
    ) as contribution_methods
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;

-- Add comment for the view
COMMENT ON VIEW client_business_summary IS 'Summary view of clients with their business types aggregated';
