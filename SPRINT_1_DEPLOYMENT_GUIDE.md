# Sprint 1 Deployment Guide - Client Documents & AI Analysis

**Date:** 2025-10-16  
**Sprint:** 1 - Foundation & Quick Wins  
**Status:** Ready for Deployment

---

## 🎯 What's Being Deployed

### New Features
1. ✅ **Client-level document storage** - Upload documents directly to clients
2. ✅ **AI analysis queue** - Background processing for document analysis
3. ✅ **Document management UI** - Drag-and-drop upload, grid view, download/delete
4. ✅ **Pipeline UI fix** - "Needs Attention" section now responsive on all screens

### New Database Tables
- `client_documents` - Store client documents with AI analysis fields
- `ai_document_analysis_queue` - Queue for background AI processing
- `ai_usage_logs` - Track OpenAI API usage and costs
- Enhanced `ask_threads` - Added AI context fields

### New API Routes
- `POST /api/client-documents/upload` - Upload documents
- `GET /api/client-documents/:clientId` - Get client documents
- `GET /api/client-documents/unassigned/list` - Get unassigned documents
- `PATCH /api/client-documents/:documentId/assign` - Assign document to client
- `DELETE /api/client-documents/:documentId` - Delete document
- `GET /api/client-documents/:documentId/download` - Get download URL
- `POST /api/client-documents/:documentId/analyze` - Trigger AI analysis

### New Components
- `ClientDocumentsManager.js` - Full document management interface
- Enhanced `ViewClient.js` - Added Documents tab

---

## 📋 Pre-Deployment Checklist

### 1. Database Migration

**Run in Supabase SQL Editor:**

```bash
# Navigate to Supabase Dashboard > SQL Editor
# Copy and paste the contents of:
backend/migrations/017_client_documents_and_ai_analysis.sql
```

**Verify migration success:**
```sql
-- Should return 4 tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('client_documents', 'ai_document_analysis_queue', 'ai_usage_logs', 'ask_threads');

-- Should return column counts
SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'client_documents';
-- Expected: ~25 columns

SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ai_document_analysis_queue';
-- Expected: ~12 columns
```

### 2. Supabase Storage Setup

**Create Storage Bucket:**

1. Go to **Supabase Dashboard** > **Storage**
2. Click **New Bucket**
3. Settings:
   - Name: `client-documents`
   - Public: **No** (private bucket)
   - File size limit: **50MB**
   - Allowed MIME types: All (we validate in code)

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

**Verify storage bucket:**
```sql
SELECT * FROM storage.buckets WHERE name = 'client-documents';
-- Should return 1 row
```

### 3. Environment Variables

**Verify these are set in Render:**

```bash
OPENAI_API_KEY=<your-openai-api-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-anon-key>
JWT_SECRET=<your-jwt-secret>
```

### 4. Backend Dependencies

**Check package.json includes:**
```json
{
  "multer": "^1.4.5-lts.1",
  "uuid": "^9.0.0"
}
```

**If missing, install:**
```bash
cd backend
npm install multer uuid
```

### 5. Frontend Build

**No new dependencies needed** - all components use existing libraries.

---

## 🚀 Deployment Steps

### Step 1: Deploy Backend

```bash
# From project root
cd backend

# Install any new dependencies
npm install

# Test locally first (optional but recommended)
npm start

# Verify routes are mounted
# Look for: "✅ Client-documents routes mounted"
```

**Push to Render:**
```bash
git add .
git commit -m "Sprint 1: Add client documents and AI analysis infrastructure"
git push origin main
```

**Verify in Render:**
- Go to Render Dashboard
- Check deployment logs for: "✅ Client-documents routes mounted"
- Verify no errors in deployment

### Step 2: Deploy Frontend

```bash
# From project root
cd ../  # Back to root

# Build frontend
npm run build

# Deploy to Cloudflare Pages
# (Your existing deployment process)
```

### Step 3: Test Deployment

**Test Checklist:**

1. **Login** - Verify authentication still works
2. **Navigate to Clients** - Open any client
3. **Documents Tab** - Should see new "Documents" tab
4. **Upload Test** - Try uploading a PDF or image
5. **Download Test** - Download the uploaded file
6. **Delete Test** - Delete the test file
7. **Pipeline Page** - Verify "Needs Attention" section fits on screen
8. **Resize Browser** - Test responsive design on mobile/tablet sizes

---

## 🔍 Verification Queries

**After deployment, run these in Supabase:**

```sql
-- Check if any documents have been uploaded
SELECT COUNT(*) as total_documents FROM client_documents;

-- Check analysis queue
SELECT status, COUNT(*) as count 
FROM ai_document_analysis_queue 
GROUP BY status;

-- Check AI usage logs
SELECT operation_type, COUNT(*) as count, SUM(total_tokens) as total_tokens
FROM ai_usage_logs 
GROUP BY operation_type;

-- Check storage usage
SELECT 
    bucket_id,
    COUNT(*) as file_count,
    SUM(metadata->>'size')::bigint as total_bytes
FROM storage.objects 
WHERE bucket_id = 'client-documents'
GROUP BY bucket_id;
```

---

## 🐛 Troubleshooting

### Issue: "Failed to upload files"

**Check:**
1. Storage bucket exists: `SELECT * FROM storage.buckets WHERE name = 'client-documents';`
2. RLS policies are set (see Step 2 above)
3. File size < 50MB
4. Backend logs for specific error

### Issue: "Document not found"

**Check:**
1. Document exists in database: `SELECT * FROM client_documents WHERE id = '<document-id>';`
2. User has access (advisor_id matches)
3. Document not marked as deleted: `is_deleted = false`

### Issue: "Needs Attention section still overflows"

**Check:**
1. Frontend build deployed successfully
2. Browser cache cleared
3. Inspect element - should see `max-h-[40vh] lg:max-h-96` classes

### Issue: Routes not found (404)

**Check:**
1. Backend logs show: "✅ Client-documents routes mounted"
2. Route path is correct: `/api/client-documents/...`
3. JWT token is valid and included in request

---

## 📊 Expected Behavior

### Document Upload Flow

```
1. User drags/drops files or clicks "Choose Files"
2. Files uploaded to Supabase Storage (bucket: client-documents)
3. Metadata saved to client_documents table
4. Entry added to ai_document_analysis_queue (status: pending)
5. UI shows document with "Pending" analysis badge
6. (Future: Background worker processes queue and analyzes document)
```

### Document Download Flow

```
1. User clicks "Download" button
2. API generates signed URL (1 hour expiry)
3. URL opens in new tab
4. File downloads from Supabase Storage
```

### Document Delete Flow

```
1. User clicks delete button
2. Confirmation dialog appears
3. File marked as deleted in database (is_deleted = true)
4. File removed from Supabase Storage
5. UI refreshes, document no longer visible
```

---

## 📈 Success Metrics

After deployment, you should see:

- ✅ New "Documents" tab in client detail view
- ✅ Drag-and-drop upload working
- ✅ Documents displaying in grid layout
- ✅ Download/delete actions working
- ✅ "Needs Attention" section responsive on all screens
- ✅ No console errors
- ✅ No backend errors in logs

---

## 🎯 Next Steps (Sprint 2)

Once Sprint 1 is deployed and verified:

1. **Document Analysis** - Implement PDF text extraction
2. **OCR Integration** - Add OpenAI Vision API for image analysis
3. **Background Worker** - Process analysis queue
4. **Entity Extraction** - Extract names, dates, amounts from documents
5. **Auto-Detection** - Automatically assign documents to clients

---

## 📞 Support

If you encounter any issues:

1. Check Supabase logs
2. Check Render deployment logs
3. Check browser console for frontend errors
4. Review this troubleshooting guide
5. Check the main analysis documents for more details

---

**Deployment Status:** ⏳ Ready to Deploy

**Estimated Deployment Time:** 30-45 minutes

**Risk Level:** Low (no breaking changes to existing features)

---

Good luck with the deployment! 🚀

