-- =====================================================
-- SIMPLIFIED DOCUMENT SYSTEM CONSOLIDATION
-- =====================================================
-- This migration consolidates the document storage system:
-- 1. Adds meeting_id to client_documents for meeting association
-- 2. Adds upload_source tracking for AI context
-- 3. All documents stored in client_documents table
-- 4. No separate "Meeting Files" - all files are "Client Files"
-- =====================================================

-- =====================================================
-- STEP 1: Ensure client_documents has all necessary columns
-- =====================================================

-- Add meeting_id column if not exists
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE;

-- Add upload_source column for tracking context
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'unknown'
CHECK (upload_source IN ('meetings_page', 'clients_page', 'manual', 'api', 'migrated', 'unknown'));

-- Add index for meeting_id lookups
CREATE INDEX IF NOT EXISTS client_documents_meeting_id_idx ON client_documents(meeting_id);

-- Add index for upload_source (useful for AI queries)
CREATE INDEX IF NOT EXISTS client_documents_upload_source_idx ON client_documents(upload_source);

-- =====================================================
-- STEP 2: Remove old constraint if it exists
-- =====================================================

-- Drop the old constraint that required client_id OR meeting_id
-- We'll allow documents with just client_id (most common case)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'client_documents_association_check'
    ) THEN
        ALTER TABLE client_documents
        DROP CONSTRAINT client_documents_association_check;
    END IF;
END $$;

-- =====================================================
-- STEP 3: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN client_documents.meeting_id IS 'Optional: Links document to a specific meeting for context tracking';
COMMENT ON COLUMN client_documents.upload_source IS 'Tracks where document was uploaded from for AI context: meetings_page, clients_page, manual, api';
COMMENT ON TABLE client_documents IS 'Unified document storage - all client documents stored here, optionally linked to meetings';

-- =====================================================
-- STEP 4: Verification queries
-- =====================================================

-- Show migration summary
SELECT '=== DOCUMENT SYSTEM SETUP COMPLETE ===' as info;

SELECT
    'Total Documents' as metric,
    COUNT(*) as count
FROM client_documents;

SELECT
    'Documents with Meeting Association' as metric,
    COUNT(*) as count
FROM client_documents
WHERE meeting_id IS NOT NULL;

-- Show upload source distribution
SELECT
    '=== UPLOAD SOURCE DISTRIBUTION ===' as info;

SELECT
    COALESCE(upload_source, 'NULL') as upload_source,
    COUNT(*) as count
FROM client_documents
GROUP BY upload_source
ORDER BY count DESC;

-- Show storage bucket distribution
SELECT
    '=== STORAGE BUCKET DISTRIBUTION ===' as info;

SELECT
    storage_bucket,
    COUNT(*) as count
FROM client_documents
GROUP BY storage_bucket
ORDER BY count DESC;

-- =====================================================
-- NOTES
-- =====================================================

-- This migration sets up the unified document system.
-- All documents are stored in client_documents table.
-- Documents can optionally be linked to meetings via meeting_id.
-- The upload_source column tracks context for AI features.
--
-- The old meeting_documents table can be safely deleted if empty.
-- The meeting-documents storage bucket can be deleted if empty.

-- =====================================================

