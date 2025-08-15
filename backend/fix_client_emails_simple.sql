-- Simple script to fix client emails based on known mappings
-- This script directly updates the email field while preserving the name field

-- First, let's see what we're working with
SELECT 'Current state:' as info;
SELECT id, name, email FROM clients ORDER BY name;

-- Update Amelia's email (assuming we can find it in meetings)
UPDATE clients 
SET email = (
    SELECT DISTINCT att->>'email'
    FROM meetings m
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE 
            WHEN m.attendees IS NOT NULL AND m.attendees != '' 
            THEN m.attendees::jsonb 
            ELSE '[]'::jsonb 
        END
    ) AS att
    WHERE m.userid = clients.advisor_id
      AND att->>'email' IS NOT NULL 
      AND att->>'email' LIKE '%@%'
      AND att->>'displayName' ILIKE '%Amelia%'
    LIMIT 1
)
WHERE name = 'Amelia' AND email NOT LIKE '%@%';

-- Update Nelson's email (we know it's nelson@greenwood.co.nz)
UPDATE clients 
SET email = 'nelson@greenwood.co.nz'
WHERE name = 'Nelson' AND email NOT LIKE '%@%';

-- Update Phil's email (assuming we can find it in meetings)
UPDATE clients 
SET email = (
    SELECT DISTINCT att->>'email'
    FROM meetings m
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE 
            WHEN m.attendees IS NOT NULL AND m.attendees != '' 
            THEN m.attendees::jsonb 
            ELSE '[]'::jsonb 
        END
    ) AS att
    WHERE m.userid = clients.advisor_id
      AND att->>'email' IS NOT NULL 
      AND att->>'email' LIKE '%@%'
      AND att->>'displayName' ILIKE '%Phil%'
    LIMIT 1
)
WHERE name = 'Phil' AND email NOT LIKE '%@%';

-- Update Tyler's email (assuming we can find it in meetings)
UPDATE clients 
SET email = (
    SELECT DISTINCT att->>'email'
    FROM meetings m
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE 
            WHEN m.attendees IS NOT NULL AND m.attendees != '' 
            THEN m.attendees::jsonb 
            ELSE '[]'::jsonb 
        END
    ) AS att
    WHERE m.userid = clients.advisor_id
      AND att->>'email' IS NOT NULL 
      AND att->>'email' LIKE '%@%'
      AND att->>'displayName' ILIKE '%Tyler%'
    LIMIT 1
)
WHERE name = 'Tyler' AND email NOT LIKE '%@%';

-- Show the results
SELECT 'After update:' as info;
SELECT id, name, email FROM clients ORDER BY name;

-- Now link meetings to clients
UPDATE meetings 
SET client_id = c.id
FROM clients c
WHERE meetings.userid = c.advisor_id
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(
      CASE 
        WHEN meetings.attendees IS NOT NULL AND meetings.attendees != '' 
        THEN meetings.attendees::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS att
    WHERE att->>'email' = c.email
  );

-- Show linked meetings
SELECT 'Linked meetings:' as info;
SELECT 
    c.name as client_name,
    c.email as client_email,
    COUNT(m.id) as meeting_count
FROM clients c
LEFT JOIN meetings m ON c.id = m.client_id
GROUP BY c.id, c.name, c.email
ORDER BY c.name; 