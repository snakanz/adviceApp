-- Debug script to see what email addresses are available in meetings
-- Run this first to understand the data structure

-- 1. Show all unique attendee emails from meetings
SELECT DISTINCT 
    att->>'email' as attendee_email,
    att->>'displayName' as attendee_name,
    COUNT(*) as meeting_count
FROM meetings m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN m.attendees IS NOT NULL AND m.attendees != '' 
        THEN m.attendees::jsonb 
        ELSE '[]'::jsonb 
    END
) AS att
WHERE att->>'email' IS NOT NULL 
  AND att->>'email' != ''
  AND att->>'email' LIKE '%@%'  -- Only real email addresses
GROUP BY att->>'email', att->>'displayName'
ORDER BY meeting_count DESC;

-- 2. Show current clients and their emails
SELECT 
    id,
    name,
    email,
    advisor_id
FROM clients
ORDER BY name;

-- 3. Show meetings with their attendees and client_id status
SELECT 
    m.id,
    m.userid,
    m.client_id,
    m.attendees,
    c.name as client_name,
    c.email as client_email
FROM meetings m
LEFT JOIN clients c ON m.client_id = c.id
WHERE m.attendees IS NOT NULL 
  AND m.attendees != ''
  AND m.attendees != '[]'
ORDER BY m.id; 