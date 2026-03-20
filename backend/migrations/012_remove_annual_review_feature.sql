-- Migration: Remove Annual Review Feature
-- Description: Removes all annual review related columns, tables, and views
-- Date: 2025-11-02
-- Reason: Simplifying the app - removing review meetings feature to keep it clean and simple

-- ============================================================================
-- PART 1: DROP VIEWS
-- ============================================================================

-- Drop the annual review dashboard view
DROP VIEW IF EXISTS annual_review_dashboard CASCADE;

-- ============================================================================
-- PART 2: DROP TABLES
-- ============================================================================

-- Drop the client_annual_reviews table
DROP TABLE IF EXISTS client_annual_reviews CASCADE;

-- ============================================================================
-- PART 3: REMOVE COLUMNS FROM MEETINGS TABLE
-- ============================================================================

-- Remove the is_annual_review column from meetings table
ALTER TABLE meetings
DROP COLUMN IF EXISTS is_annual_review CASCADE;

-- Drop the index on is_annual_review if it exists
DROP INDEX IF EXISTS meetings_is_annual_review_idx CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the column was removed
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'meetings' AND column_name = 'is_annual_review';
-- Should return no rows

-- Verify the table was dropped
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'client_annual_reviews';
-- Should return no rows

