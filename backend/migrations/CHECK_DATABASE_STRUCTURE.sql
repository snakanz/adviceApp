-- ============================================================================
-- DATABASE STRUCTURE CHECK
-- ============================================================================
-- Run this first to see what tables and columns you actually have
-- This will help us create the perfect migration script
-- ============================================================================

-- Check what tables exist
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check users table structure
SELECT 
    'users table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check meetings table structure
SELECT 
    'meetings table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position;

-- Check clients table structure
SELECT 
    'clients table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY ordinal_position;

-- Check ask_threads table structure (if exists)
SELECT 
    'ask_threads table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ask_threads' 
ORDER BY ordinal_position;

-- Check ask_messages table structure (if exists)
SELECT 
    'ask_messages table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ask_messages' 
ORDER BY ordinal_position;

-- Check client_documents table structure (if exists)
SELECT 
    'client_documents table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_documents' 
ORDER BY ordinal_position;

-- Check transcript_action_items table structure (if exists)
SELECT 
    'transcript_action_items table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transcript_action_items' 
ORDER BY ordinal_position;

-- Check advisor_tasks table structure (if exists)
SELECT 
    'advisor_tasks table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'advisor_tasks' 
ORDER BY ordinal_position;

-- Check client_todos table structure (if exists)
SELECT 
    'client_todos table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_todos' 
ORDER BY ordinal_position;

-- Summary: Show all tables with advisor/user ID columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name IN ('userid', 'advisor_id', 'user_id')
    AND table_schema = 'public'
ORDER BY table_name, column_name;

