-- Add is_deleted and deleted_at columns to client_documents table
-- This ensures soft deletion support for document management

-- Add is_deleted column if it doesn't exist
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add deleted_at column if it doesn't exist
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index on is_deleted for faster queries
CREATE INDEX IF NOT EXISTS client_documents_is_deleted_idx ON client_documents(is_deleted);

-- Create index on deleted_at for cleanup queries
CREATE INDEX IF NOT EXISTS client_documents_deleted_at_idx ON client_documents(deleted_at);

