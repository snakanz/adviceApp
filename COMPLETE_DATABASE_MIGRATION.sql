-- =====================================================
-- COMPLETE DATABASE MIGRATION FOR ADVICLY PLATFORM
-- =====================================================
-- This migration includes:
-- 1. Pipeline data persistence fix (missing columns)
-- 2. Multi-business types table creation
-- 3. All necessary indexes and constraints
-- 
-- Run this ONCE in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Add Missing Pipeline Columns to Clients Table
-- =====================================================

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS business_amount NUMERIC,
ADD COLUMN IF NOT EXISTS iaf_expected NUMERIC,
ADD COLUMN IF NOT EXISTS regular_contribution_type TEXT,
ADD COLUMN IF NOT EXISTS regular_contribution_amount TEXT,
ADD COLUMN IF NOT EXISTS likely_close_month TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- =====================================================
-- PART 2: Update Constraints for Pipeline Stages
-- =====================================================

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_pipeline_stage_check;
ALTER TABLE clients ADD CONSTRAINT clients_pipeline_stage_check 
CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
    'Client Signed', 'Waiting to Sign', 'Waiting on Paraplanning',
    'Have Not Written Advice', 'Need to Book Meeting', 'Can''t Contact Client',
    'client_signed', 'waiting_to_sign', 'waiting_on_paraplanning',
    'have_not_written_advice', 'need_to_book_meeting', 'cant_contact_client',
    'unscheduled', 'prospecting', 'qualified', 'proposal', 
    'negotiation', 'closed_won', 'closed_lost'
));

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_business_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_business_type_check 
CHECK (business_type IS NULL OR business_type IN (
    'pension', 'isa', 'bond', 'investment', 'insurance', 'mortgage',
    'Pension', 'ISA', 'Bond', 'Investment', 'Insurance', 'Mortgage'
));

-- =====================================================
-- PART 3: Create Indexes for Clients Table
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_business_amount ON clients(business_amount);
CREATE INDEX IF NOT EXISTS idx_clients_iaf_expected ON clients(iaf_expected);
CREATE INDEX IF NOT EXISTS idx_clients_business_type ON clients(business_type);
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_clients_likely_close_month ON clients(likely_close_month);

-- =====================================================
-- PART 4: Create client_business_types Table
-- =====================================================

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
    regular_contribution_amount TEXT,
    iaf_expected NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 5: Create Indexes for client_business_types
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_business_types_client_id ON client_business_types(client_id);
CREATE INDEX IF NOT EXISTS idx_client_business_types_business_type ON client_business_types(business_type);
CREATE INDEX IF NOT EXISTS idx_client_business_types_contribution_method ON client_business_types(contribution_method);

-- =====================================================
-- PART 6: Create pipeline_activities Table
-- =====================================================

CREATE TABLE IF NOT EXISTS pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'call', 'email', 'meeting', 'note', 'stage_change', 'todo_completed'
    )),
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_client ON pipeline_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_advisor ON pipeline_activities(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_date ON pipeline_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_type ON pipeline_activities(activity_type);

-- =====================================================
-- PART 7: Create Triggers and Functions
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_business_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for client_business_types
DROP TRIGGER IF EXISTS trigger_update_client_business_types_updated_at ON client_business_types;
CREATE TRIGGER trigger_update_client_business_types_updated_at
    BEFORE UPDATE ON client_business_types
    FOR EACH ROW
    EXECUTE FUNCTION update_client_business_types_updated_at();

-- =====================================================
-- PART 8: Create Helpful Views
-- =====================================================

-- View for client business summary
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
    ) FILTER (WHERE cbt.business_type IS NOT NULL) as business_types,
    SUM(cbt.business_amount) as total_business_amount,
    SUM(cbt.iaf_expected) as total_iaf_expected,
    STRING_AGG(
        DISTINCT cbt.contribution_method, 
        ', ' 
        ORDER BY cbt.contribution_method
    ) FILTER (WHERE cbt.contribution_method IS NOT NULL) as contribution_methods
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email, c.pipeline_stage, c.likely_close_month;

-- =====================================================
-- PART 9: Add Column Comments
-- =====================================================

COMMENT ON COLUMN clients.business_amount IS 'The monetary value for the business opportunity';
COMMENT ON COLUMN clients.iaf_expected IS 'Initial Advice Fee Expected (target fee amount)';
COMMENT ON COLUMN clients.regular_contribution_type IS 'Type of regular contribution';
COMMENT ON COLUMN clients.regular_contribution_amount IS 'Amount of regular contribution';
COMMENT ON COLUMN clients.likely_close_month IS 'Expected month when business will close (YYYY-MM format)';
COMMENT ON COLUMN clients.notes IS 'General notes about the client or pipeline opportunity';
COMMENT ON COLUMN clients.pipeline_stage IS 'Current stage in the sales/advice pipeline';
COMMENT ON COLUMN clients.business_type IS 'Type of business/product (pension, ISA, bond, etc.)';

COMMENT ON TABLE client_business_types IS 'Multiple business types per client with contribution methods';
COMMENT ON COLUMN client_business_types.business_type IS 'Type of business (Pension, ISA, Bond, Investment, Insurance, Mortgage)';
COMMENT ON COLUMN client_business_types.business_amount IS 'The monetary value for this business type';
COMMENT ON COLUMN client_business_types.contribution_method IS 'How the client will contribute (Transfer, Regular Monthly, Lump Sum)';
COMMENT ON COLUMN client_business_types.regular_contribution_amount IS 'Amount for regular contributions';
COMMENT ON COLUMN client_business_types.iaf_expected IS 'Initial Advice Fee Expected for this specific business type';

COMMENT ON VIEW client_business_summary IS 'Summary view of clients with their business types aggregated';

-- =====================================================
-- PART 10: Verification Queries
-- =====================================================

-- Verify clients table columns
SELECT 
    'Clients table columns' as info,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN (
    'business_amount', 'iaf_expected', 'regular_contribution_type', 
    'regular_contribution_amount', 'likely_close_month', 'notes',
    'pipeline_stage', 'business_type'
)
ORDER BY column_name;

-- Verify client_business_types table exists
SELECT 
    'client_business_types table' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'client_business_types'
ORDER BY ordinal_position;

-- Verify pipeline_activities table exists
SELECT 
    'pipeline_activities table' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pipeline_activities'
ORDER BY ordinal_position;

-- Verify indexes
SELECT 
    'Database indexes' as info,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('clients', 'client_business_types', 'pipeline_activities')
ORDER BY tablename, indexname;

-- Count existing data
SELECT 
    'Data counts' as info,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM clients WHERE pipeline_stage IS NOT NULL) as clients_with_pipeline,
    (SELECT COUNT(*) FROM client_business_types) as business_type_entries,
    (SELECT COUNT(*) FROM pipeline_activities) as pipeline_activities;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT '✅ Complete database migration finished successfully!' as status;
SELECT 'All tables, columns, indexes, and constraints have been created.' as message;
SELECT 'You can now use pipeline entries and multi-business types features.' as next_step;

