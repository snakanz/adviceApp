-- Test the meetings table structure and functionality

-- Test 1: Check if meetings table exists and its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position;

-- Test 2: Check current meetings count
SELECT COUNT(*) as total_meetings FROM meetings;

-- Test 3: Try to insert a test meeting
INSERT INTO meetings (
  googleeventid, 
  userid, 
  title, 
  starttime, 
  endtime, 
  summary, 
  attendees
) VALUES (
  'test-meeting-123',
  '1',
  'Test Meeting',
  '2025-08-23T12:00:00Z',
  '2025-08-23T13:00:00Z',
  'This is a test meeting',
  '[]'::jsonb
);

-- Test 4: Check if the meeting was inserted
SELECT * FROM meetings WHERE userid = '1';

-- Test 5: Check RLS policies on meetings table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'meetings';
