-- CRITICAL PIPELINE DATA FIX MIGRATION
-- This migration ensures all required columns exist for pipeline data persistence
-- Run this in Supabase SQL Editor IMMEDIATELY

-- =====================================================
-- PART 1: Add Missing Pipeline Columns to Clients Table
-- =====================================================

-- Add business_amount column (for storing business value)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS business_amount NUMERIC;

-- Add iaf_expected column (Initial Advice Fee Expected)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS iaf_expected NUMERIC;

-- Add regular contribution fields
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS regular_contribution_type TEXT;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS regular_contribution_amount TEXT;

-- Add likely_close_month (for pipeline expected close date)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS likely_close_month TEXT;

-- Add notes column (for pipeline notes)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add pipeline_stage column if it doesn't exist
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;

-- Add business_type column if it doesn't exist
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- =====================================================
-- PART 2: Update Constraints for Pipeline Stages
-- =====================================================

-- Drop existing constraint if it exists
ALTER TABLE clients 
DROP CONSTRAINT IF EXISTS clients_pipeline_stage_check;

-- Add updated constraint with all valid pipeline stages
ALTER TABLE clients 
ADD CONSTRAINT clients_pipeline_stage_check 
CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
    -- New pipeline stages (user-friendly names)
    'Client Signed',
    'Waiting to Sign',
    'Waiting on Paraplanning',
    'Have Not Written Advice',
    'Need to Book Meeting',
    'Can''t Contact Client',
    -- Legacy pipeline stages (for backward compatibility)
    'client_signed',
    'waiting_to_sign', 
    'waiting_on_paraplanning',
    'have_not_written_advice',
    'need_to_book_meeting',
    'cant_contact_client',
    'unscheduled', 
    'prospecting', 
    'qualified', 
    'proposal', 
    'negotiation', 
    'closed_won', 
    'closed_lost'
));

-- =====================================================
-- PART 3: Update Constraints for Business Types
-- =====================================================

-- Drop existing constraint if it exists
ALTER TABLE clients 
DROP CONSTRAINT IF EXISTS clients_business_type_check;

-- Add updated constraint with all valid business types
ALTER TABLE clients 
ADD CONSTRAINT clients_business_type_check 
CHECK (business_type IS NULL OR business_type IN (
    'pension',
    'isa', 
    'bond',
    'investment',
    'insurance',
    'mortgage',
    -- Capitalized versions for backward compatibility
    'Pension',
    'ISA',
    'Bond',
    'Investment',
    'Insurance',
    'Mortgage'
));

-- =====================================================
-- PART 4: Create Performance Indexes
-- =====================================================

-- Index for business_amount (for sorting/filtering by value)
CREATE INDEX IF NOT EXISTS idx_clients_business_amount ON clients(business_amount);

-- Index for iaf_expected (for sorting/filtering by expected fee)
CREATE INDEX IF NOT EXISTS idx_clients_iaf_expected ON clients(iaf_expected);

-- Index for business_type (for filtering by type)
CREATE INDEX IF NOT EXISTS idx_clients_business_type ON clients(business_type);

-- Index for pipeline_stage (for filtering by stage)
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);

-- Index for likely_close_month (for filtering by expected close date)
CREATE INDEX IF NOT EXISTS idx_clients_likely_close_month ON clients(likely_close_month);

-- =====================================================
-- PART 5: Add Column Comments for Documentation
-- =====================================================

COMMENT ON COLUMN clients.business_amount IS 'The monetary value for the business opportunity';
COMMENT ON COLUMN clients.iaf_expected IS 'Initial Advice Fee Expected (target fee amount)';
COMMENT ON COLUMN clients.regular_contribution_type IS 'Type of regular contribution (e.g., "Pension Regular Monthly")';
COMMENT ON COLUMN clients.regular_contribution_amount IS 'Amount of regular contribution (e.g., "£3,000 per month")';
COMMENT ON COLUMN clients.likely_close_month IS 'Expected month when business will close (YYYY-MM format)';
COMMENT ON COLUMN clients.notes IS 'General notes about the client or pipeline opportunity';
COMMENT ON COLUMN clients.pipeline_stage IS 'Current stage in the sales/advice pipeline';
COMMENT ON COLUMN clients.business_type IS 'Type of business/product (pension, ISA, bond, etc.)';

-- =====================================================
-- PART 6: Ensure pipeline_activities Table Exists
-- =====================================================

-- Create pipeline_activities table if it doesn't exist
CREATE TABLE IF NOT EXISTS pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'stage_change', 'todo_completed')),
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pipeline_activities
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_client ON pipeline_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_advisor ON pipeline_activities(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_date ON pipeline_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_type ON pipeline_activities(activity_type);

-- =====================================================
-- PART 7: Verification Queries
-- =====================================================

-- Verify all columns were added
SELECT 
    'Pipeline columns verification' as info,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN (
    'business_amount', 
    'iaf_expected', 
    'regular_contribution_type', 
    'regular_contribution_amount',
    'likely_close_month',
    'notes',
    'pipeline_stage',
    'business_type'
)
ORDER BY column_name;

-- Verify constraints
SELECT 
    'Pipeline constraints verification' as info,
    constraint_name, 
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name IN ('clients_pipeline_stage_check', 'clients_business_type_check');

-- Verify indexes
SELECT 
    'Pipeline indexes verification' as info,
    indexname
FROM pg_indexes
WHERE tablename = 'clients'
AND indexname LIKE '%pipeline%' OR indexname LIKE '%business%' OR indexname LIKE '%iaf%'
ORDER BY indexname;

-- Count existing pipeline data
SELECT 
    'Existing pipeline data count' as info,
    COUNT(*) as total_clients,
    COUNT(pipeline_stage) as clients_with_stage,
    COUNT(business_type) as clients_with_business_type,
    COUNT(iaf_expected) as clients_with_iaf,
    COUNT(business_amount) as clients_with_amount
FROM clients;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT '✅ Pipeline data fix migration completed successfully!' as status;
SELECT 'All required columns, constraints, and indexes have been created.' as message;
SELECT 'You can now add pipeline entries to clients and the data will persist correctly.' as next_step;

