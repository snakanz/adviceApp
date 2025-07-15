-- Simple client migration that works with current structure

-- 1. Add client_id column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS client_id UUID;

-- 2. First, let's see what data we have in meetings
-- This will help us understand the structure
SELECT DISTINCT 
    userid,
    client_name,
    attendees
FROM meetings 
WHERE client_name IS NOT NULL 
   OR attendees IS NOT NULL
LIMIT 5;

-- 3. Create clients from meetings with client_name
INSERT INTO clients (advisor_id, email, name, business_type, likely_value, likely_close_month, created_at, updated_at)
SELECT DISTINCT 
    m.userid as advisor_id,
    COALESCE(m.client_name, 'unknown@example.com') as email,
    m.client_name as name,
    m.business_type,
    m.likely_value,
    m.likely_close_month,
    NOW() as created_at,
    NOW() as updated_at
FROM meetings m
WHERE m.client_name IS NOT NULL 
  AND m.client_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.advisor_id = m.userid 
    AND c.name = m.client_name
  );

-- 4. Update meetings to link to clients
UPDATE meetings 
SET client_id = c.id
FROM clients c
WHERE meetings.userid = c.advisor_id
  AND meetings.client_name = c.name;

-- 5. Add foreign key constraint
ALTER TABLE meetings ADD CONSTRAINT fk_meetings_client_id FOREIGN KEY (client_id) REFERENCES clients(id);

-- 6. Create index
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id); 