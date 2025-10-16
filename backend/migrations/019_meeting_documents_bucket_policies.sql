-- Storage Bucket RLS Policies for meeting-documents
-- Run this to set up security policies for the meeting-documents bucket
-- Created: 2025-10-16

-- ============================================================================
-- STORAGE BUCKET POLICIES FOR MEETING-DOCUMENTS
-- ============================================================================

-- Note: The bucket 'meeting-documents' must exist in Supabase Dashboard first
-- Settings: Private bucket, 50MB file size limit

-- Policy 1: Users can upload meeting documents
-- Files are stored in folders: meetings/{filename}
CREATE POLICY "Users can upload meeting documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meeting-documents' AND
    (storage.foldername(name))[1] = 'meetings'
);

-- Policy 2: Users can read meeting documents
CREATE POLICY "Users can read meeting documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

-- Policy 3: Users can update meeting documents
CREATE POLICY "Users can update meeting documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

-- Policy 4: Users can delete meeting documents
CREATE POLICY "Users can delete meeting documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify bucket exists
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'meeting-documents';

-- Verify policies were created
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%meeting documents%';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Storage bucket policies created successfully!' as status,
       'Bucket: meeting-documents' as bucket,
       'Policies: INSERT, SELECT, UPDATE, DELETE' as policies_created;

