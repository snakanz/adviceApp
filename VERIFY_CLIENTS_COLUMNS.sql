-- =====================================================
-- VERIFY CLIENTS TABLE COLUMNS
-- =====================================================
-- Run this in Supabase SQL Editor to see what columns
-- actually exist in your clients table
-- =====================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'clients'
ORDER BY 
    ordinal_position;

-- =====================================================
-- Also check client_business_types table
-- =====================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'client_business_types'
ORDER BY 
    ordinal_position;

