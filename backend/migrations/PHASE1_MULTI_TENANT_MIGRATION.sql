-- ============================================================================
-- PHASE 1: MULTI-TENANT DATABASE MIGRATION
-- ============================================================================
-- This migration transforms the Advicly database from single-user to multi-tenant
-- 
-- WHAT THIS DOES:
-- 1. Migrates users table from TEXT/INTEGER id to UUID (Supabase Auth compatible)
-- 2. Adds onboarding tracking columns
-- 3. Creates calendar_integrations table (separate from auth)
-- 4. Updates all foreign key relationships to use UUID
-- 5. Updates all RLS policies to use auth.uid()
-- 6. Migrates existing user data (user ID 1) to new UUID system
--
-- CRITICAL: This is a BREAKING CHANGE - backup your database first!
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA
-- ============================================================================

-- Create temporary backup tables
CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_meetings AS SELECT * FROM meetings;
CREATE TABLE IF NOT EXISTS _backup_clients AS SELECT * FROM clients;
CREATE TABLE IF NOT EXISTS _backup_calendartoken AS SELECT * FROM calendartoken;

SELECT 'Backup tables created' as status;

-- ============================================================================
-- STEP 2: DROP EXISTING FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Drop all foreign key constraints that reference users.id
ALTER TABLE calendartoken DROP CONSTRAINT IF EXISTS calendartoken_userid_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_userid_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_advisor_id_fkey;
ALTER TABLE ask_threads DROP CONSTRAINT IF EXISTS ask_threads_advisor_id_fkey;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_advisor_id_fkey;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_uploaded_by_fkey;
ALTER TABLE transcript_action_items DROP CONSTRAINT IF EXISTS transcript_action_items_advisor_id_fkey;
ALTER TABLE client_business_types DROP CONSTRAINT IF EXISTS client_business_types_advisor_id_fkey CASCADE;
ALTER TABLE pipeline_activities DROP CONSTRAINT IF EXISTS pipeline_activities_advisor_id_fkey;
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

-- Create index on email
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, providerid);

SELECT 'New users table created with UUID' as status;

-- ============================================================================
-- STEP 5: MIGRATE EXISTING USER DATA
-- ============================================================================

-- Generate a deterministic UUID for existing user ID 1
-- This ensures consistency across migrations
DO $$
DECLARE
    existing_user_email TEXT;
    new_user_uuid UUID := '550e8400-e29b-41d4-a716-446655440000'::UUID; -- Fixed UUID for user 1
BEGIN
    -- Get existing user email
    SELECT email INTO existing_user_email FROM _old_users WHERE id = '1' OR id::INTEGER = 1 LIMIT 1;
    
    IF existing_user_email IS NOT NULL THEN
        -- Insert migrated user with fixed UUID
        INSERT INTO users (id, email, name, provider, providerid, profilepicture, onboarding_completed, created_at, updated_at)
        SELECT 
            new_user_uuid,
            email,
            name,
            provider,
            providerid,
            profilepicture,
            TRUE, -- Mark as onboarded since they're existing user
            created_at,
            updated_at
        FROM _old_users 
        WHERE id = '1' OR id::INTEGER = 1
        LIMIT 1;
        
        RAISE NOTICE 'Migrated user: % with UUID: %', existing_user_email, new_user_uuid;
    END IF;
END $$;

SELECT 'Existing user migrated to UUID' as status;

-- ============================================================================
-- STEP 6: UPDATE FOREIGN KEY COLUMNS TO UUID
-- ============================================================================

-- Update calendartoken table
ALTER TABLE calendartoken ALTER COLUMN userid TYPE UUID USING 
    CASE 
        WHEN userid = '1' OR userid::INTEGER = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update meetings table
ALTER TABLE meetings ALTER COLUMN userid TYPE UUID USING 
    CASE 
        WHEN userid = '1' OR userid::INTEGER = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update clients table
ALTER TABLE clients ALTER COLUMN advisor_id TYPE UUID USING 
    CASE 
        WHEN advisor_id = '1' OR advisor_id::INTEGER = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update ask_threads table
ALTER TABLE ask_threads ALTER COLUMN advisor_id TYPE UUID USING 
    CASE 
        WHEN advisor_id::TEXT = '1' OR advisor_id = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update client_documents table
ALTER TABLE client_documents ALTER COLUMN advisor_id TYPE UUID USING 
    CASE 
        WHEN advisor_id::TEXT = '1' OR advisor_id = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

ALTER TABLE client_documents ALTER COLUMN uploaded_by TYPE UUID USING 
    CASE 
        WHEN uploaded_by::TEXT = '1' OR uploaded_by = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update transcript_action_items table
ALTER TABLE transcript_action_items ALTER COLUMN advisor_id TYPE UUID USING 
    CASE 
        WHEN advisor_id::TEXT = '1' OR advisor_id = 1 THEN '550e8400-e29b-41d4-a716-446655440000'::UUID
        ELSE NULL
    END;

-- Update client_business_types table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_business_types') THEN
        EXECUTE 'ALTER TABLE client_business_types ALTER COLUMN advisor_id TYPE UUID USING 
            CASE 
                WHEN advisor_id::TEXT = ''1'' OR advisor_id = 1 THEN ''550e8400-e29b-41d4-a716-446655440000''::UUID
                ELSE NULL
            END';
    END IF;
END $$;

-- Update pipeline_activities table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_activities') THEN
        EXECUTE 'ALTER TABLE pipeline_activities ALTER COLUMN advisor_id TYPE UUID USING 
            CASE 
                WHEN advisor_id::TEXT = ''1'' OR advisor_id = 1 THEN ''550e8400-e29b-41d4-a716-446655440000''::UUID
                ELSE NULL
            END';
    END IF;
END $$;

-- Update client_todos table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        EXECUTE 'ALTER TABLE client_todos ALTER COLUMN advisor_id TYPE UUID USING 
            CASE 
                WHEN advisor_id::TEXT = ''1'' OR advisor_id = 1 THEN ''550e8400-e29b-41d4-a716-446655440000''::UUID
                ELSE NULL
            END';
    END IF;
END $$;

-- Update pipeline_templates table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_templates') THEN
        EXECUTE 'ALTER TABLE pipeline_templates ALTER COLUMN advisor_id TYPE UUID USING 
            CASE 
                WHEN advisor_id::TEXT = ''1'' OR advisor_id = 1 THEN ''550e8400-e29b-41d4-a716-446655440000''::UUID
                ELSE NULL
            END';
    END IF;
END $$;

SELECT 'Foreign key columns updated to UUID' as status;

-- ============================================================================
-- STEP 7: RECREATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraints with CASCADE deletion
ALTER TABLE calendartoken 
    ADD CONSTRAINT calendartoken_userid_fkey 
    FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE meetings 
    ADD CONSTRAINT meetings_userid_fkey 
    FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE clients 
    ADD CONSTRAINT clients_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ask_threads 
    ADD CONSTRAINT ask_threads_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_documents 
    ADD CONSTRAINT client_documents_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_documents 
    ADD CONSTRAINT client_documents_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transcript_action_items 
    ADD CONSTRAINT transcript_action_items_advisor_id_fkey 
    FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE;

-- Conditional foreign keys for optional tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_business_types') THEN
        EXECUTE 'ALTER TABLE client_business_types 
            ADD CONSTRAINT client_business_types_advisor_id_fkey 
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_activities') THEN
        EXECUTE 'ALTER TABLE pipeline_activities 
            ADD CONSTRAINT pipeline_activities_advisor_id_fkey 
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_todos') THEN
        EXECUTE 'ALTER TABLE client_todos 
            ADD CONSTRAINT client_todos_advisor_id_fkey 
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_templates') THEN
        EXECUTE 'ALTER TABLE pipeline_templates 
            ADD CONSTRAINT pipeline_templates_advisor_id_fkey 
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE';
    END IF;
END $$;

SELECT 'Foreign key constraints recreated' as status;

-- ============================================================================
-- MIGRATION CONTINUES IN PART 2...
-- ============================================================================

