-- =====================================================
-- CLIENT DOCUMENTS STORAGE BUCKET SETUP
-- =====================================================
-- This script sets up the Supabase storage bucket for client documents
-- with proper RLS policies for service role access
-- =====================================================

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: This needs to be done via Supabase Dashboard or API
-- Go to: Storage → Create a new bucket → Name: "client-documents"
-- Settings:
--   - Public: NO (private bucket)
--   - File size limit: 52428800 (50MB)
--   - Allowed MIME types: Leave empty (we validate in backend)

-- Step 2: Set up RLS policies for the storage bucket
-- These policies allow the backend (using service role key) to manage files

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete files" ON storage.objects;

-- Policy 1: Allow service role to upload files
CREATE POLICY "Service role can upload files"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'client-documents');

-- Policy 2: Allow service role to read files
CREATE POLICY "Service role can read files"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'client-documents');

-- Policy 3: Allow service role to update files
CREATE POLICY "Service role can update files"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'client-documents')
WITH CHECK (bucket_id = 'client-documents');

-- Policy 4: Allow service role to delete files
CREATE POLICY "Service role can delete files"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'client-documents');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'client-documents';

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%Service role%'
ORDER BY policyname;

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- 1. The storage bucket must be created manually in Supabase Dashboard first
-- 2. These RLS policies allow the backend (using service role key) to manage files
-- 3. The backend validates file types, sizes, and user permissions before upload
-- 4. Files are organized by advisor ID: {advisorId}/{filename}
-- 5. Download URLs are signed URLs with expiration (default 1 hour)
--
-- =====================================================

