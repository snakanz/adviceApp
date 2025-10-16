-- =====================================================
-- FULL DOCUMENT SYSTEM CONSOLIDATION
-- =====================================================
-- This migration fully consolidates the document storage system:
-- 1. Migrates all meeting_documents data to client_documents
-- 2. Adds upload_source tracking for AI context
-- 3. Prepares for storage bucket consolidation
-- 4. Deprecates meeting_documents table
-- =====================================================

-- =====================================================
-- STEP 1: Ensure client_documents has all necessary columns
-- =====================================================

-- Add meeting_id column if not exists (from previous migration)
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
-- STEP 2: Migrate all meeting_documents to client_documents
-- =====================================================

-- Insert all meeting documents that haven't been migrated yet
INSERT INTO client_documents (
    meeting_id,
    advisor_id,
    file_name,
    original_name,
    file_type,
    file_category,
    file_size,
    storage_path,
    storage_bucket,
    uploaded_by,
    uploaded_at,
    is_deleted,
    deleted_at,
    upload_source,
    metadata
)
SELECT 
    md.meeting_id,
    md.uploaded_by as advisor_id,
    md.file_name,
    md.original_name,
    md.file_type,
    md.file_category,
    md.file_size,
    md.storage_path,
    md.storage_bucket, -- Keep original bucket for now
    md.uploaded_by,
    md.uploaded_at,
    md.is_deleted,
    md.deleted_at,
    'migrated' as upload_source, -- Mark as migrated
    jsonb_build_object(
        'migrated_from', 'meeting_documents',
        'original_id', md.id::text,
        'migration_date', NOW()::text,
        'original_storage_bucket', md.storage_bucket
    ) as metadata
FROM meeting_documents md
WHERE NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM client_documents cd
    WHERE cd.metadata->>'original_id' = md.id::text
    AND cd.metadata->>'migrated_from' = 'meeting_documents'
);

-- =====================================================
-- STEP 3: Link meeting documents to their clients
-- =====================================================

-- Update client_id for migrated meeting documents
-- This links meeting docs to their associated client
UPDATE client_documents cd
SET client_id = m.client_id
FROM meetings m
WHERE cd.meeting_id = m.id
  AND cd.client_id IS NULL
  AND m.client_id IS NOT NULL
  AND cd.metadata->>'migrated_from' = 'meeting_documents';

-- =====================================================
-- STEP 4: Add constraints
-- =====================================================

-- Ensure documents belong to either client or meeting (or both)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'client_documents_association_check'
    ) THEN
        ALTER TABLE client_documents
        ADD CONSTRAINT client_documents_association_check
        CHECK (client_id IS NOT NULL OR meeting_id IS NOT NULL);
    END IF;
END $$;

-- =====================================================
-- STEP 5: Create view for backward compatibility
-- =====================================================

-- Create a view that mimics meeting_documents for backward compatibility
CREATE OR REPLACE VIEW meeting_documents_view AS
SELECT 
    id,
    meeting_id,
    file_name,
    original_name,
    file_type,
    file_category,
    file_size,
    storage_path,
    storage_bucket,
    uploaded_by,
    uploaded_at,
    is_deleted,
    deleted_at
FROM client_documents
WHERE meeting_id IS NOT NULL;

-- =====================================================
-- STEP 6: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN client_documents.meeting_id IS 'Links document to a specific meeting (nullable for client-only docs)';
COMMENT ON COLUMN client_documents.upload_source IS 'Tracks where document was uploaded from for AI context: meetings_page, clients_page, manual, api, migrated';
COMMENT ON TABLE client_documents IS 'Unified document storage for both client-level and meeting-level documents';

-- =====================================================
-- STEP 7: Verification queries
-- =====================================================

-- Show migration summary
SELECT 
    '=== MIGRATION SUMMARY ===' as info;

SELECT 
    'Total Documents' as metric,
    COUNT(*) as count
FROM client_documents;

SELECT 
    'Meeting Documents' as metric,
    COUNT(*) as count
FROM client_documents
WHERE meeting_id IS NOT NULL;

SELECT 
    'Client-Only Documents' as metric,
    COUNT(*) as count
FROM client_documents
WHERE client_id IS NOT NULL AND meeting_id IS NULL;

SELECT 
    'Linked Documents (Client + Meeting)' as metric,
    COUNT(*) as count
FROM client_documents
WHERE client_id IS NOT NULL AND meeting_id IS NOT NULL;

SELECT 
    'Migrated Documents' as metric,
    COUNT(*) as count
FROM client_documents
WHERE upload_source = 'migrated';

-- Show upload source distribution
SELECT 
    '=== UPLOAD SOURCE DISTRIBUTION ===' as info;

SELECT 
    upload_source,
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

-- Check for any orphaned documents
SELECT 
    '=== ORPHANED DOCUMENTS CHECK ===' as info;

SELECT 
    COUNT(*) as orphaned_count
FROM client_documents
WHERE client_id IS NULL AND meeting_id IS NULL;

-- =====================================================
-- STEP 8: Deprecation notice
-- =====================================================

COMMENT ON TABLE meeting_documents IS 'DEPRECATED: This table has been replaced by client_documents. Use client_documents with meeting_id filter instead. This table will be dropped in a future migration after verification period.';

-- =====================================================
-- NOTES FOR NEXT STEPS
-- =====================================================

-- After verifying the migration works correctly:
-- 1. Run storage bucket consolidation (separate script)
-- 2. Update all application code to use client_documents
-- 3. After 30-day verification period, drop meeting_documents table:
--    DROP TABLE meeting_documents CASCADE;
-- 4. Drop the compatibility view:
--    DROP VIEW meeting_documents_view;

-- =====================================================

