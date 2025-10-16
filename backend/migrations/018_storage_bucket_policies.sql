-- Storage Bucket RLS Policies for client-documents
-- Run this AFTER creating the 'client-documents' bucket in Supabase Dashboard
-- Created: 2025-10-16

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================

-- Note: The bucket 'client-documents' must be created manually in Supabase Dashboard first
-- Settings: Private bucket, 50MB file size limit

-- Policy 1: Users can upload their own client documents
-- Files are stored in folders named by user ID: {user_id}/{filename}
CREATE POLICY "Users can upload client documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can read their own client documents
CREATE POLICY "Users can read their client documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update their own client documents
CREATE POLICY "Users can update their client documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own client documents
CREATE POLICY "Users can delete their client documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
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
WHERE name = 'client-documents';

-- Verify policies were created
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%client documents%';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Storage bucket policies created successfully!' as status,
       'Bucket: client-documents' as bucket,
       'Policies: INSERT, SELECT, UPDATE, DELETE' as policies_created;

