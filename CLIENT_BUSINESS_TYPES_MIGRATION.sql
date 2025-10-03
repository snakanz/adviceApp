-- =====================================================
-- CLIENT BUSINESS TYPES TABLE MIGRATION
-- =====================================================
-- This migration adds the missing client_business_types table
-- that is required for the business types functionality in the
-- Advicly platform.
--
-- Run this in your Supabase SQL Editor after running the
-- FIXED_PIPELINE_MIGRATION.sql
-- =====================================================

-- Create client_business_types table for managing multiple business types per client
CREATE TABLE IF NOT EXISTS client_business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL CHECK (business_type IN (
        'Pension',
        'ISA',
        'Bond',
        'Investment',
        'Insurance',
        'Mortgage',
        'GIA',
        'Protection',
        'Estate Planning',
        'Tax Planning'
    )),
    business_amount DECIMAL(15, 2), -- Total business amount for this type
    contribution_method TEXT CHECK (contribution_method IN (
        'Lump Sum',
        'Regular Monthly Contribution',
        'Both'
    )),
    regular_contribution_amount DECIMAL(15, 2), -- Monthly contribution amount if applicable
    iaf_expected DECIMAL(15, 2), -- Expected IAF (Initial Advice Fee) for this business type
    notes TEXT, -- Additional notes specific to this business type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_business_types_client_id 
    ON client_business_types(client_id);

CREATE INDEX IF NOT EXISTS idx_client_business_types_business_type 
    ON client_business_types(business_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_business_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_business_types_updated_at
    BEFORE UPDATE ON client_business_types
    FOR EACH ROW
    EXECUTE FUNCTION update_client_business_types_updated_at();

-- Add comment to table
COMMENT ON TABLE client_business_types IS 'Stores multiple business types per client with associated financial details';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify the table was created successfully:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'client_business_types'
-- ORDER BY ordinal_position;

