-- ============================================================================
-- PHASE 1: MULTI-TENANT DATABASE MIGRATION - PART 2
-- ============================================================================
-- Run this AFTER PHASE1_MULTI_TENANT_MIGRATION.sql
-- 
-- This part creates:
-- 1. calendar_integrations table (separate from auth)
-- 2. Updated RLS policies for all tables
-- 3. Performance indexes
-- 4. Verification queries
-- ============================================================================

-- ============================================================================
-- STEP 8: CREATE CALENDAR_INTEGRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to advisor (user)
    advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Calendar provider info
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'calendly')),
    provider_account_email TEXT, -- Email of the calendar account
    
    -- OAuth tokens (will be encrypted at application level)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Calendly-specific fields
    calendly_user_uri TEXT,
    calendly_organization_uri TEXT,
    calendly_webhook_id TEXT,
    
    -- Status flags
    is_primary BOOLEAN DEFAULT FALSE, -- Primary calendar for this advisor
    is_active BOOLEAN DEFAULT TRUE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disabled')),
    sync_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(advisor_id, provider, provider_account_email)
);

-- Create indexes for calendar_integrations
CREATE INDEX idx_calendar_integrations_advisor ON calendar_integrations(advisor_id);
CREATE INDEX idx_calendar_integrations_provider ON calendar_integrations(provider);
CREATE INDEX idx_calendar_integrations_active ON calendar_integrations(is_active) WHERE is_active = TRUE;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_integrations_updated_at
    BEFORE UPDATE ON calendar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_integrations_updated_at();

SELECT 'calendar_integrations table created' as status;

-- ============================================================================
-- STEP 9: MIGRATE EXISTING CALENDAR TOKENS
-- ============================================================================

-- Migrate existing calendar tokens from calendartoken table to calendar_integrations
INSERT INTO calendar_integrations (
    advisor_id,
    provider,
    provider_account_email,
    access_token,
    refresh_token,
    token_expires_at,
    is_primary,
    is_active
)
SELECT
    userid as advisor_id,
    COALESCE(provider, 'google') as provider,
    (SELECT email FROM users WHERE id = userid) as provider_account_email,
    accesstoken as access_token,
    refreshtoken as refresh_token,
    expiresat as token_expires_at,
    TRUE as is_primary, -- Existing tokens are primary
    TRUE as is_active
FROM calendartoken
WHERE userid IS NOT NULL
ON CONFLICT (advisor_id, provider, provider_account_email) DO NOTHING;

SELECT 'Existing calendar tokens migrated' as status;

-- ============================================================================
-- STEP 10: ADD CALENDAR_INTEGRATION_ID TO MEETINGS
-- ============================================================================

-- Add column to track which calendar integration a meeting came from
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendar_integration_id UUID REFERENCES calendar_integrations(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_meetings_calendar_integration ON meetings(calendar_integration_id);

-- Update existing meetings to link to calendar integration
UPDATE meetings m
SET calendar_integration_id = (
    SELECT ci.id 
    FROM calendar_integrations ci 
    WHERE ci.advisor_id = m.userid 
    AND ci.provider = COALESCE(m.meeting_source, 'google')
    LIMIT 1
)
WHERE m.calendar_integration_id IS NULL 
AND m.meeting_source IN ('google', 'calendly', 'microsoft');

SELECT 'Meetings linked to calendar integrations' as status;

-- ============================================================================
-- STEP 11: CREATE UPDATED RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables that have advisor_id or userid
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendartoken ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transcript_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_annual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_analysis_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own data" ON users 
    FOR ALL 
    USING (id = auth.uid());

-- Calendar tokens table policies (legacy - will be deprecated)
CREATE POLICY "Calendar tokens for own user" ON calendartoken 
    FOR ALL 
    USING (userid = auth.uid());

-- Meetings table policies
CREATE POLICY "Meetings for own user" ON meetings 
    FOR ALL 
    USING (userid = auth.uid());

-- Clients table policies
CREATE POLICY "Clients for own advisor" ON clients 
    FOR ALL 
    USING (advisor_id = auth.uid());

-- Calendar integrations table policies
CREATE POLICY "Calendar integrations for own advisor" ON calendar_integrations 
    FOR ALL 
    USING (advisor_id = auth.uid());

-- Ask threads table policies
CREATE POLICY "Ask threads for own advisor" ON ask_threads
    FOR ALL
    USING (advisor_id = auth.uid());

-- Client documents table policies
CREATE POLICY "Client documents for own advisor" ON client_documents
    FOR ALL
    USING (advisor_id = auth.uid());

-- Transcript action items table policies
CREATE POLICY "Transcript action items for own advisor" ON transcript_action_items
    FOR ALL
    USING (advisor_id = auth.uid());

-- Pending transcript action items table policies
CREATE POLICY "Pending transcript action items for own advisor" ON pending_transcript_action_items
    FOR ALL
    USING (advisor_id = auth.uid());

-- Client todos table policies
CREATE POLICY "Client todos for own advisor" ON client_todos
    FOR ALL
    USING (advisor_id = auth.uid());

-- Pipeline templates table policies
CREATE POLICY "Pipeline templates for own advisor" ON pipeline_templates
    FOR ALL
    USING (advisor_id = auth.uid());

-- Pipeline activities table policies
CREATE POLICY "Pipeline activities for own advisor" ON pipeline_activities
    FOR ALL
    USING (advisor_id = auth.uid());

-- Client annual reviews table policies
CREATE POLICY "Client annual reviews for own advisor" ON client_annual_reviews
    FOR ALL
    USING (advisor_id = auth.uid());

-- AI document analysis queue table policies
CREATE POLICY "AI document analysis queue for own advisor" ON ai_document_analysis_queue
    FOR ALL
    USING (advisor_id = auth.uid());

-- AI usage logs table policies
CREATE POLICY "AI usage logs for own advisor" ON ai_usage_logs
    FOR ALL
    USING (advisor_id = auth.uid());

-- Calendar watch channels table policies
CREATE POLICY "Calendar watch channels for own user" ON calendar_watch_channels
    FOR ALL
    USING (user_id = auth.uid());

-- Conditional RLS policies for optional tables (only if they exist and don't already have policies)
DO $$
BEGIN
    -- Client business types (if exists and has advisor_id column)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_business_types')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_business_types' AND column_name = 'advisor_id') THEN
        EXECUTE 'ALTER TABLE client_business_types ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Client business types for own advisor" ON client_business_types
            FOR ALL USING (advisor_id = auth.uid())';
    END IF;
END $$;

SELECT 'RLS policies created for all tables' as status;

-- ============================================================================
-- STEP 12: CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed) WHERE onboarding_completed = FALSE;

-- Meetings table indexes
CREATE INDEX IF NOT EXISTS idx_meetings_advisor ON meetings(userid);
CREATE INDEX IF NOT EXISTS idx_meetings_starttime ON meetings(starttime DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(meeting_source);

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_advisor ON clients(advisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);

-- Ask threads table indexes
CREATE INDEX IF NOT EXISTS idx_ask_threads_advisor ON ask_threads(advisor_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_client ON ask_threads(client_id);

-- Client documents table indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_advisor ON client_documents(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);

SELECT 'Performance indexes created' as status;

-- ============================================================================
-- STEP 13: VERIFICATION QUERIES
-- ============================================================================

-- Verify users table structure
SELECT 'Users table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Verify calendar_integrations table
SELECT 'Calendar integrations table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'calendar_integrations' 
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT 'RLS status:' as info;
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'meetings', 'clients', 'calendar_integrations', 'ask_threads', 'client_documents')
ORDER BY tablename;

-- Verify foreign key relationships
SELECT 'Foreign key constraints:' as info;
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'users'
ORDER BY tc.table_name;

-- Count migrated data
SELECT 'Data migration summary:' as info;
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM meetings) as total_meetings,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM calendar_integrations) as total_calendar_integrations;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT '✅ Phase 1 Migration Complete!' as status;
SELECT 'Database is now ready for multi-tenant Supabase Auth' as message;
SELECT 'Next: Run Phase 2 to switch from custom JWT to Supabase Auth' as next_step;

