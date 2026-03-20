# Client Documents Storage Setup Guide

## Problem
Client document uploads are failing because the Supabase storage bucket doesn't exist or has incorrect RLS policies.

## Solution
Set up the `client-documents` storage bucket in Supabase with proper configuration.

---

## Step 1: Create Storage Bucket

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Create New Bucket**
   - Click **Storage** in the left sidebar
   - Click **"New bucket"** button
   - Configure:
     - **Name:** `client-documents`
     - **Public:** ❌ **NO** (keep it private)
     - **File size limit:** `52428800` (50MB)
     - **Allowed MIME types:** Leave empty (backend validates)
   - Click **"Create bucket"**

---

## Step 2: Configure RLS Policies

### Option A: Disable RLS (Simplest - Recommended for Now)

Since the backend uses the **service role key** which bypasses RLS anyway:

1. In Supabase Dashboard → **Storage** → **Policies**
2. Find the `client-documents` bucket
3. Click **"Disable RLS"** or ensure no restrictive policies are enabled

The service role key has full access regardless of RLS policies.

### Option B: Set Up Explicit Policies (Optional)

If you want explicit policies, run this SQL in Supabase SQL Editor:

```sql
-- Allow service role full access to client-documents bucket
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'client-documents')
WITH CHECK (bucket_id = 'client-documents');
```

---

## Step 3: Verify Setup

### Test 1: Check Bucket Exists

Run in Supabase SQL Editor:

```sql
SELECT * FROM storage.buckets WHERE name = 'client-documents';
```

**Expected Result:**
- Should return 1 row with bucket details
- `public` column should be `false`

### Test 2: Check Policies

Run in Supabase SQL Editor:

```sql
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND (policyname LIKE '%client-documents%' OR policyname LIKE '%Service role%')
ORDER BY policyname;
```

### Test 3: Test Upload from Frontend

1. Go to https://adviceapp.pages.dev
2. Navigate to **Clients** page
3. Click on **Samantha Jones**
4. Scroll to **Documents** section
5. Click **"Client Files"** tab
6. Try uploading a file (PDF, image, etc.)

**Expected Result:**
- File uploads successfully
- No errors in console
- File appears in the list

---

## Troubleshooting

### Error: "Storage upload failed: Bucket not found"

**Solution:** Create the bucket (Step 1)

### Error: "Storage upload failed: new row violates row-level security policy"

**Solution:** Disable RLS or add service role policy (Step 2)

### Error: "Storage upload failed: File size exceeds limit"

**Solution:** 
1. Go to Storage → client-documents → Settings
2. Increase file size limit to 52428800 (50MB)

### Error: "Storage upload failed: Invalid MIME type"

**Solution:**
1. Go to Storage → client-documents → Settings
2. Clear the "Allowed MIME types" field (leave empty)
3. Backend validates file types

---

## Backend Configuration

The backend is already configured correctly:

- ✅ Uses **service role key** (bypasses RLS)
- ✅ Validates file types (images, PDFs, audio, video, documents)
- ✅ Validates file size (max 50MB)
- ✅ Organizes files by advisor: `{advisorId}/{filename}`
- ✅ Generates signed download URLs (1 hour expiration)

---

## File Organization

Files are stored with this structure:

```
client-documents/
├── 1/                          # Advisor ID 1
│   ├── client-abc-123.pdf
│   ├── client-abc-456.jpg
│   └── unassigned-789.pdf
├── 2/                          # Advisor ID 2
│   └── client-def-321.pdf
```

---

## Security

- ✅ **Private bucket** - Files not publicly accessible
- ✅ **Service role access** - Only backend can upload/delete
- ✅ **Signed URLs** - Download links expire after 1 hour
- ✅ **File validation** - Type and size checked before upload
- ✅ **User verification** - Only advisor's own files accessible

---

## Next Steps

After setting up the storage bucket:

1. ✅ Create `client-documents` bucket in Supabase
2. ✅ Disable RLS or add service role policy
3. ✅ Test upload from frontend
4. ✅ Verify files appear in Supabase Storage

---

## Quick Commands

### Create bucket via Supabase API (Alternative)

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/storage/v1/bucket' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "client-documents",
    "public": false,
    "file_size_limit": 52428800
  }'
```

Replace:
- `YOUR_PROJECT` with your Supabase project ID
- `YOUR_SERVICE_ROLE_KEY` with your service role key

---

## Support

If you encounter issues:

1. Check Supabase Dashboard → Storage → client-documents
2. Check backend logs on Render for detailed error messages
3. Check browser console for frontend errors
4. Verify environment variables are set correctly

