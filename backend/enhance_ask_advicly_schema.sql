-- Enhanced Ask Advicly Schema for Context-Aware AI Chat Workflow
-- This migration adds context categorization and meeting association to ask_threads

-- ============================================================================
-- PHASE 1: DATABASE SCHEMA ENHANCEMENT
-- ============================================================================

-- Add context categorization columns to ask_threads table
ALTER TABLE ask_threads ADD COLUMN IF NOT EXISTS context_type VARCHAR(20) DEFAULT 'general';
ALTER TABLE ask_threads ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}';
ALTER TABLE ask_threads ADD COLUMN IF NOT EXISTS meeting_id TEXT NULL;

-- Add constraint for context_type validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_context_type' 
        AND table_name = 'ask_threads'
    ) THEN
        ALTER TABLE ask_threads ADD CONSTRAINT check_context_type 
        CHECK (context_type IN ('general', 'client', 'meeting'));
    END IF;
END $$;

-- Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_ask_threads_context_type ON ask_threads(context_type);
CREATE INDEX IF NOT EXISTS idx_ask_threads_meeting_id ON ask_threads(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_context_advisor ON ask_threads(advisor_id, context_type);
CREATE INDEX IF NOT EXISTS idx_ask_threads_context_client ON ask_threads(advisor_id, client_id, context_type);

-- Add comments for documentation
COMMENT ON COLUMN ask_threads.context_type IS 'Type of conversation context: general, client, or meeting';
COMMENT ON COLUMN ask_threads.context_data IS 'JSON data containing context-specific information (meeting details, client info, etc.)';
COMMENT ON COLUMN ask_threads.meeting_id IS 'Google Calendar event ID for meeting-specific threads';

-- ============================================================================
-- DATA MIGRATION: Update existing threads with context information
-- ============================================================================

-- Update existing client-scoped threads to have proper context
UPDATE ask_threads 
SET 
    context_type = 'client',
    context_data = jsonb_build_object(
        'type', 'client',
        'clientId', client_id,
        'clientName', COALESCE(clients.name, 'Unknown Client'),
        'clientEmail', clients.email,
        'migrated', true
    )
FROM clients
WHERE ask_threads.client_id = clients.id 
AND ask_threads.context_type = 'general'
AND ask_threads.client_id IS NOT NULL;

-- Update remaining threads to be explicitly general context
UPDATE ask_threads 
SET 
    context_type = 'general',
    context_data = jsonb_build_object(
        'type', 'general',
        'scope', 'cross-client',
        'migrated', true
    )
WHERE context_type = 'general' 
AND client_id IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show current thread distribution by context type
SELECT 
    context_type,
    COUNT(*) as thread_count,
    COUNT(CASE WHEN client_id IS NOT NULL THEN 1 END) as with_client,
    COUNT(CASE WHEN meeting_id IS NOT NULL THEN 1 END) as with_meeting
FROM ask_threads
GROUP BY context_type
ORDER BY context_type;

-- Show sample context data
SELECT 
    id,
    title,
    context_type,
    context_data,
    meeting_id,
    client_id,
    created_at
FROM ask_threads
ORDER BY updated_at DESC
LIMIT 10;

-- Verify indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'ask_threads' 
AND indexname LIKE '%context%'
ORDER BY indexname;

-- Show thread counts by advisor and context type
SELECT 
    advisor_id,
    context_type,
    COUNT(*) as thread_count
FROM ask_threads
WHERE is_archived = false
GROUP BY advisor_id, context_type
ORDER BY advisor_id, context_type;
