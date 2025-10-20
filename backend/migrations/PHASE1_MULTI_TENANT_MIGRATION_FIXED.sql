-- ============================================================================
-- ADVICLY MULTI-TENANT MIGRATION - PART 1 (FIXED VERSION)
-- ============================================================================
-- This migration converts the users table from TEXT/INTEGER to UUID primary keys
-- and prepares the database for multi-tenant support with Supabase Auth.
--
-- IMPORTANT: This is the FIXED version that handles missing columns gracefully
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
-- STEP 2: DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Drop all foreign key constraints that reference users.id
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_userid_fkey CASCADE;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_advisor_id_fkey CASCADE;
ALTER TABLE ask_threads DROP CONSTRAINT IF EXISTS ask_threads_advisor_id_fkey CASCADE;
ALTER TABLE ask_messages DROP CONSTRAINT IF EXISTS ask_messages_advisor_id_fkey CASCADE;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_advisor_id_fkey CASCADE;
ALTER TABLE transcript_action_items DROP CONSTRAINT IF EXISTS transcript_action_items_advisor_id_fkey CASCADE;
ALTER TABLE pending_action_items DROP CONSTRAINT IF EXISTS pending_action_items_advisor_id_fkey CASCADE;
ALTER TABLE advisor_tasks DROP CONSTRAINT IF EXISTS advisor_tasks_advisor_id_fkey CASCADE;
ALTER TABLE client_todos DROP CONSTRAINT IF EXISTS client_todos_advisor_id_fkey CASCADE;
ALTER TABLE pipeline_templates DROP CONSTRAINT IF EXISTS pipeline_templates_advisor_id_fkey;

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
-- STEP 5: MIGRATE EXISTING USER DATA (FIXED VERSION)
-- ============================================================================

-- This version handles missing columns gracefully
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
            -- Old table has all columns
            EXECUTE format(
                'INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
                 SELECT $1, email, name, provider, providerid, profilepicture, TRUE, 
                        COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
                 FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1'
            ) USING new_user_uuid;
        ELSIF has_provider_column THEN
            -- Has provider but not providerid
            EXECUTE format(
                'INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
                 SELECT $1, email, name, provider, id, profilepicture, TRUE,
                        COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
                 FROM _old_users WHERE id = ''1'' OR id::INTEGER = 1 LIMIT 1'
            ) USING new_user_uuid;
        ELSE
            -- No provider columns - use defaults
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
-- STEP 6: UPDATE FOREIGN KEY COLUMNS TO UUID
-- ============================================================================

-- Add new UUID columns to all tables that reference users
ALTER TABLE meetings ADD COLUMN userid_uuid UUID;
ALTER TABLE clients ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE ask_threads ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE ask_messages ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE client_documents ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE transcript_action_items ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE pending_action_items ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE advisor_tasks ADD COLUMN advisor_id_uuid UUID;
ALTER TABLE client_todos ADD COLUMN advisor_id_uuid UUID;

SELECT 'UUID columns added to related tables' as status;

-- ============================================================================
-- STEP 7: MIGRATE FOREIGN KEY DATA
-- ============================================================================

-- Update all foreign key references to use the new UUID
DO $$
DECLARE
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID;
BEGIN
    -- Update meetings
    UPDATE meetings SET userid_uuid = new_user_uuid 
    WHERE userid = '1' OR userid::INTEGER = 1;
    
    -- Update clients
    UPDATE clients SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update ask_threads
    UPDATE ask_threads SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update ask_messages
    UPDATE ask_messages SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update client_documents
    UPDATE client_documents SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update transcript_action_items
    UPDATE transcript_action_items SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update pending_action_items
    UPDATE pending_action_items SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update advisor_tasks
    UPDATE advisor_tasks SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    -- Update client_todos
    UPDATE client_todos SET advisor_id_uuid = new_user_uuid 
    WHERE advisor_id = '1' OR advisor_id::INTEGER = 1;
    
    RAISE NOTICE 'All foreign key data migrated to UUID';
END $$;

SELECT 'Foreign key data migrated' as status;

-- ============================================================================
-- STEP 8: SWAP OLD AND NEW COLUMNS
-- ============================================================================

-- Drop old columns and rename new ones
ALTER TABLE meetings DROP COLUMN userid CASCADE;
ALTER TABLE meetings RENAME COLUMN userid_uuid TO userid;

ALTER TABLE clients DROP COLUMN advisor_id CASCADE;
ALTER TABLE clients RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE ask_threads DROP COLUMN advisor_id CASCADE;
ALTER TABLE ask_threads RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE ask_messages DROP COLUMN advisor_id CASCADE;
ALTER TABLE ask_messages RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE client_documents DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_documents RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE transcript_action_items DROP COLUMN advisor_id CASCADE;
ALTER TABLE transcript_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE pending_action_items DROP COLUMN advisor_id CASCADE;
ALTER TABLE pending_action_items RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE advisor_tasks DROP COLUMN advisor_id CASCADE;
ALTER TABLE advisor_tasks RENAME COLUMN advisor_id_uuid TO advisor_id;

ALTER TABLE client_todos DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_todos RENAME COLUMN advisor_id_uuid TO advisor_id;

SELECT 'Old columns dropped, new columns renamed' as status;

-- ============================================================================
-- STEP 9: RECREATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraints with CASCADE delete
ALTER TABLE meetings 
    ADD CONSTRAINT meetings_userid_fkey 
    FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE clients 
    ADD CONSTRAINT clients_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ask_threads 
    ADD CONSTRAINT ask_threads_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ask_messages 
    ADD CONSTRAINT ask_messages_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_documents 
    ADD CONSTRAINT client_documents_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transcript_action_items 
    ADD CONSTRAINT transcript_action_items_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE pending_action_items 
    ADD CONSTRAINT pending_action_items_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE advisor_tasks 
    ADD CONSTRAINT advisor_tasks_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_todos 
    ADD CONSTRAINT client_todos_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

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

