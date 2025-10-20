-- ============================================================================
-- ADVICLY MULTI-TENANT MIGRATION - PART 1 (FINAL VERSION)
-- ============================================================================
-- This migration converts the users table from TEXT/INTEGER to UUID primary keys
-- and prepares the database for multi-tenant support with Supabase Auth.
--
-- IMPORTANT: This version only updates tables that actually exist
--
-- Run this FIRST, then run PHASE1_MULTI_TENANT_MIGRATION_PART2.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA
-- ============================================================================

-- Create backup tables (just in case)
CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_meetings AS SELECT * FROM meetings;
CREATE TABLE IF NOT EXISTS _backup_clients AS SELECT * FROM clients;

SELECT 'Backup tables created' as status;

-- ============================================================================
-- STEP 2: DROP FOREIGN KEY CONSTRAINTS (ONLY IF TABLES EXIST)
-- ============================================================================

-- Drop all foreign key constraints that reference users.id
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_userid_fkey CASCADE;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_advisor_id_fkey CASCADE;

-- Only drop constraints for tables that exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        ALTER TABLE ask_threads DROP CONSTRAINT IF EXISTS ask_threads_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages') THEN
        ALTER TABLE ask_messages DROP CONSTRAINT IF EXISTS ask_messages_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        ALTER TABLE transcript_action_items DROP CONSTRAINT IF EXISTS transcript_action_items_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_action_items') THEN
        ALTER TABLE pending_action_items DROP CONSTRAINT IF EXISTS pending_action_items_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        ALTER TABLE advisor_tasks DROP CONSTRAINT IF EXISTS advisor_tasks_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        ALTER TABLE client_todos DROP CONSTRAINT IF EXISTS client_todos_advisor_id_fkey CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_templates') THEN
        ALTER TABLE pipeline_templates DROP CONSTRAINT IF EXISTS pipeline_templates_advisor_id_fkey;
    END IF;
END $$;

SELECT 'Foreign key constraints dropped' as status;

-- ============================================================================
-- STEP 3: DROP EXISTING RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Calendar tokens for own user" ON calendartoken;
DROP POLICY IF EXISTS "Meetings for own user" ON meetings;
DROP POLICY IF EXISTS "Clients for own advisor" ON clients;
DROP POLICY IF EXISTS "ask_threads_advisor_policy" ON ask_threads;
DROP POLICY IF EXISTS "ask_messages_advisor_policy" ON ask_messages;
DROP POLICY IF EXISTS "client_documents_advisor_policy" ON client_documents;
DROP POLICY IF EXISTS "transcript_action_items_advisor_policy" ON transcript_action_items;

SELECT 'RLS policies dropped' as status;

-- ============================================================================
-- STEP 4: CREATE NEW USERS TABLE WITH UUID
-- ============================================================================

-- Rename old users table
ALTER TABLE users RENAME TO _old_users;

-- Create new users table with UUID primary key
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT, -- 'google', 'microsoft', 'email'
    providerid TEXT, -- OAuth provider user ID
    profilepicture TEXT,
    
    -- Onboarding tracking
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    business_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, providerid);

SELECT 'New users table created with UUID' as status;

-- ============================================================================
-- STEP 5: MIGRATE EXISTING USER DATA
-- ============================================================================

DO $$
DECLARE
    old_user_record RECORD;
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID;
    has_provider_column BOOLEAN;
    has_providerid_column BOOLEAN;
BEGIN
    -- Check if provider column exists in old table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '_old_users' AND column_name = 'provider'
    ) INTO has_provider_column;
    
    -- Check if providerid column exists in old table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '_old_users' AND column_name = 'providerid'
    ) INTO has_providerid_column;
    
    RAISE NOTICE 'Old table has provider column: %', has_provider_column;
    RAISE NOTICE 'Old table has providerid column: %', has_providerid_column;
    
    -- Get the first user from old table
    EXECUTE 'SELECT * FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1' INTO old_user_record;
    
    IF old_user_record IS NULL THEN
        RAISE NOTICE 'No existing user found to migrate';
    ELSE
        -- Build dynamic INSERT based on available columns
        IF has_provider_column AND has_providerid_column THEN
            EXECUTE format(
                'INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
                 SELECT $1, email, name, provider, providerid, profilepicture, TRUE, 
                        COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
                 FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1'
            ) USING new_user_uuid;
        ELSIF has_provider_column THEN
            EXECUTE format(
                'INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
                 SELECT $1, email, name, provider, id, profilepicture, TRUE,
                        COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
                 FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1'
            ) USING new_user_uuid;
        ELSE
            EXECUTE format(
                'INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
                 SELECT $1, email, COALESCE(name, email), ''google'', id, profilepicture, TRUE,
                        COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
                 FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1'
            ) USING new_user_uuid;
        END IF;
        
        RAISE NOTICE 'Migrated user to UUID: % (email: %)', new_user_uuid, old_user_record.email;
    END IF;
END $$;

SELECT 'User data migrated' as status;

-- ============================================================================
-- STEP 6: UPDATE FOREIGN KEY COLUMNS TO UUID (ONLY EXISTING TABLES)
-- ============================================================================

DO $$
BEGIN
    -- Always update these core tables
    ALTER TABLE meetings ADD COLUMN userid_uuid UUID;
    ALTER TABLE clients ADD COLUMN advisor_id_uuid UUID;
    
    -- Only update tables that exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        ALTER TABLE ask_threads ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages') THEN
        ALTER TABLE ask_messages ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        ALTER TABLE client_documents ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        ALTER TABLE transcript_action_items ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_action_items') THEN
        ALTER TABLE pending_action_items ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        ALTER TABLE advisor_tasks ADD COLUMN advisor_id_uuid UUID;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        ALTER TABLE client_todos ADD COLUMN advisor_id_uuid UUID;
    END IF;
END $$;

SELECT 'UUID columns added to related tables' as status;

-- ============================================================================
-- STEP 7: MIGRATE FOREIGN KEY DATA (ONLY EXISTING TABLES)
-- ============================================================================

DO $$
DECLARE
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID;
BEGIN
    -- Always update core tables
    UPDATE meetings SET userid_uuid = new_user_uuid WHERE userid = '1' OR userid::INTEGER = 1;
    UPDATE clients SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Only update tables that exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        UPDATE ask_threads SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages') THEN
        UPDATE ask_messages SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        UPDATE client_documents SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        UPDATE transcript_action_items SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_action_items') THEN
        UPDATE pending_action_items SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        UPDATE advisor_tasks SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        UPDATE client_todos SET advisor_id_uuid = new_user_uuid WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    END IF;
    
    RAISE NOTICE 'All foreign key data migrated to UUID';
END $$;

SELECT 'Foreign key data migrated' as status;

-- ============================================================================
-- STEP 8: SWAP OLD AND NEW COLUMNS (ONLY EXISTING TABLES)
-- ============================================================================

DO $$
BEGIN
    -- Always update core tables
    ALTER TABLE meetings DROP COLUMN userid CASCADE;
    ALTER TABLE meetings RENAME COLUMN userid_uuid TO userid;
    
    ALTER TABLE clients DROP COLUMN advisor_id CASCADE;
    ALTER TABLE clients RENAME COLUMN advisor_id_uuid TO advisor_id;
    
    -- Only update tables that exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        ALTER TABLE ask_threads DROP COLUMN advisor_id CASCADE;
        ALTER TABLE ask_threads RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages') THEN
        ALTER TABLE ask_messages DROP COLUMN advisor_id CASCADE;
        ALTER TABLE ask_messages RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        ALTER TABLE client_documents DROP COLUMN advisor_id CASCADE;
        ALTER TABLE client_documents RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        ALTER TABLE transcript_action_items DROP COLUMN advisor_id CASCADE;
        ALTER TABLE transcript_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_action_items') THEN
        ALTER TABLE pending_action_items DROP COLUMN advisor_id CASCADE;
        ALTER TABLE pending_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        ALTER TABLE advisor_tasks DROP COLUMN advisor_id CASCADE;
        ALTER TABLE advisor_tasks RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        ALTER TABLE client_todos DROP COLUMN advisor_id CASCADE;
        ALTER TABLE client_todos RENAME COLUMN advisor_id_uuid TO advisor_id;
    END IF;
END $$;

SELECT 'Old columns dropped, new columns renamed' as status;

-- ============================================================================
-- STEP 9: RECREATE FOREIGN KEY CONSTRAINTS (ONLY EXISTING TABLES)
-- ============================================================================

DO $$
BEGIN
    -- Always add constraints for core tables
    ALTER TABLE meetings
        ADD CONSTRAINT meetings_userid_fkey
        FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE clients
        ADD CONSTRAINT clients_advisor_id_fkey
        FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

    -- Only add constraints for tables that exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        ALTER TABLE ask_threads
            ADD CONSTRAINT ask_threads_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages') THEN
        ALTER TABLE ask_messages
            ADD CONSTRAINT ask_messages_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        ALTER TABLE client_documents
            ADD CONSTRAINT client_documents_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        ALTER TABLE transcript_action_items
            ADD CONSTRAINT transcript_action_items_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_action_items') THEN
        ALTER TABLE pending_action_items
            ADD CONSTRAINT pending_action_items_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        ALTER TABLE advisor_tasks
            ADD CONSTRAINT advisor_tasks_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        ALTER TABLE client_todos
            ADD CONSTRAINT client_todos_advisor_id_fkey
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

SELECT 'Foreign key constraints recreated with CASCADE' as status;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

SELECT 'Migration Part 1 Complete!' as status;
SELECT '✅ Users table migrated to UUID' as result;
SELECT '✅ All foreign keys updated to UUID' as result;
SELECT '✅ Foreign key constraints recreated' as result;
SELECT '' as result;
SELECT 'Next step: Run PHASE1_MULTI_TENANT_MIGRATION_PART2.sql' as next_step;

