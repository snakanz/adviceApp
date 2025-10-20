-- ============================================================================
-- OPTIMIZE DATABASE FOR MULTI-TENANT PERFORMANCE
-- ============================================================================
-- Run these optimizations to make your database blazing fast
-- Safe to run - only adds indexes and doesn't modify data
-- ============================================================================

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Meetings table - optimize for advisor queries
CREATE INDEX IF NOT EXISTS idx_meetings_advisor_id ON meetings(userid);
CREATE INDEX IF NOT EXISTS idx_meetings_advisor_start ON meetings(userid, starttime);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(source);
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_event ON meetings(calendly_event_id) WHERE calendly_event_id IS NOT NULL;

-- Clients table - optimize for advisor queries
CREATE INDEX IF NOT EXISTS idx_clients_advisor_id ON clients(advisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_clients_advisor_pipeline ON clients(advisor_id, pipeline_stage);

-- Action items - optimize for advisor and client queries
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_advisor ON transcript_action_items(advisor_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_meeting ON transcript_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_completed ON transcript_action_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_advisor_pending ON transcript_action_items(advisor_id, is_completed) WHERE is_completed = FALSE;

-- Documents - optimize for advisor and client queries
CREATE INDEX IF NOT EXISTS idx_client_documents_advisor ON client_documents(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_meeting ON client_documents(meeting_id) WHERE meeting_id IS NOT NULL;

-- Ask Advicly threads and messages
CREATE INDEX IF NOT EXISTS idx_ask_threads_advisor ON ask_threads(advisor_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_client ON ask_threads(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ask_messages_thread ON ask_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ask_messages_created ON ask_messages(created_at);

-- Client todos
CREATE INDEX IF NOT EXISTS idx_client_todos_advisor ON client_todos(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_client ON client_todos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_completed ON client_todos(is_completed);

-- Business types
CREATE INDEX IF NOT EXISTS idx_client_business_types_client ON client_business_types(client_id);
CREATE INDEX IF NOT EXISTS idx_client_business_types_advisor ON client_business_types(advisor_id);

SELECT 'Performance indexes created' as status;

-- ============================================================================
-- ANALYZE TABLES FOR QUERY OPTIMIZATION
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE users;
ANALYZE calendar_integrations;
ANALYZE meetings;
ANALYZE clients;
ANALYZE transcript_action_items;
ANALYZE client_documents;
ANALYZE ask_threads;
ANALYZE ask_messages;

SELECT 'Table statistics updated' as status;

-- ============================================================================
-- CHECK INDEX USAGE
-- ============================================================================

-- This query shows you which indexes are being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- ============================================================================
-- TABLE SIZE REPORT
-- ============================================================================

-- See how much space each table is using
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

