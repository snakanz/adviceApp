# Request 2: Database Schema Audit & Redesign
## Part 3: Migration Plan & SQL Scripts

---

## Migration Strategy

### Phase 1: Backup & Preparation (30 minutes)
1. Create backup tables
2. Verify data integrity
3. Document current state

### Phase 2: Schema Migration (1-2 hours)
1. Add UUID columns to all tables
2. Migrate data from old columns to new columns
3. Update foreign keys
4. Drop old columns

### Phase 3: Cleanup (30 minutes)
1. Drop deprecated tables
2. Create indexes
3. Update RLS policies

### Phase 4: Verification (30 minutes)
1. Verify data integrity
2. Test foreign keys
3. Test RLS policies

**Total Time:** 2.5-3.5 hours

---

## Pre-Migration Checklist

```sql
-- 1. Verify data exists
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as meeting_count FROM meetings;
SELECT COUNT(*) as client_count FROM clients;

-- 2. Check for NULL values in critical columns
SELECT COUNT(*) FROM meetings WHERE userid IS NULL;
SELECT COUNT(*) FROM clients WHERE advisor_id IS NULL;

-- 3. Verify foreign key relationships
SELECT COUNT(*) FROM meetings m 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = m.userid);

-- 4. Check for orphaned records
SELECT COUNT(*) FROM meetings WHERE client_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = meetings.client_id);
```

---

## Migration SQL Script

### PHASE 1: BACKUP & PREPARATION

```sql
BEGIN;

-- Create backup tables
CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_meetings AS SELECT * FROM meetings;
CREATE TABLE IF NOT EXISTS _backup_clients AS SELECT * FROM clients;
CREATE TABLE IF NOT EXISTS _backup_ask_threads AS SELECT * FROM ask_threads;
CREATE TABLE IF NOT EXISTS _backup_client_documents AS SELECT * FROM client_documents;
CREATE TABLE IF NOT EXISTS _backup_transcript_action_items AS SELECT * FROM transcript_action_items;
CREATE TABLE IF NOT EXISTS _backup_client_todos AS SELECT * FROM client_todos;
CREATE TABLE IF NOT EXISTS _backup_pipeline_activities AS SELECT * FROM pipeline_activities;

SELECT 'Backup tables created' as status;
```

### PHASE 2: ADD UUID COLUMNS

```sql
-- Add UUID columns to all tables
ALTER TABLE meetings ADD COLUMN user_id_new UUID;
ALTER TABLE clients ADD COLUMN user_id_new UUID;
ALTER TABLE ask_threads ADD COLUMN user_id_new UUID;
ALTER TABLE client_documents ADD COLUMN user_id_new UUID;
ALTER TABLE transcript_action_items ADD COLUMN user_id_new UUID;
ALTER TABLE client_todos ADD COLUMN user_id_new UUID;
ALTER TABLE pipeline_activities ADD COLUMN user_id_new UUID;

SELECT 'UUID columns added' as status;
```

### PHASE 3: MIGRATE DATA

```sql
-- Migrate meetings.userid → meetings.user_id_new
UPDATE meetings 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = meetings.userid 
    OR email = meetings.userid
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate clients.advisor_id → clients.user_id_new
UPDATE clients 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = clients.advisor_id 
    OR email = clients.advisor_id
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate ask_threads.advisor_id → ask_threads.user_id_new
UPDATE ask_threads 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = ask_threads.advisor_id 
    OR id = ask_threads.advisor_id::uuid
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate client_documents.advisor_id → client_documents.user_id_new
UPDATE client_documents 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = client_documents.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate transcript_action_items.advisor_id → transcript_action_items.user_id_new
UPDATE transcript_action_items 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = transcript_action_items.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate client_todos.advisor_id → client_todos.user_id_new
UPDATE client_todos 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = client_todos.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL;

-- Migrate pipeline_activities.advisor_id → pipeline_activities.user_id_new
UPDATE pipeline_activities 
SET user_id_new = (
    SELECT id FROM users 
    WHERE id::text = pipeline_activities.advisor_id::text
    LIMIT 1
)
WHERE user_id_new IS NULL;

SELECT 'Data migrated to UUID columns' as status;
```

### PHASE 4: DROP OLD COLUMNS & RENAME

```sql
-- Drop old columns
ALTER TABLE meetings DROP COLUMN userid CASCADE;
ALTER TABLE clients DROP COLUMN advisor_id CASCADE;
ALTER TABLE ask_threads DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_documents DROP COLUMN advisor_id CASCADE;
ALTER TABLE transcript_action_items DROP COLUMN advisor_id CASCADE;
ALTER TABLE client_todos DROP COLUMN advisor_id CASCADE;
ALTER TABLE pipeline_activities DROP COLUMN advisor_id CASCADE;

-- Rename new columns
ALTER TABLE meetings RENAME COLUMN user_id_new TO user_id;
ALTER TABLE clients RENAME COLUMN user_id_new TO user_id;
ALTER TABLE ask_threads RENAME COLUMN user_id_new TO user_id;
ALTER TABLE client_documents RENAME COLUMN user_id_new TO user_id;
ALTER TABLE transcript_action_items RENAME COLUMN user_id_new TO user_id;
ALTER TABLE client_todos RENAME COLUMN user_id_new TO user_id;
ALTER TABLE pipeline_activities RENAME COLUMN user_id_new TO user_id;

SELECT 'Old columns dropped and new columns renamed' as status;
```

### PHASE 5: ADD CONSTRAINTS & INDEXES

```sql
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
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_ask_threads_user_id ON ask_threads(user_id);
CREATE INDEX idx_client_documents_user_id ON client_documents(user_id);
CREATE INDEX idx_transcript_action_items_user_id ON transcript_action_items(user_id);
CREATE INDEX idx_client_todos_user_id ON client_todos(user_id);
CREATE INDEX idx_pipeline_activities_user_id ON pipeline_activities(user_id);

SELECT 'Constraints and indexes added' as status;
```

### PHASE 6: DROP DEPRECATED TABLES

```sql
-- Drop deprecated tables
DROP TABLE IF EXISTS calendartoken CASCADE;
DROP TABLE IF EXISTS meeting_documents CASCADE;
DROP TABLE IF EXISTS pending_action_items CASCADE;
DROP TABLE IF EXISTS advisor_tasks CASCADE;
DROP TABLE IF EXISTS calendar_watch_channels CASCADE;

SELECT 'Deprecated tables dropped' as status;
```

### PHASE 7: UPDATE RLS POLICIES

```sql
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

SELECT 'RLS policies updated' as status;

COMMIT;
```

---

## Rollback Plan

If migration fails, rollback is simple:

```sql
BEGIN;

-- Drop new columns
ALTER TABLE meetings DROP COLUMN user_id CASCADE;
ALTER TABLE clients DROP COLUMN user_id CASCADE;
ALTER TABLE ask_threads DROP COLUMN user_id CASCADE;
ALTER TABLE client_documents DROP COLUMN user_id CASCADE;
ALTER TABLE transcript_action_items DROP COLUMN user_id CASCADE;
ALTER TABLE client_todos DROP COLUMN user_id CASCADE;
ALTER TABLE pipeline_activities DROP COLUMN user_id CASCADE;

-- Restore from backup
DROP TABLE meetings;
DROP TABLE clients;
DROP TABLE ask_threads;
DROP TABLE client_documents;
DROP TABLE transcript_action_items;
DROP TABLE client_todos;
DROP TABLE pipeline_activities;

ALTER TABLE _backup_meetings RENAME TO meetings;
ALTER TABLE _backup_clients RENAME TO clients;
ALTER TABLE _backup_ask_threads RENAME TO ask_threads;
ALTER TABLE _backup_client_documents RENAME TO client_documents;
ALTER TABLE _backup_transcript_action_items RENAME TO transcript_action_items;
ALTER TABLE _backup_client_todos RENAME TO client_todos;
ALTER TABLE _backup_pipeline_activities RENAME TO pipeline_activities;

COMMIT;
```

---

## Post-Migration Verification

```sql
-- Verify all data migrated
SELECT 'Verification Results:' as section;
SELECT COUNT(*) as meetings_count FROM meetings;
SELECT COUNT(*) as clients_count FROM clients;
SELECT COUNT(*) as ask_threads_count FROM ask_threads;

-- Check for NULL user_id values
SELECT COUNT(*) as null_user_ids FROM meetings WHERE user_id IS NULL;
SELECT COUNT(*) as null_user_ids FROM clients WHERE user_id IS NULL;

-- Verify foreign keys work
SELECT COUNT(*) as orphaned_meetings FROM meetings m 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id);

-- Test RLS policies
SELECT * FROM meetings LIMIT 1; -- Should work if authenticated
```

---

## Next Steps

See **REQUEST_2_DATABASE_AUDIT_PART4.md** for:
1. ERD diagram
2. Documentation
3. Backend code updates needed
4. Testing checklist

