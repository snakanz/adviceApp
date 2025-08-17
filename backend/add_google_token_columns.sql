-- Add missing columns to users and meetings tables
-- This fixes authentication errors and adds new summary fields

-- First, let's see what columns currently exist in users table
SELECT 'Current users table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Add missing columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profilepicture TEXT,
ADD COLUMN IF NOT EXISTS googleaccesstoken TEXT,
ADD COLUMN IF NOT EXISTS googlerefreshtoken TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add new summary columns to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS quick_summary TEXT,
ADD COLUMN IF NOT EXISTS email_summary_draft TEXT,
ADD COLUMN IF NOT EXISTS email_template_id TEXT,
ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMP WITH TIME ZONE;

-- Verify meetings table structure
SELECT 'Current meetings table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Show which new summary columns were added
SELECT 'New summary columns added to meetings:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
AND column_name IN ('quick_summary', 'email_summary_draft', 'email_template_id', 'last_summarized_at')
ORDER BY column_name;
