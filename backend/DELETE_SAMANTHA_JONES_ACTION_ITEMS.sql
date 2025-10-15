-- Delete Action Items for Samantha Jones
-- This script finds and deletes all action items for client Samantha Jones
-- to allow testing of the new AI action items extraction prompt

-- Step 1: Find Samantha Jones client ID
SELECT 
    id,
    name,
    email,
    advisor_id
FROM clients
WHERE name ILIKE '%samantha%jones%' OR email ILIKE '%samantha%jones%'
ORDER BY created_at DESC;

-- Step 2: Show action items that will be deleted (for verification)
SELECT 
    tai.id,
    tai.action_text,
    tai.completed,
    tai.created_at,
    c.name as client_name,
    c.email as client_email,
    m.title as meeting_title,
    m.starttime as meeting_date
FROM transcript_action_items tai
JOIN clients c ON tai.client_id = c.id
JOIN meetings m ON tai.meeting_id = m.id
WHERE c.name ILIKE '%samantha%jones%' OR c.email ILIKE '%samantha%jones%'
ORDER BY tai.created_at DESC;

-- Step 3: Delete action items for Samantha Jones
-- UNCOMMENT THE FOLLOWING LINES TO EXECUTE THE DELETE:

/*
DELETE FROM transcript_action_items
WHERE client_id IN (
    SELECT id 
    FROM clients 
    WHERE name ILIKE '%samantha%jones%' OR email ILIKE '%samantha%jones%'
);
*/

-- Step 4: Verify deletion (should return 0 rows)
/*
SELECT COUNT(*) as remaining_action_items
FROM transcript_action_items tai
JOIN clients c ON tai.client_id = c.id
WHERE c.name ILIKE '%samantha%jones%' OR c.email ILIKE '%samantha%jones%';
*/

-- Alternative: Delete by specific client ID if you know it
-- Replace 'YOUR_CLIENT_ID_HERE' with the actual UUID
/*
DELETE FROM transcript_action_items
WHERE client_id = 'YOUR_CLIENT_ID_HERE';
*/

-- To re-generate action items after deletion:
-- 1. Go to Samantha Jones' meeting in the Advicly UI
-- 2. Click "Auto-Generate Summaries" button
-- 3. The new AI prompt will extract fresh action items

