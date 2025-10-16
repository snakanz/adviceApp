# Full Document System Consolidation Guide

## Overview

This guide documents the complete consolidation of Advicly's document storage system from two separate systems into one unified system.

---

## What Changed

### Before (Two Separate Systems)

**System 1: Meeting Documents**
- Table: `meeting_documents`
- Bucket: `meeting-documents`
- Endpoints: `/api/calendar/meetings/:meetingId/documents`
- Used by: Meetings page (DocumentsTab component)

**System 2: Client Documents**
- Table: `client_documents`
- Bucket: `client-documents`
- Endpoints: `/api/client-documents/*`
- Used by: Clients page (ClientDocumentsSection component)

### After (One Unified System)

**Unified System: Client Documents**
- Table: `client_documents` (supports both client and meeting docs)
- Bucket: `client-documents` (all files stored here)
- Endpoints: Both old and new endpoints use `client_documents` table
- Used by: Both Meetings and Clients pages
- **New Feature:** `upload_source` tracking for AI context

---

## Implementation Steps

### Step 1: Database Migration

Run the migration script in Supabase SQL Editor:

```bash
database/migrations/021_full_document_consolidation.sql
```

**What it does:**
1. ✅ Adds `meeting_id` column to `client_documents`
2. ✅ Adds `upload_source` column for AI context tracking
3. ✅ Migrates all data from `meeting_documents` to `client_documents`
4. ✅ Links meeting documents to their associated clients
5. ✅ Creates indexes for performance
6. ✅ Adds constraints to ensure data integrity
7. ✅ Creates backward compatibility view
8. ✅ Deprecates `meeting_documents` table

**Verification:**
```sql
-- Check migration results
SELECT 
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_docs,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NULL) as client_docs,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NOT NULL) as linked_docs,
    COUNT(*) as total
FROM client_documents;

-- Check upload source distribution
SELECT upload_source, COUNT(*) as count
FROM client_documents
GROUP BY upload_source
ORDER BY count DESC;
```

### Step 2: Storage Bucket Consolidation (Optional but Recommended)

**Option A: Run the automated script**

```bash
# Dry run first (no changes)
DRY_RUN=true node backend/scripts/consolidate-storage-buckets.js

# Actual migration
DRY_RUN=false node backend/scripts/consolidate-storage-buckets.js
```

**What it does:**
1. Downloads files from `meeting-documents` bucket
2. Uploads them to `client-documents` bucket
3. Updates database records with new paths
4. Tracks migration in metadata

**Option B: Keep both buckets**

The system works fine with both buckets. The `storage_bucket` column tracks which bucket each file is in.

### Step 3: Deploy Backend Changes

The backend has been updated to use the unified system:

**Files changed:**
- `backend/src/routes/calendar.js` - Meeting document endpoints now use `client_documents`
- `backend/src/routes/clientDocuments.js` - Added `upload_source` tracking
- `backend/src/services/clientDocuments.js` - Added `getMeetingDocuments()` function

**Key changes:**
- All uploads go to `client-documents` bucket
- All database operations use `client_documents` table
- Upload source is tracked (`meetings_page`, `clients_page`, `migrated`, etc.)

### Step 4: Deploy Frontend Changes

**Files changed:**
- `src/components/DocumentsTab.js` - Added comments about unified system
- `src/components/ClientDocumentsSection.js` - Enhanced logging

**No breaking changes** - Both components continue to work as before, but now use the unified backend.

---

## Upload Source Tracking

The `upload_source` column tracks where documents were uploaded from, providing context for AI features:

### Possible Values

| Value | Description | Set By |
|-------|-------------|--------|
| `meetings_page` | Uploaded from Meetings page | `/api/calendar/meetings/:id/documents` endpoint |
| `clients_page` | Uploaded from Clients page | `/api/client-documents/upload` endpoint |
| `manual` | Manually uploaded via API | API calls with explicit source |
| `api` | Uploaded via API integration | External integrations |
| `migrated` | Migrated from old system | Database migration script |
| `unknown` | Source not tracked | Legacy or error cases |

### AI Context Usage

The Ask AI feature can use `upload_source` to understand document context:

```javascript
// Example: AI can determine if a document was uploaded during a meeting
const meetingDocs = await supabase
  .from('client_documents')
  .select('*')
  .eq('meeting_id', meetingId)
  .eq('upload_source', 'meetings_page');

// AI knows these were uploaded during the meeting, not just associated later
```

---

## API Endpoints

### Meeting Documents (Backward Compatible)

**Upload to Meeting**
```http
POST /api/calendar/meetings/:meetingId/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

files: [File, File, ...]
```

**Response:**
```json
{
  "message": "Successfully uploaded 2 file(s)",
  "files": [
    {
      "id": "uuid",
      "meeting_id": 123,
      "client_id": "uuid",
      "file_name": "meeting_123_1234567890_document.pdf",
      "original_name": "document.pdf",
      "upload_source": "meetings_page",
      "storage_bucket": "client-documents",
      "download_url": "https://..."
    }
  ]
}
```

**Get Meeting Documents**
```http
GET /api/calendar/meetings/:meetingId/documents
Authorization: Bearer {token}
```

**Delete Meeting Document**
```http
DELETE /api/calendar/meetings/:meetingId/documents/:fileId
Authorization: Bearer {token}
```

### Client Documents

**Upload to Client**
```http
POST /api/client-documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

files: [File, File, ...]
clientId: uuid
meetingId: 123 (optional)
```

**Get Client Documents**
```http
GET /api/client-documents/client/:clientId
Authorization: Bearer {token}
```

**Get Meeting Documents (Alternative)**
```http
GET /api/client-documents/meeting/:meetingId
Authorization: Bearer {token}
```

---

## Database Schema

### client_documents Table

```sql
CREATE TABLE client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Associations
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- File metadata
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_category TEXT NOT NULL CHECK (file_category IN ('image', 'document', 'audio', 'video', 'other')),
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'client-documents',
    
    -- Upload tracking
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    upload_source TEXT DEFAULT 'unknown' CHECK (upload_source IN ('meetings_page', 'clients_page', 'manual', 'api', 'migrated', 'unknown')),
    
    -- AI analysis fields
    analysis_status TEXT DEFAULT 'pending',
    extracted_text TEXT,
    ai_summary TEXT,
    ai_insights JSONB,
    detected_entities JSONB,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT client_documents_association_check 
    CHECK (client_id IS NOT NULL OR meeting_id IS NOT NULL)
);
```

### Indexes

```sql
CREATE INDEX client_documents_client_id_idx ON client_documents(client_id);
CREATE INDEX client_documents_meeting_id_idx ON client_documents(meeting_id);
CREATE INDEX client_documents_advisor_id_idx ON client_documents(advisor_id);
CREATE INDEX client_documents_upload_source_idx ON client_documents(upload_source);
CREATE INDEX client_documents_analysis_status_idx ON client_documents(analysis_status);
```

---

## Migration Verification

### Check Document Counts

```sql
SELECT 
    'Total Documents' as metric,
    COUNT(*) as count
FROM client_documents
UNION ALL
SELECT 
    'Meeting Documents',
    COUNT(*)
FROM client_documents
WHERE meeting_id IS NOT NULL
UNION ALL
SELECT 
    'Client-Only Documents',
    COUNT(*)
FROM client_documents
WHERE client_id IS NOT NULL AND meeting_id IS NULL
UNION ALL
SELECT 
    'Linked Documents',
    COUNT(*)
FROM client_documents
WHERE client_id IS NOT NULL AND meeting_id IS NOT NULL;
```

### Check Upload Sources

```sql
SELECT 
    upload_source,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM client_documents
GROUP BY upload_source
ORDER BY count DESC;
```

### Check Storage Buckets

```sql
SELECT 
    storage_bucket,
    COUNT(*) as count
FROM client_documents
GROUP BY storage_bucket;
```

### Find Orphaned Documents

```sql
SELECT *
FROM client_documents
WHERE client_id IS NULL AND meeting_id IS NULL;
-- Should return 0 rows due to constraint
```

---

## Rollback Plan

If issues arise, you can rollback:

### Database Rollback

```sql
-- Remove migrated documents
DELETE FROM client_documents
WHERE metadata->>'migrated_from' = 'meeting_documents';

-- Remove new columns
ALTER TABLE client_documents DROP COLUMN IF EXISTS meeting_id;
ALTER TABLE client_documents DROP COLUMN IF EXISTS upload_source;

-- Remove constraint
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_association_check;
```

### Code Rollback

```bash
git revert <commit-hash>
git push origin main
```

---

## Future Cleanup (After 30-Day Verification)

Once you've verified everything works:

### 1. Drop Old Table

```sql
DROP TABLE meeting_documents CASCADE;
DROP VIEW meeting_documents_view;
```

### 2. Remove Old Bucket (If Consolidated)

```sql
-- In Supabase Dashboard: Storage → meeting-documents → Delete Bucket
```

### 3. Remove Legacy Code

- Remove `backend/src/services/fileUpload.js` (if not used elsewhere)
- Remove legacy comments from code

---

## Benefits

✅ **Single Source of Truth** - All documents in one table
✅ **Unified API** - Consistent endpoints and behavior
✅ **AI Context** - Upload source tracking for better AI insights
✅ **Better Performance** - Single table queries, optimized indexes
✅ **Easier Maintenance** - One system to manage
✅ **Client-Meeting Links** - Documents can belong to both
✅ **Backward Compatible** - Old endpoints still work

---

## Support

If you encounter issues:

1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify database migration completed successfully
4. Check Supabase storage bucket permissions
5. Review this guide for troubleshooting steps

---

**Last Updated:** 2025-10-16
**Migration Version:** 021

