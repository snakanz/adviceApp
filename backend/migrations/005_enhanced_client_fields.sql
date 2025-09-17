-- Enhanced Client Fields Migration
-- This migration adds new business fields and updates pipeline stages

-- Add new client business fields
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS business_amount NUMERIC,
ADD COLUMN IF NOT EXISTS regular_contribution_type TEXT,
ADD COLUMN IF NOT EXISTS regular_contribution_amount TEXT;

-- Rename likely_value to iaf_expected for clarity
-- First add the new column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS iaf_expected NUMERIC;

-- Copy data from old column to new column
UPDATE clients 
SET iaf_expected = likely_value 
WHERE likely_value IS NOT NULL;

-- Drop the old column (commented out for safety - uncomment after verification)
-- ALTER TABLE clients DROP COLUMN IF EXISTS likely_value;

-- Update pipeline stage constraints with new values
ALTER TABLE clients 
DROP CONSTRAINT IF EXISTS clients_pipeline_stage_check;

ALTER TABLE clients 
ADD CONSTRAINT clients_pipeline_stage_check 
CHECK (pipeline_stage IN (
    'client_signed',
    'waiting_to_sign', 
    'waiting_on_paraplanning',
    'have_not_written_advice',
    'need_to_book_meeting',
    'cant_contact_client',
    -- Keep legacy values for backward compatibility during transition
    'unscheduled', 
    'prospecting', 
    'qualified', 
    'proposal', 
    'negotiation', 
    'closed_won', 
    'closed_lost'
));

-- Update business_type constraint with new values
ALTER TABLE clients 
DROP CONSTRAINT IF EXISTS clients_business_type_check;

ALTER TABLE clients 
ADD CONSTRAINT clients_business_type_check 
CHECK (business_type IN (
    'pension',
    'isa', 
    'bond',
    'investment',
    'insurance',
    'mortgage'
));

-- Create indexes for performance on new fields
CREATE INDEX IF NOT EXISTS idx_clients_business_amount ON clients(business_amount);
CREATE INDEX IF NOT EXISTS idx_clients_iaf_expected ON clients(iaf_expected);
CREATE INDEX IF NOT EXISTS idx_clients_business_type ON clients(business_type);

-- Add comments for documentation
COMMENT ON COLUMN clients.business_amount IS 'The monetary value for the business type';
COMMENT ON COLUMN clients.regular_contribution_type IS 'Type of regular contribution (e.g., "Pension Regular Monthly")';
COMMENT ON COLUMN clients.regular_contribution_amount IS 'Amount of regular contribution (e.g., "£3,000 per month")';
COMMENT ON COLUMN clients.iaf_expected IS 'Initial Advice Fee Expected (renamed from likely_value)';

-- Display current schema for verification
SELECT 
    'clients table enhanced fields' as info,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('business_amount', 'regular_contribution_type', 'regular_contribution_amount', 'iaf_expected', 'likely_value')
ORDER BY column_name;
