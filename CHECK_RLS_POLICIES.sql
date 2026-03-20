-- ============================================================================
-- CHECK RLS POLICIES - SECURITY AUDIT
-- ============================================================================
-- This checks that all tables have proper Row Level Security policies
-- to ensure multi-tenant data isolation
-- ============================================================================

-- List all tables and their RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS DISABLED - SECURITY RISK!'
    END as status,
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- DETAILED POLICY REPORT
-- ============================================================================

-- Show all RLS policies and what they do
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- TABLES MISSING RLS POLICIES
-- ============================================================================

-- Critical: These tables should have RLS policies
WITH important_tables AS (
    SELECT unnest(ARRAY[
        'users',
        'calendar_integrations',
        'meetings',
        'clients',
        'client_business_types',
        'transcript_action_items',
        'pending_action_items',
        'advisor_tasks',
        'client_documents',
        'ask_threads',
        'ask_messages',
        'client_todos',
        'pipeline_templates',
        'pipeline_activities',
        'client_annual_reviews'
    ]) as table_name
)
SELECT 
    it.table_name,
    CASE 
        WHEN pt.rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS DISABLED'
    END as rls_status,
    COALESCE((SELECT COUNT(*) FROM pg_policies WHERE tablename = it.table_name), 0) as policy_count,
    CASE 
        WHEN pt.rowsecurity AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = it.table_name) > 0 
        THEN '✅ SECURE'
        WHEN pt.rowsecurity AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = it.table_name) = 0
        THEN '⚠️ RLS enabled but NO POLICIES'
        ELSE '❌ NOT SECURE - Add RLS policies!'
    END as security_status
FROM important_tables it
LEFT JOIN pg_tables pt ON pt.tablename = it.table_name AND pt.schemaname = 'public'
ORDER BY security_status, table_name;

