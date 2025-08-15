-- Enable Row Level Security (RLS) and create policies for all tables
-- This fixes the login issue by allowing proper access to user data

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendartoken ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Calendar tokens for own user" ON calendartoken;
DROP POLICY IF EXISTS "Meetings for own user" ON meetings;
DROP POLICY IF EXISTS "Clients for own advisor" ON clients;

-- Create policies for users table
-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users 
FOR ALL USING (id = auth.uid()::text);

-- Create policies for calendartoken table
-- Users can only access their own calendar tokens
CREATE POLICY "Calendar tokens for own user" ON calendartoken 
FOR ALL USING (userid = auth.uid()::text);

-- Create policies for meetings table
-- Users can only access their own meetings
CREATE POLICY "Meetings for own user" ON meetings 
FOR ALL USING (userid = auth.uid()::text);

-- Create policies for clients table
-- Advisors can only access their own clients
CREATE POLICY "Clients for own advisor" ON clients 
FOR ALL USING (advisor_id = auth.uid()::text);

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'calendartoken', 'meetings', 'clients');

-- Show created policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'calendartoken', 'meetings', 'clients');
