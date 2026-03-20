-- =====================================================
-- FIX SCHEMA MISMATCHES
-- =====================================================
-- This migration fixes schema mismatches between clean schema files
-- and the actual production database:
-- 1. Adds client_id column to transcript_action_items
-- 2. Adds uploaded_at column to client_documents
-- 3. Adds uploaded_by column to client_documents
-- =====================================================

-- =====================================================
-- STEP 1: Fix transcript_action_items table
-- =====================================================

-- Add client_id column if missing
ALTER TABLE transcript_action_items
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_client_id 
ON transcript_action_items(client_id);

-- =====================================================
-- STEP 2: Fix client_documents table
-- =====================================================

-- Add uploaded_at column if missing
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add uploaded_by column if missing
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add index for uploaded_at (useful for sorting)
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_at 
ON client_documents(uploaded_at DESC);

-- Add index for uploaded_by (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by 
ON client_documents(uploaded_by);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify transcript_action_items has client_id
SELECT 'transcript_action_items columns:' as check_name;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'transcript_action_items' 
ORDER BY column_name;

-- Verify client_documents has uploaded_at and uploaded_by
SELECT 'client_documents columns:' as check_name;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'client_documents' 
ORDER BY column_name;

-- =====================================================
-- NOTES
-- =====================================================

-- This migration is idempotent - it's safe to run multiple times
-- All ADD COLUMN IF NOT EXISTS clauses prevent errors on re-runs
-- All CREATE INDEX IF NOT EXISTS clauses prevent duplicate index errors

