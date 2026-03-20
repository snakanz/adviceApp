-- CHECK CURRENT SCHEMA - Run this in Supabase SQL Editor to see what columns exist
-- This will help us understand what's missing and causing the errors

-- Check clients table structure
SELECT 'CLIENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY ordinal_position;

-- Check meetings table structure  
SELECT 'MEETINGS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position;

-- Check if we have any data
SELECT 'DATA COUNTS:' as info;
SELECT 
  (SELECT COUNT(*) FROM clients) as client_count,
  (SELECT COUNT(*) FROM meetings) as meeting_count;

-- Check for any meetings data
SELECT 'SAMPLE MEETINGS DATA:' as info;
SELECT id, userid, clientname, starttime, summary
FROM meetings 
LIMIT 5;

-- Check for any clients data
SELECT 'SAMPLE CLIENTS DATA:' as info;
SELECT id, name, email, advisor_id, created_at
FROM clients 
LIMIT 5;
