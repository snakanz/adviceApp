# Advicly AI Enhancement - Quick Start Guide

**Ready to begin?** This guide will help you start Sprint 1 implementation immediately.

---

## 📋 Pre-Implementation Checklist

### ✅ Verify Prerequisites

1. **OpenAI API Access**
   - [ ] API key is active: `<your-openai-api-key>`
   - [ ] Sufficient quota for increased usage
   - [ ] Vision API access enabled
   - [ ] Whisper API access enabled

2. **Supabase Access**
   - [ ] Database connection working
   - [ ] Storage access configured
   - [ ] RLS policies understood
   - [ ] Migration permissions confirmed

3. **Development Environment**
   - [ ] Backend running locally
   - [ ] Frontend running locally
   - [ ] Database migrations tested
   - [ ] Git repository clean

---

## 🚀 Sprint 1: Step-by-Step Implementation

### Step 1: Create Database Migration (30 minutes)

**File:** `backend/migrations/014_client_documents_schema.sql`

```sql
-- Client Documents Schema Migration
-- Adds support for client-level document storage and AI analysis

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_advisor_id ON client_documents(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_documents_file_category ON client_documents(file_category);
CREATE INDEX IF NOT EXISTS idx_client_documents_analysis_status ON client_documents(analysis_status);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_at ON client_documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_client_documents_is_deleted ON client_documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_client_documents_auto_detected ON client_documents(auto_detected_client_id);

-- Full-text search on extracted text
CREATE INDEX IF NOT EXISTS idx_client_documents_extracted_text ON client_documents USING gin(to_tsvector('english', extracted_text));

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_document_analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_queue_priority ON ai_document_analysis_queue(priority);
CREATE INDEX IF NOT EXISTS idx_ai_queue_created_at ON ai_document_analysis_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_queue_document ON ai_document_analysis_queue(document_id, document_type);

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
    model TEXT NOT NULL, -- 'gpt-4', 'gpt-4o-mini', 'whisper-1'
    
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_advisor ON ai_usage_logs(advisor_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_client ON ai_usage_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_operation ON ai_usage_logs(operation_type);

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

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as client_documents_columns FROM information_schema.columns WHERE table_name = 'client_documents';
SELECT COUNT(*) as ai_queue_columns FROM information_schema.columns WHERE table_name = 'ai_document_analysis_queue';
SELECT COUNT(*) as ai_usage_columns FROM information_schema.columns WHERE table_name = 'ai_usage_logs';
```

**Action:** 
1. Create this file in `backend/migrations/`
2. Run migration in Supabase SQL Editor
3. Verify all tables created successfully

---

### Step 2: Set Up Supabase Storage (15 minutes)

**In Supabase Dashboard:**

1. Go to **Storage** section
2. Click **New Bucket**
3. Name: `client-documents`
4. Public: **No** (private bucket)
5. File size limit: **50MB**
6. Allowed MIME types: All (we'll validate in code)

**Set RLS Policies:**

```sql
-- Policy: Users can upload their own client documents
CREATE POLICY "Users can upload client documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own client documents
CREATE POLICY "Users can read their client documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own client documents
CREATE POLICY "Users can delete their client documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### Step 3: Fix Pipeline UI Bug (20 minutes)

**File:** `src/pages/Pipeline.js`

**Find lines 746-747 and replace:**

```javascript
// OLD:
{showOverdueSection && (
  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">

// NEW:
{showOverdueSection && (
  <div className="mt-3 space-y-2 max-h-[40vh] lg:max-h-96 overflow-y-auto overflow-x-hidden">
```

**Find lines 773-806 and update responsive classes:**

```javascript
// Add min-w-0 to allow shrinking on small screens
<div className="flex items-center gap-3 flex-shrink-0 min-w-0">
```

**Test:** Resize browser window to verify section fits properly on all sizes

---

## 📝 Next Steps After Sprint 1

Once Sprint 1 is complete, you'll have:
- ✅ Database ready for client documents
- ✅ Storage bucket configured
- ✅ UI bug fixed
- ✅ Foundation for document analysis

**Then proceed to Sprint 2** for the exciting AI analysis features!

---

## 🆘 Need Help?

- **Database issues?** Check Supabase logs
- **Storage issues?** Verify RLS policies
- **UI issues?** Check browser console
- **General questions?** Review AI_ENHANCEMENT_ANALYSIS.md

---

**Ready to start?** Begin with Step 1 and work through sequentially!

