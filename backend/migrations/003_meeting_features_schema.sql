-- Meeting Features Schema Migration
-- Adds support for file uploads and manual meeting creation

-- ============================================================================
-- PART 1: MEETING DOCUMENTS TABLE
-- ============================================================================

-- Create meeting_documents table for file attachments
CREATE TABLE IF NOT EXISTS meeting_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- MIME type
    file_category TEXT NOT NULL CHECK (file_category IN ('image', 'document', 'audio', 'video', 'other')),
    file_size BIGINT NOT NULL, -- Size in bytes
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    storage_bucket TEXT NOT NULL DEFAULT 'meeting-documents',
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}' -- Additional file metadata
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_documents_meeting_id ON meeting_documents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_uploaded_by ON meeting_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_file_category ON meeting_documents(file_category);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_uploaded_at ON meeting_documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_is_deleted ON meeting_documents(is_deleted);

-- ============================================================================
-- PART 2: ENHANCE MEETINGS TABLE FOR MANUAL CREATION
-- ============================================================================

-- Add columns to support manual meeting creation
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_source TEXT DEFAULT 'google' CHECK (meeting_source IN ('google', 'manual', 'outlook')),
ADD COLUMN IF NOT EXISTS location_type TEXT CHECK (location_type IN ('in-person', 'phone', 'video', 'other')),
ADD COLUMN IF NOT EXISTS location_details TEXT,
ADD COLUMN IF NOT EXISTS manual_attendees TEXT, -- For manually entered attendee names
ADD COLUMN IF NOT EXISTS recording_status TEXT DEFAULT 'none' CHECK (recording_status IN ('none', 'recording', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS recording_file_id UUID REFERENCES meeting_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_source ON meetings(meeting_source);
CREATE INDEX IF NOT EXISTS idx_meetings_location_type ON meetings(location_type);
CREATE INDEX IF NOT EXISTS idx_meetings_recording_status ON meetings(recording_status);
CREATE INDEX IF NOT EXISTS idx_meetings_is_manual ON meetings(is_manual);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- ============================================================================
-- PART 3: MEETING TEMPLATES TABLE (FOR FUTURE USE)
-- ============================================================================

-- Create meeting templates for common meeting types
CREATE TABLE IF NOT EXISTS meeting_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    default_duration INTEGER DEFAULT 60, -- Duration in minutes
    default_location_type TEXT DEFAULT 'video',
    default_location_details TEXT,
    template_fields JSONB DEFAULT '{}', -- Custom fields for this template
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for meeting templates
CREATE INDEX IF NOT EXISTS idx_meeting_templates_user_id ON meeting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_templates_is_active ON meeting_templates(is_active);

-- ============================================================================
-- PART 4: UPDATE EXISTING MEETINGS FOR BACKWARD COMPATIBILITY
-- ============================================================================

-- Update existing meetings to have proper source and manual flags
UPDATE meetings 
SET 
    meeting_source = 'google',
    is_manual = FALSE,
    created_by = userid::INTEGER
WHERE meeting_source IS NULL;

-- ============================================================================
-- PART 5: STORAGE BUCKET SETUP INSTRUCTIONS
-- ============================================================================

-- NOTE: The following storage bucket needs to be created in Supabase dashboard:
-- 1. Go to Storage in Supabase dashboard
-- 2. Create bucket named 'meeting-documents'
-- 3. Set appropriate RLS policies for security
-- 4. Configure file size limits (recommended: 50MB max per file)

-- ============================================================================
-- PART 6: VERIFICATION QUERIES
-- ============================================================================

-- Verify new tables were created
SELECT 'meeting_documents table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'meeting_documents';

SELECT 'meeting_templates table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'meeting_templates';

-- Verify new columns were added to meetings table
SELECT 'meetings table new columns' as info, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('meeting_source', 'location_type', 'location_details', 'manual_attendees', 'recording_status', 'recording_file_id', 'created_by', 'is_manual')
ORDER BY column_name;

-- Show sample of updated meetings
SELECT 'updated meetings sample' as info, id, title, meeting_source, is_manual, created_by
FROM meetings 
LIMIT 3;

SELECT 'Migration completed successfully' as status;
