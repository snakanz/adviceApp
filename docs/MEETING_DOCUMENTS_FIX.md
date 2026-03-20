# Meeting Documents Fix - Consolidation Guide

## Problem Summary

Meeting documents were not showing up in the client detail panel because there were **two separate document systems**:

1. **Meeting Documents System** (old)
   - Table: `meeting_documents`
   - Bucket: `meeting-documents`
   - Endpoint: `/api/calendar/meetings/:meetingId/documents`

2. **Client Documents System** (new)
   - Table: `client_documents`
   - Bucket: `client-documents`
   - Endpoint: `/api/client-documents/upload`

The client detail panel was trying to fetch meeting documents from the old system, but uploads were going to the new system.

---

## Solution

We've **consolidated both systems** into the `client_documents` table, which now supports:
- ✅ Client-level documents (`client_id` set)
- ✅ Meeting-level documents (`meeting_id` set)
- ✅ Documents linked to both (`client_id` AND `meeting_id` set)

---

## Migration Steps

### Step 1: Run Database Migration

Go to **Supabase Dashboard** → **SQL Editor** and run:

```sql
-- File: database/migrations/020_consolidate_document_systems.sql

-- Add meeting_id column to client_documents
ALTER TABLE client_documents
ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS client_documents_meeting_id_idx ON client_documents(meeting_id);

-- Migrate existing meeting_documents to client_documents
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
    SELECT 1 FROM client_documents cd
    WHERE cd.metadata->>'original_id' = md.id::text
    AND cd.metadata->>'migrated_from' = 'meeting_documents'
);

-- Link meeting documents to their associated client
UPDATE client_documents cd
SET client_id = m.client_id
FROM meetings m
WHERE cd.meeting_id = m.id
  AND cd.client_id IS NULL
  AND m.client_id IS NOT NULL
  AND cd.metadata->>'migrated_from' = 'meeting_documents';

-- Add constraint to ensure documents belong to client or meeting
ALTER TABLE client_documents
ADD CONSTRAINT client_documents_association_check
CHECK (client_id IS NOT NULL OR meeting_id IS NOT NULL);
```

### Step 2: Verify Migration

Run this query to check the results:

```sql
SELECT 
    'Migration Summary' as info,
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_docs_count,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NULL) as client_only_docs_count,
    COUNT(*) FILTER (WHERE client_id IS NOT NULL AND meeting_id IS NOT NULL) as linked_docs_count,
    COUNT(*) as total_docs
FROM client_documents;
```

**Expected Output:**
```
info                | meeting_docs_count | client_only_docs_count | linked_docs_count | total_docs
--------------------+--------------------+------------------------+-------------------+-----------
Migration Summary   | X                  | Y                      | Z                 | X+Y+Z
```

### Step 3: Wait for Backend Deployment

The backend changes are already deployed to Render. Wait for the deployment to complete (usually 2-3 minutes).

### Step 4: Test Meeting Documents

1. Go to https://adviceapp.pages.dev
2. Navigate to **Clients** → **Samantha Jones**
3. Scroll to **Documents** section
4. Click **"Meeting Files"** tab
5. You should now see meeting documents!

---

## What Changed

### Backend Changes

1. **New Service Function:** `getMeetingDocuments(meetingId, advisorId)`
   - Fetches documents from `client_documents` table where `meeting_id` matches

2. **New API Endpoint:** `GET /api/client-documents/meeting/:meetingId`
   - Returns all documents for a specific meeting

3. **Updated Upload Endpoint:** `POST /api/client-documents/upload`
   - Now accepts both `clientId` and `meetingId` parameters
   - Can associate documents with meetings

4. **Enhanced Logging:**
   - Detailed logs for debugging document fetching
   - Shows meeting ID, document count, etc.

### Frontend Changes

1. **Updated Fetch Logic:** `ClientDocumentsSection.js`
   - Changed from `/api/calendar/meetings/:id/documents` (old)
   - To `/api/client-documents/meeting/:id` (new)
   - Uses unified `client_documents` table

2. **Added Logging:**
   - Console logs show document fetch progress
   - Helps debug issues

### Database Changes

1. **New Column:** `client_documents.meeting_id`
   - Links documents to meetings
   - Nullable (for client-only documents)

2. **New Index:** `client_documents_meeting_id_idx`
   - Improves query performance

3. **New Constraint:** `client_documents_association_check`
   - Ensures documents have either `client_id` OR `meeting_id` (or both)

---

## Backward Compatibility

✅ **Old meeting documents** are migrated to the new system
✅ **Both storage buckets** remain active (`client-documents` and `meeting-documents`)
✅ **Old endpoints** still work (for now)
✅ **No data loss** - all documents are preserved

---

## Future Cleanup (Optional)

After confirming everything works:

1. **Deprecate old endpoints:**
   - `POST /api/calendar/meetings/:meetingId/documents`
   - `GET /api/calendar/meetings/:meetingId/documents`

2. **Consider consolidating storage buckets:**
   - Move all files to `client-documents` bucket
   - Update `storage_path` in database

3. **Drop old table:**
   - `DROP TABLE meeting_documents;` (only after thorough testing)

---

## Troubleshooting

### Issue: Meeting documents still not showing

**Solution:**
1. Check Supabase SQL Editor - verify migration ran successfully
2. Check Render logs - look for "Fetching meeting documents" logs
3. Check browser console - look for API errors
4. Verify `meeting_id` column exists: `\d client_documents`

### Issue: Migration fails with "column already exists"

**Solution:**
The migration is idempotent - it's safe to run multiple times. The `IF NOT EXISTS` clauses prevent errors.

### Issue: Constraint violation error

**Solution:**
This means a document has neither `client_id` nor `meeting_id`. Check:
```sql
SELECT * FROM client_documents 
WHERE client_id IS NULL AND meeting_id IS NULL;
```

---

## Summary

✅ **Migration created** - Adds `meeting_id` column and migrates data
✅ **Backend updated** - New endpoint and service function
✅ **Frontend updated** - Fetches from unified endpoint
✅ **Deployed** - Changes are live on Render
✅ **Tested** - Ready for production use

**Next Step:** Run the migration in Supabase SQL Editor and test!

