-- Fix client relationship and data structure

-- 1. Add a client_id column to meetings table to properly link to clients
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS client_id UUID;

-- 2. Create a foreign key constraint (we'll add this after populating the data)
-- ALTER TABLE meetings ADD CONSTRAINT fk_meetings_client_id FOREIGN KEY (client_id) REFERENCES clients(id);

-- 3. Populate the clients table with data from meetings
INSERT INTO clients (advisor_id, email, name, business_type, likely_value, likely_close_month, created_at, updated_at)
SELECT DISTINCT 
    m.userid as advisor_id,
    att.email,
    COALESCE(m.client_name, att.displayName, att.email) as name,
    m.business_type,
    m.likely_value,
    m.likely_close_month,
    NOW() as created_at,
    NOW() as updated_at
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
  AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.advisor_id = m.userid 
    AND c.email = att->>'email'
  );

-- 4. Update meetings table to link to clients
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

-- 5. Add the foreign key constraint
ALTER TABLE meetings ADD CONSTRAINT fk_meetings_client_id FOREIGN KEY (client_id) REFERENCES clients(id);

-- 6. Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id); 