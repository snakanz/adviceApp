-- Client Documents and AI Analysis Schema Migration
-- Migration 017: Adds support for client-level document storage, AI analysis, and intelligent features
-- Created: 2025-10-16

-- ============================================================================
-- PART 1: CLIENT DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- File metadata
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- MIME type
    file_category TEXT NOT NULL CHECK (file_category IN ('image', 'document', 'audio', 'video', 'other')),
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'client-documents',
    
    -- AI Analysis fields
    extracted_text TEXT,
    ai_summary TEXT,
    ai_insights JSONB DEFAULT '{}',
    detected_entities JSONB DEFAULT '{}', -- {names: [], emails: [], amounts: [], dates: [], policy_numbers: []}
    analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    analysis_error TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    -- Auto-detection fields
    auto_detected_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    detection_confidence NUMERIC(3,2), -- 0.00 to 1.00
    detection_metadata JSONB DEFAULT '{}',
    manually_assigned BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for client_documents
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_advisor_id ON client_documents(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_documents_file_category ON client_documents(file_category);
CREATE INDEX IF NOT EXISTS idx_client_documents_analysis_status ON client_documents(analysis_status);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_at ON client_documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_client_documents_is_deleted ON client_documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_client_documents_auto_detected ON client_documents(auto_detected_client_id);

-- Full-text search on extracted text
CREATE INDEX IF NOT EXISTS idx_client_documents_extracted_text ON client_documents USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- ============================================================================
-- PART 2: AI DOCUMENT ANALYSIS QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_document_analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('client_document', 'meeting_document')),
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Queue management
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1=highest, 10=lowest
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Error tracking
    error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing metadata
    processing_metadata JSONB DEFAULT '{}'
);

-- Indexes for ai_document_analysis_queue
CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_document_analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_queue_priority ON ai_document_analysis_queue(priority);
CREATE INDEX IF NOT EXISTS idx_ai_queue_created_at ON ai_document_analysis_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_queue_document ON ai_document_analysis_queue(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_ai_queue_advisor ON ai_document_analysis_queue(advisor_id);

-- ============================================================================
-- PART 3: ENHANCE ASK_THREADS TABLE
-- ============================================================================

ALTER TABLE ask_threads
ADD COLUMN IF NOT EXISTS context_documents JSONB DEFAULT '[]', -- Array of document IDs
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gpt-4',
ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_context_refresh TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- PART 4: AI USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    thread_id UUID REFERENCES ask_threads(id) ON DELETE SET NULL,
    
    -- Operation details
    operation_type TEXT NOT NULL, -- 'chat', 'summary', 'analysis', 'ocr', 'transcription'
    model TEXT NOT NULL, -- 'gpt-4', 'gpt-4o-mini', 'whisper-1', 'gpt-4-vision'
    
    -- Token usage
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Cost tracking
    estimated_cost NUMERIC(10,6),
    
    -- Metadata
    request_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_advisor ON ai_usage_logs(advisor_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_client ON ai_usage_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_operation ON ai_usage_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_logs(model);

-- ============================================================================
-- PART 5: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE client_documents IS 'Client-level document storage with AI analysis capabilities';
COMMENT ON TABLE ai_document_analysis_queue IS 'Background job queue for processing document analysis';
COMMENT ON TABLE ai_usage_logs IS 'Tracking of OpenAI API usage and costs';

COMMENT ON COLUMN client_documents.extracted_text IS 'Text extracted from PDF/OCR for search and AI analysis';
COMMENT ON COLUMN client_documents.ai_summary IS 'AI-generated summary of document content';
COMMENT ON COLUMN client_documents.ai_insights IS 'Structured insights extracted by AI (key points, recommendations, etc.)';
COMMENT ON COLUMN client_documents.detected_entities IS 'Named entities extracted from document (names, dates, amounts, etc.)';
COMMENT ON COLUMN client_documents.detection_confidence IS 'Confidence score (0-1) for auto-detected client association';
COMMENT ON COLUMN client_documents.analysis_status IS 'Status of AI analysis: pending, processing, completed, failed';
COMMENT ON COLUMN client_documents.auto_detected_client_id IS 'Client ID detected by AI from document content';

COMMENT ON COLUMN ai_document_analysis_queue.priority IS 'Priority level: 1=highest (urgent), 10=lowest (background)';
COMMENT ON COLUMN ai_document_analysis_queue.attempts IS 'Number of processing attempts made';
COMMENT ON COLUMN ai_document_analysis_queue.max_attempts IS 'Maximum retry attempts before marking as failed';

COMMENT ON COLUMN ai_usage_logs.operation_type IS 'Type of AI operation performed';
COMMENT ON COLUMN ai_usage_logs.estimated_cost IS 'Estimated cost in USD based on token usage and model pricing';

-- ============================================================================
-- PART 6: VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT 'client_documents table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'client_documents';

SELECT 'ai_document_analysis_queue table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'ai_document_analysis_queue';

SELECT 'ai_usage_logs table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs';

-- Verify ask_threads enhancements
SELECT 'ask_threads new columns' as info, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'ask_threads' 
AND column_name IN ('context_documents', 'ai_model', 'total_tokens_used', 'last_context_refresh')
ORDER BY column_name;

-- Verify indexes were created
SELECT 'client_documents indexes' as info, COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'client_documents';

SELECT 'ai_document_analysis_queue indexes' as info, COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'ai_document_analysis_queue';

SELECT 'ai_usage_logs indexes' as info, COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'ai_usage_logs';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Migration 017 completed successfully!' as status,
       'Created: client_documents, ai_document_analysis_queue, ai_usage_logs tables' as tables_created,
       'Enhanced: ask_threads table with AI context fields' as tables_enhanced;

