-- Fix client emails by extracting real email addresses from meetings table
-- This script will update the clients table to have proper email addresses

-- Step 1: First, let's see what email addresses we can extract from meetings
SELECT DISTINCT 
    m.userid,
    att->>'email' as attendee_email,
    att->>'displayName' as attendee_name
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
ORDER BY m.userid, att->>'email';

-- Step 2: Update clients table with real email addresses
-- We'll match clients by name to the attendee displayName or email
-- This preserves the name field and only updates the email field
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
      AND att->>'email' != ''
      AND att->>'email' LIKE '%@%'
      AND (
          att->>'displayName' = clients.name 
          OR att->>'email' LIKE '%' || LOWER(clients.name) || '%'
      )
    LIMIT 1
)
WHERE email NOT LIKE '%@%'  -- Only update clients that don't have real emails
  AND name IS NOT NULL;     -- Ensure we have a name to match against

-- Step 3: Update meetings to link to clients via client_id
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

-- Step 4: Show the results
SELECT 
    c.id,
    c.name,
    c.email,
    COUNT(m.id) as linked_meetings
FROM clients c
LEFT JOIN meetings m ON c.id = m.client_id
GROUP BY c.id, c.name, c.email
ORDER BY c.name; 