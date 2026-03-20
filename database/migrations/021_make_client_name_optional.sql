-- =====================================================
-- MIGRATION: Make client name optional (email-first architecture)
-- =====================================================
-- This migration makes the clients.name column nullable to support
-- email-first client identification. Clients can now be identified
-- and matched by email address alone, with names as optional display fields.
-- =====================================================

-- Step 1: Alter the clients table to make name nullable
ALTER TABLE clients
ALTER COLUMN name DROP NOT NULL;

-- Step 2: Verify the change
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'name';

-- Step 3: Log the migration
SELECT 'Migration complete: clients.name is now nullable' as status;

