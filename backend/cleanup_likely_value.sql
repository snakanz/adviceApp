-- Clean up problematic likely_value data in clients table
-- This script will fix any empty strings or invalid values that might be causing the numeric conversion error

-- First, let's see what problematic data we have
SELECT 'Problematic likely_value data:' as info;
SELECT 
    id,
    name,
    email,
    likely_value,
    likely_value::text as likely_value_text,
    CASE 
        WHEN likely_value IS NULL THEN 'NULL'
        WHEN likely_value::text = '' THEN 'EMPTY_STRING'
        WHEN likely_value <= 0 THEN 'ZERO_OR_NEGATIVE'
        ELSE 'VALID'
    END as status
FROM clients 
WHERE likely_value IS NULL 
   OR likely_value::text = ''
   OR likely_value <= 0
ORDER BY status, name;

-- Update clients with empty string likely_value to NULL
UPDATE clients 
SET likely_value = NULL
WHERE likely_value::text = '';

-- Update clients with zero or negative likely_value to NULL
UPDATE clients 
SET likely_value = NULL
WHERE likely_value <= 0;

-- Show the results after cleanup
SELECT 'After cleanup:' as info;
SELECT 
    id,
    name,
    email,
    likely_value,
    likely_value::text as likely_value_text
FROM clients 
WHERE likely_value IS NOT NULL
ORDER BY name;

-- Show summary
SELECT 'Summary:' as info;
SELECT 
    COUNT(*) as total_clients,
    COUNT(likely_value) as clients_with_value,
    COUNT(CASE WHEN likely_value > 0 THEN 1 END) as clients_with_positive_value
FROM clients; 