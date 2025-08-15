-- Add missing Google OAuth token columns to users table
-- This fixes the authentication error where the columns don't exist

-- Add the missing columns to the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS googleaccesstoken TEXT,
ADD COLUMN IF NOT EXISTS googlerefreshtoken TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('googleaccesstoken', 'googlerefreshtoken')
ORDER BY column_name;

-- Show the complete users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
