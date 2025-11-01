-- =====================================================
-- ADD UPLOADED_AT COLUMN TO CLIENT_DOCUMENTS TABLE
-- =====================================================
-- This migration adds the uploaded_at column to track
-- when documents were uploaded, separate from created_at

-- Add uploaded_at column if it doesn't exist
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for sorting by upload time
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_at 
ON client_documents(uploaded_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN client_documents.uploaded_at IS 'Timestamp when the document was uploaded';

-- Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'client_documents' 
AND column_name IN ('created_at', 'updated_at', 'uploaded_at')
ORDER BY column_name;

