-- ============================================================================
-- ADVICLY MULTI-TENANT MIGRATION - CUSTOM FOR YOUR DATABASE
-- ============================================================================
-- This migration is tailored to your exact database structure
-- Based on the tables and columns that actually exist
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_meetings AS SELECT * FROM meetings;
CREATE TABLE IF NOT EXISTS _backup_clients AS SELECT * FROM clients;

SELECT 'Backup tables created' as status;

-- ============================================================================
-- STEP 2: DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_userid_fkey CASCADE;
ALTER TABLE calendartoken DROP CONSTRAINT IF EXISTS calendartoken_userid_fkey CASCADE;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_advisor_id_fkey CASCADE;
ALTER TABLE ask_threads DROP CONSTRAINT IF EXISTS ask_threads_advisor_id_fkey CASCADE;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_advisor_id_fkey CASCADE;
ALTER TABLE transcript_action_items DROP CONSTRAINT IF EXISTS transcript_action_items_advisor_id_fkey CASCADE;
ALTER TABLE pending_transcript_action_items DROP CONSTRAINT IF EXISTS pending_transcript_action_items_advisor_id_fkey CASCADE;
ALTER TABLE client_todos DROP CONSTRAINT IF EXISTS client_todos_advisor_id_fkey CASCADE;
ALTER TABLE pipeline_templates DROP CONSTRAINT IF EXISTS pipeline_templates_advisor_id_fkey CASCADE;
ALTER TABLE pipeline_activities DROP CONSTRAINT IF EXISTS pipeline_activities_advisor_id_fkey CASCADE;
ALTER TABLE client_annual_reviews DROP CONSTRAINT IF EXISTS client_annual_reviews_advisor_id_fkey CASCADE;
ALTER TABLE ai_document_analysis_queue DROP CONSTRAINT IF EXISTS ai_document_analysis_queue_advisor_id_fkey CASCADE;
ALTER TABLE ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_advisor_id_fkey CASCADE;
ALTER TABLE calendar_watch_channels DROP CONSTRAINT IF EXISTS calendar_watch_channels_user_id_fkey CASCADE;

SELECT 'Foreign key constraints dropped' as status;

-- ============================================================================
-- STEP 3: DROP EXISTING RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Calendar tokens for own user" ON calendartoken;
DROP POLICY IF EXISTS "Meetings for own user" ON meetings;
DROP POLICY IF EXISTS "Clients for own advisor" ON clients;
DROP POLICY IF EXISTS "ask_threads_advisor_policy" ON ask_threads;
DROP POLICY IF EXISTS "client_documents_advisor_policy" ON client_documents;
DROP POLICY IF EXISTS "transcript_action_items_advisor_policy" ON transcript_action_items;

SELECT 'RLS policies dropped' as status;

-- ============================================================================
-- STEP 4: CREATE NEW USERS TABLE WITH UUID
-- ============================================================================

ALTER TABLE users RENAME TO _old_users;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT,
    providerid TEXT,
    profilepicture TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    business_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, providerid);

SELECT 'New users table created with UUID' as status;

-- ============================================================================
-- STEP 5: MIGRATE EXISTING USER DATA
-- ============================================================================

DO $$
DECLARE
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID;
BEGIN
    INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
    SELECT 
        new_user_uuid,
        email,
        COALESCE(name, email),
        'google',
        COALESCE(id::TEXT, '1'),
        profilepicture,
        TRUE,
        COALESCE(created_at, NOW()),
        COALESCE(updated_at, NOW())
    FROM _old_users 
    WHERE id = 1
    LIMIT 1;
    
    RAISE NOTICE 'Migrated user to UUID: %', new_user_uuid;
END $$;

SELECT 'User data migrated' as status;

-- ============================================================================
-- STEP 6: ADD UUID COLUMNS TO ALL TABLES
-- ============================================================================

ALTER TABLE meetings ADD COLUMN userid_uuid UUID;
ALTER TABLE calendartoken ADD COLUMN userid_uuid UUID;
ALTER TABLE clients ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE ask_threads ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE client_documents ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE transcript_action_items ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE pending_transcript_action_items ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE client_todos ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE pipeline_templates ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE pipeline_activities ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE client_annual_reviews ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE ai_document_analysis_queue ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE ai_usage_logs ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE calendar_watch_channels ADD COLUMN user_id_uuid UUID;

SELECT 'UUID columns added' as status;

-- ============================================================================
-- STEP 7: MIGRATE FOREIGN KEY DATA
-- ============================================================================

DO $$
DECLARE
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID;
BEGIN
    UPDATE meetings SET userid_uuid = new_user_uuid WHERE userid = 1;
    UPDATE calendartoken SET userid_uuid = new_user_uuid WHERE userid = 1;
    UPDATE clients SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE ask_threads SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE client_documents SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE transcript_action_items SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE pending_transcript_action_items SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE client_todos SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE pipeline_templates SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE pipeline_activities SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE client_annual_reviews SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE ai_document_analysis_queue SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE ai_usage_logs SET advisor_id_uuid = new_user_uuid WHERE advisor_id = 1;
    UPDATE calendar_watch_channels SET user_id_uuid = new_user_uuid WHERE user_id = 1;
    
    RAISE NOTICE 'All foreign key data migrated to UUID';
END $$;

SELECT 'Foreign key data migrated' as status;

-- ============================================================================
-- STEP 8: SWAP OLD AND NEW COLUMNS
-- ============================================================================

ALTER TABLE meetings DROP COLUMN userid CASCADE;
ALTER TABLE meetings RENAME COLUMN userid_uuid TO userid;

ALTER TABLE calendartoken DROP COLUMN userid CASCADE;
ALTER TABLE calendartoken RENAME COLUMN userid_uuid TO userid;

ALTER TABLE clients DROP COLUMN advisor_id CASCADE;
ALTER TABLE clients RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE ask_threads DROP COLUMN advisor_id CASCADE;
ALTER TABLE ask_threads RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE client_documents DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_documents RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE transcript_action_items DROP COLUMN advisor_id CASCADE;
ALTER TABLE transcript_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE pending_transcript_action_items DROP COLUMN advisor_id CASCADE;
ALTER TABLE pending_transcript_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE client_todos DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_todos RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE pipeline_templates DROP COLUMN advisor_id CASCADE;
ALTER TABLE pipeline_templates RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE pipeline_activities DROP COLUMN advisor_id CASCADE;
ALTER TABLE pipeline_activities RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE client_annual_reviews DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_annual_reviews RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE ai_document_analysis_queue DROP COLUMN advisor_id CASCADE;
ALTER TABLE ai_document_analysis_queue RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE ai_usage_logs DROP COLUMN advisor_id CASCADE;
ALTER TABLE ai_usage_logs RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE calendar_watch_channels DROP COLUMN user_id CASCADE;
ALTER TABLE calendar_watch_channels RENAME COLUMN user_id_uuid TO user_id;

SELECT 'Old columns dropped, new columns renamed' as status;

-- ============================================================================
-- STEP 9: RECREATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE meetings ADD CONSTRAINT meetings_userid_fkey FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE calendartoken ADD CONSTRAINT calendartoken_userid_fkey FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE clients ADD CONSTRAINT clients_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ask_threads ADD CONSTRAINT ask_threads_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE client_documents ADD CONSTRAINT client_documents_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transcript_action_items ADD CONSTRAINT transcript_action_items_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pending_transcript_action_items ADD CONSTRAINT pending_transcript_action_items_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE client_todos ADD CONSTRAINT client_todos_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pipeline_templates ADD CONSTRAINT pipeline_templates_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pipeline_activities ADD CONSTRAINT pipeline_activities_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE client_annual_reviews ADD CONSTRAINT client_annual_reviews_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ai_document_analysis_queue ADD CONSTRAINT ai_document_analysis_queue_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ai_usage_logs ADD CONSTRAINT ai_usage_logs_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE calendar_watch_channels ADD CONSTRAINT calendar_watch_channels_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

SELECT 'Foreign key constraints recreated' as status;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '✅ Migration Part 1 Complete!' as status;
SELECT 'Next: Run PHASE1_MULTI_TENANT_MIGRATION_PART2.sql' as next_step;

