-- =====================================================
-- ADD CLIENT PERSONAL INFORMATION
-- =====================================================
-- This migration adds personal information fields to the clients table:
-- 1. date_of_birth (DATE) - for calculating age
-- 2. gender (TEXT) - Male or Female only
-- =====================================================

-- Add date_of_birth column (optional)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add gender column with constraint (optional, Male or Female only)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female'));

-- Add index for gender (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_clients_gender 
ON clients(gender);

-- Add index for date_of_birth (useful for sorting/filtering)
CREATE INDEX IF NOT EXISTS idx_clients_date_of_birth 
ON clients(date_of_birth);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify clients table has new columns
SELECT 'clients columns:' as check_name;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY column_name;

-- =====================================================
-- NOTES
-- =====================================================

-- This migration is idempotent - it's safe to run multiple times
-- All ADD COLUMN IF NOT EXISTS clauses prevent errors on re-runs
-- All CREATE INDEX IF NOT EXISTS clauses prevent duplicate index errors
-- Both columns are optional (can be NULL)
-- Gender is restricted to 'Male' or 'Female' via CHECK constraint

