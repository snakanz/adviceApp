-- =====================================================
-- ADVICLY DATABASE WIPE & CLEAN SCHEMA
-- =====================================================
-- This script:
-- 1. Drops all existing tables (WIPE)
-- 2. Creates clean 11-table schema
-- 3. Enables RLS on all tables
-- 4. Creates RLS policies for data isolation
--
-- IMPORTANT: This is DESTRUCTIVE - all data will be deleted!
-- Backup your database first!
--
-- Estimated time: 5-10 minutes
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: DROP ALL EXISTING TABLES (WIPE)
-- =====================================================

DROP TABLE IF EXISTS _backup_users CASCADE;
DROP TABLE IF EXISTS _backup_meetings CASCADE;
DROP TABLE IF EXISTS _backup_clients CASCADE;
DROP TABLE IF EXISTS _backup_ask_threads CASCADE;
DROP TABLE IF EXISTS _backup_client_documents CASCADE;
DROP TABLE IF EXISTS _backup_transcript_action_items CASCADE;
DROP TABLE IF EXISTS _backup_client_todos CASCADE;
DROP TABLE IF EXISTS _backup_pipeline_activities CASCADE;

DROP TABLE IF EXISTS calendartoken CASCADE;
DROP TABLE IF EXISTS meeting_documents CASCADE;
DROP TABLE IF EXISTS pending_action_items CASCADE;
DROP TABLE IF EXISTS advisor_tasks CASCADE;
DROP TABLE IF EXISTS calendar_watch_channels CASCADE;
DROP TABLE IF EXISTS ask_messages CASCADE;
DROP TABLE IF EXISTS ask_threads CASCADE;
DROP TABLE IF EXISTS transcript_action_items CASCADE;
DROP TABLE IF EXISTS client_todos CASCADE;
DROP TABLE IF EXISTS client_documents CASCADE;
DROP TABLE IF EXISTS pipeline_activities CASCADE;
DROP TABLE IF EXISTS client_business_types CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS calendar_connections CASCADE;
DROP TABLE IF EXISTS users CASCADE;

SELECT 'All tables dropped' as status;

-- =====================================================
-- PART 2: CREATE CLEAN 11-TABLE SCHEMA
-- =====================================================

-- 1. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT NOT NULL, -- 'google', 'microsoft', 'email'
    providerid TEXT,
    profilepicture TEXT,
    business_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CALENDAR_CONNECTIONS TABLE
CREATE TABLE calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'calendly')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CLIENTS TABLE (CREATE BEFORE MEETINGS)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    pipeline_stage TEXT DEFAULT 'prospect',
    priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    tags TEXT[],
    source TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- 4. MEETINGS TABLE (AFTER CLIENTS)
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    starttime TIMESTAMP WITH TIME ZONE NOT NULL,
    endtime TIMESTAMP WITH TIME ZONE,
    location TEXT,
    attendees JSONB,
    transcript TEXT,
    quick_summary TEXT,
    detailed_summary TEXT,
    action_points TEXT,
    meeting_source TEXT NOT NULL DEFAULT 'google',
    external_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, external_id)
);

-- 5. CLIENT_BUSINESS_TYPES TABLE
CREATE TABLE client_business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL,
    business_amount NUMERIC,
    regular_contribution NUMERIC,
    contribution_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PIPELINE_ACTIVITIES TABLE
CREATE TABLE pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CLIENT_TODOS TABLE
CREATE TABLE client_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending',
    category TEXT DEFAULT 'general',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. CLIENT_DOCUMENTS TABLE
CREATE TABLE client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    file_url TEXT NOT NULL,
    upload_source TEXT DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. ASK_THREADS TABLE (CREATE BEFORE ASK_MESSAGES)
CREATE TABLE ask_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ASK_MESSAGES TABLE (AFTER ASK_THREADS)
CREATE TABLE ask_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES ask_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. TRANSCRIPT_ACTION_ITEMS TABLE
CREATE TABLE transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    action_item_text TEXT NOT NULL,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Clean schema created' as status;

-- =====================================================
-- PART 3: CREATE INDEXES
-- =====================================================

CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_client_id ON meetings(client_id);
CREATE INDEX idx_meetings_external_id ON meetings(external_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_client_business_types_client_id ON client_business_types(client_id);
CREATE INDEX idx_pipeline_activities_user_id ON pipeline_activities(user_id);
CREATE INDEX idx_pipeline_activities_client_id ON pipeline_activities(client_id);
CREATE INDEX idx_client_todos_user_id ON client_todos(user_id);
CREATE INDEX idx_client_todos_client_id ON client_todos(client_id);
CREATE INDEX idx_client_documents_user_id ON client_documents(user_id);
CREATE INDEX idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX idx_ask_threads_user_id ON ask_threads(user_id);
CREATE INDEX idx_ask_messages_thread_id ON ask_messages(thread_id);
CREATE INDEX idx_transcript_action_items_user_id ON transcript_action_items(user_id);
CREATE INDEX idx_transcript_action_items_meeting_id ON transcript_action_items(meeting_id);

SELECT 'Indexes created' as status;

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_business_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_action_items ENABLE ROW LEVEL SECURITY;

SELECT 'RLS enabled on all tables' as status;

-- =====================================================
-- PART 5: CREATE RLS POLICIES
-- =====================================================

-- Users table
CREATE POLICY "Users can view own data" ON users
    FOR ALL USING (id = auth.uid());

-- Calendar connections
CREATE POLICY "Users can view own calendar connections" ON calendar_connections
    FOR ALL USING (user_id = auth.uid());

-- Meetings
CREATE POLICY "Users can view own meetings" ON meetings
    FOR ALL USING (user_id = auth.uid());

-- Clients
CREATE POLICY "Users can view own clients" ON clients
    FOR ALL USING (user_id = auth.uid());

-- Client business types (via client_id)
CREATE POLICY "Users can view own client business types" ON client_business_types
    FOR ALL USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Pipeline activities
CREATE POLICY "Users can view own pipeline activities" ON pipeline_activities
    FOR ALL USING (user_id = auth.uid());

-- Client todos
CREATE POLICY "Users can view own client todos" ON client_todos
    FOR ALL USING (user_id = auth.uid());

-- Client documents
CREATE POLICY "Users can view own client documents" ON client_documents
    FOR ALL USING (user_id = auth.uid());

-- Ask threads
CREATE POLICY "Users can view own ask threads" ON ask_threads
    FOR ALL USING (user_id = auth.uid());

-- Ask messages (via thread_id)
CREATE POLICY "Users can view own ask messages" ON ask_messages
    FOR ALL USING (
        thread_id IN (
            SELECT id FROM ask_threads WHERE user_id = auth.uid()
        )
    );

-- Transcript action items
CREATE POLICY "Users can view own transcript action items" ON transcript_action_items
    FOR ALL USING (user_id = auth.uid());

SELECT 'RLS policies created' as status;

-- =====================================================
-- PART 6: VERIFICATION
-- =====================================================

SELECT 'VERIFICATION RESULTS:' as section;
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

COMMIT;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- Database wipe and clean schema completed!
--
-- Next steps:
-- 1. User re-registers with Google OAuth
-- 2. User connects Google Calendar
-- 3. Meetings sync automatically
-- 4. Verify everything works
--
-- Expected time: 30 minutes total
-- =====================================================

