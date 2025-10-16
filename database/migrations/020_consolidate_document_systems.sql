-- =====================================================
-- CONSOLIDATE DOCUMENT SYSTEMS
-- =====================================================
-- This migration consolidates the meeting_documents and client_documents
-- systems into a unified client_documents table that supports both
-- client-level and meeting-level document associations.
-- =====================================================

-- Step 1: Add meeting_id column to client_documents table
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE;

-- Step 2: Create index for meeting_id lookups
CREATE INDEX IF NOT EXISTS client_documents_meeting_id_idx ON client_documents(meeting_id);

-- Step 3: Migrate existing meeting_documents to client_documents
-- This will copy all meeting documents to the unified table
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
    md.storage_bucket,
    md.uploaded_by,
    md.uploaded_at,
    md.is_deleted,
    md.deleted_at,
    jsonb_build_object(
        'migrated_from', 'meeting_documents',
        'original_id', md.id::text
    ) as metadata
FROM meeting_documents md
WHERE NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM client_documents cd
    WHERE cd.metadata->>'original_id' = md.id::text
    AND cd.metadata->>'migrated_from' = 'meeting_documents'
);

-- Step 4: Update client_id for migrated meeting documents
-- Link meeting documents to their associated client (if meeting has client_id)
UPDATE client_documents cd
SET client_id = m.client_id
FROM meetings m
WHERE cd.meeting_id = m.id
  AND cd.client_id IS NULL
  AND m.client_id IS NOT NULL
  AND cd.metadata->>'migrated_from' = 'meeting_documents';

-- Step 5: Add constraint to ensure either client_id or meeting_id is set
-- (A document must belong to either a client or a meeting, or both)
ALTER TABLE client_documents
ADD CONSTRAINT client_documents_association_check
CHECK (client_id IS NOT NULL OR meeting_id IS NOT NULL);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check migration results
SELECT 
    'Migration Summary' as info,
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_docs_count,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NULL) as client_only_docs_count,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NOT NULL) as linked_docs_count,
    COUNT(*) as total_docs
FROM client_documents;

-- Check for documents migrated from meeting_documents
SELECT 
    'Migrated Documents' as info,
    COUNT(*) as migrated_count
FROM client_documents
WHERE metadata->>'migrated_from' = 'meeting_documents';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- After this migration:
-- 1. All documents are in the client_documents table
-- 2. Meeting documents have meeting_id set
-- 3. Client documents have client_id set
-- 4. Documents can have both client_id and meeting_id (meeting docs linked to clients)
-- 5. The old meeting_documents table can be deprecated (but not dropped yet for safety)
-- 6. Both storage buckets (client-documents and meeting-documents) remain active
-- 7. The backend API will query client_documents for both client and meeting files
--
-- =====================================================

