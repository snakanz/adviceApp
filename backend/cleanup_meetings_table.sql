-- Clean up meetings table by removing unused pipeline columns
-- These columns are no longer used since we have a separate clients table

-- Remove the unused columns
ALTER TABLE meetings DROP COLUMN IF EXISTS client_name;
ALTER TABLE meetings DROP COLUMN IF EXISTS business_type;
ALTER TABLE meetings DROP COLUMN IF EXISTS likely_value;
ALTER TABLE meetings DROP COLUMN IF EXISTS likely_close_month;

-- Remove the indexes that are no longer needed
DROP INDEX IF EXISTS idx_meetings_business_type;
DROP INDEX IF EXISTS idx_meetings_likely_value;
DROP INDEX IF EXISTS idx_meetings_likely_close_month;

-- Verify the cleanup
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position; 