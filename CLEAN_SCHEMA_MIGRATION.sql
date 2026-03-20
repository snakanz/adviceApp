-- =====================================================
-- ADVICLY CLEAN SCHEMA MIGRATION
-- =====================================================
-- This script migrates the database from the current messy schema
-- to a clean, minimal, well-architected schema.
--
-- IMPORTANT: 
-- 1. Backup your database first!
-- 2. Test on staging first!
-- 3. Run this entire script in a transaction
-- 4. If anything fails, rollback and investigate
--
-- Estimated time: 1-2 hours
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: BACKUP EXISTING DATA
-- =====================================================

CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_meetings AS SELECT * FROM meetings;
CREATE TABLE IF NOT EXISTS _backup_clients AS SELECT * FROM clients;
CREATE TABLE IF NOT EXISTS _backup_ask_threads AS SELECT * FROM ask_threads;
CREATE TABLE IF NOT EXISTS _backup_client_documents AS SELECT * FROM client_documents;
CREATE TABLE IF NOT EXISTS _backup_transcript_action_items AS SELECT * FROM transcript_action_items;
CREATE TABLE IF NOT EXISTS _backup_client_todos AS SELECT * FROM client_todos;
CREATE TABLE IF NOT EXISTS _backup_pipeline_activities AS SELECT * FROM pipeline_activities;

SELECT 'Phase 1: Backup tables created' as status;

-- =====================================================
-- PHASE 2: ADD UUID COLUMNS TO ALL TABLES
-- =====================================================

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE ask_threads ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE transcript_action_items ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE client_todos ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE pipeline_activities ADD COLUMN IF NOT EXISTS user_id_new UUID;

SELECT 'Phase 2: UUID columns added' as status;

-- =====================================================
-- PHASE 3: MIGRATE DATA TO UUID COLUMNS
-- =====================================================

-- Migrate meetings.userid → meetings.user_id_new
UPDATE meetings 
SET user_id_new = (
    SELECT id FROM users 
    WHERE (id::text = meetings.userid OR email = meetings.userid)
    LIMIT 1
)
WHERE user_id_new IS NULL AND userid IS NOT NULL;

-- Migrate clients.advisor_id → clients.user_id_new
UPDATE clients 
SET user_id_new = (
    SELECT id FROM users 
    WHERE (id::text = clients.advisor_id OR email = clients.advisor_id)
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

-- Migrate ask_threads.advisor_id → ask_threads.user_id_new
UPDATE ask_threads 
SET user_id_new = (
    SELECT id FROM users 
    WHERE (id::text = ask_threads.advisor_id OR id = ask_threads.advisor_id::uuid)
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

-- Migrate client_documents.advisor_id → client_documents.user_id_new
UPDATE client_documents 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = client_documents.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

-- Migrate transcript_action_items.advisor_id → transcript_action_items.user_id_new
UPDATE transcript_action_items 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = transcript_action_items.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

-- Migrate client_todos.advisor_id → client_todos.user_id_new
UPDATE client_todos 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = client_todos.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

-- Migrate pipeline_activities.advisor_id → pipeline_activities.user_id_new
UPDATE pipeline_activities 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = pipeline_activities.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL AND advisor_id IS NOT NULL;

SELECT 'Phase 3: Data migrated to UUID columns' as status;

-- =====================================================
-- PHASE 4: DROP OLD COLUMNS AND RENAME NEW ONES
-- =====================================================

-- Drop old foreign key constraints first
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_userid_fkey CASCADE;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_advisor_id_fkey CASCADE;
ALTER TABLE ask_threads DROP CONSTRAINT IF EXISTS ask_threads_advisor_id_fkey CASCADE;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_advisor_id_fkey CASCADE;
ALTER TABLE transcript_action_items DROP CONSTRAINT IF EXISTS transcript_action_items_advisor_id_fkey CASCADE;
ALTER TABLE client_todos DROP CONSTRAINT IF EXISTS client_todos_advisor_id_fkey CASCADE;
ALTER TABLE pipeline_activities DROP CONSTRAINT IF EXISTS pipeline_activities_advisor_id_fkey CASCADE;

-- Drop old columns
ALTER TABLE meetings DROP COLUMN IF EXISTS userid CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS advisor_id CASCADE;
ALTER TABLE ask_threads DROP COLUMN IF EXISTS advisor_id CASCADE;
ALTER TABLE client_documents DROP COLUMN IF EXISTS advisor_id CASCADE;
ALTER TABLE transcript_action_items DROP COLUMN IF EXISTS advisor_id CASCADE;
ALTER TABLE client_todos DROP COLUMN IF EXISTS advisor_id CASCADE;
ALTER TABLE pipeline_activities DROP COLUMN IF EXISTS advisor_id CASCADE;

-- Rename new columns
ALTER TABLE meetings RENAME COLUMN user_id_new TO user_id;
ALTER TABLE clients RENAME COLUMN user_id_new TO user_id;
ALTER TABLE ask_threads RENAME COLUMN user_id_new TO user_id;
ALTER TABLE client_documents RENAME COLUMN user_id_new TO user_id;
ALTER TABLE transcript_action_items RENAME COLUMN user_id_new TO user_id;
ALTER TABLE client_todos RENAME COLUMN user_id_new TO user_id;
ALTER TABLE pipeline_activities RENAME COLUMN user_id_new TO user_id;

SELECT 'Phase 4: Old columns dropped and new columns renamed' as status;

-- =====================================================
-- PHASE 5: ADD CONSTRAINTS AND INDEXES
-- =====================================================

-- Add NOT NULL constraints
ALTER TABLE meetings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ask_threads ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE client_documents ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transcript_action_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE client_todos ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE pipeline_activities ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE meetings 
ADD CONSTRAINT meetings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE clients 
ADD CONSTRAINT clients_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ask_threads 
ADD CONSTRAINT ask_threads_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_documents 
ADD CONSTRAINT client_documents_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transcript_action_items 
ADD CONSTRAINT transcript_action_items_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_todos 
ADD CONSTRAINT client_todos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE pipeline_activities 
ADD CONSTRAINT pipeline_activities_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_user_id ON ask_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_user_id ON client_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_user_id ON transcript_action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_user_id ON client_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_user_id ON pipeline_activities(user_id);

SELECT 'Phase 5: Constraints and indexes added' as status;

-- =====================================================
-- PHASE 6: DROP DEPRECATED TABLES
-- =====================================================

DROP TABLE IF EXISTS calendartoken CASCADE;
DROP TABLE IF EXISTS meeting_documents CASCADE;
DROP TABLE IF EXISTS pending_action_items CASCADE;
DROP TABLE IF EXISTS advisor_tasks CASCADE;
DROP TABLE IF EXISTS calendar_watch_channels CASCADE;

SELECT 'Phase 6: Deprecated tables dropped' as status;

-- =====================================================
-- PHASE 7: UPDATE RLS POLICIES
-- =====================================================

-- Drop old RLS policies
DROP POLICY IF EXISTS "Meetings for own user" ON meetings;
DROP POLICY IF EXISTS "Clients for own advisor" ON clients;
DROP POLICY IF EXISTS "ask_threads_advisor_policy" ON ask_threads;
DROP POLICY IF EXISTS "client_documents_advisor_policy" ON client_documents;
DROP POLICY IF EXISTS "transcript_action_items_advisor_policy" ON transcript_action_items;

-- Create new RLS policies
CREATE POLICY "Users can view own meetings" ON meetings
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own clients" ON clients
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own ask threads" ON ask_threads
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own documents" ON client_documents
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own action items" ON transcript_action_items
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own todos" ON client_todos
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own activities" ON pipeline_activities
    FOR ALL USING (user_id = auth.uid());

SELECT 'Phase 7: RLS policies updated' as status;

-- =====================================================
-- PHASE 8: VERIFICATION
-- =====================================================

SELECT 'VERIFICATION RESULTS:' as section;
SELECT COUNT(*) as meetings_count FROM meetings;
SELECT COUNT(*) as clients_count FROM clients;
SELECT COUNT(*) as ask_threads_count FROM ask_threads;
SELECT COUNT(*) as null_user_ids FROM meetings WHERE user_id IS NULL;
SELECT COUNT(*) as orphaned_meetings FROM meetings m 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id);

COMMIT;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- Migration completed successfully!
-- 
-- Next steps:
-- 1. Update backend code (change column names)
-- 2. Test thoroughly on staging
-- 3. Deploy to production
-- 4. Monitor for issues
-- 5. Delete backup tables after 1 week
--
-- To rollback (if needed):
-- 1. Restore from backup
-- 2. Or run ROLLBACK_CLEAN_SCHEMA_MIGRATION.sql
-- =====================================================

