-- Add missing columns to users table to match the expected schema
-- This fixes authentication errors where columns don't exist

-- First, let's see what columns currently exist
SELECT 'Current users table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Add all missing columns that the code expects
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profilepicture TEXT,
ADD COLUMN IF NOT EXISTS googleaccesstoken TEXT,
ADD COLUMN IF NOT EXISTS googlerefreshtoken TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify all expected columns now exist
SELECT 'Updated users table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Show which columns were added
SELECT 'Columns that should now exist:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('profilepicture', 'googleaccesstoken', 'googlerefreshtoken', 'created_at', 'updated_at')
ORDER BY column_name;
