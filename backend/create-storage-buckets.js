#!/usr/bin/env node

/**
 * Create Storage Buckets for Advicly Platform
 * 
 * This script creates the required Supabase storage buckets and sets up RLS policies:
 * 1. meeting-documents - For meeting attachments
 * 2. client-documents - For client-level documents
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createBucket(bucketName, options = {}) {
  console.log(`\n📦 Creating bucket: ${bucketName}`);
  
  // Check if bucket already exists
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error(`❌ Error checking existing buckets:`, listError.message);
    return false;
  }
  
  const bucketExists = existingBuckets.some(b => b.name === bucketName);
  
  if (bucketExists) {
    console.log(`✅ Bucket '${bucketName}' already exists`);
    return true;
  }
  
  // Create the bucket
  const { data, error } = await supabase.storage.createBucket(bucketName, {
    public: false, // Private bucket
    fileSizeLimit: 52428800, // 50MB in bytes
    allowedMimeTypes: null, // Allow all types (we validate in code)
    ...options
  });
  
  if (error) {
    console.error(`❌ Error creating bucket '${bucketName}':`, error.message);
    return false;
  }
  
  console.log(`✅ Bucket '${bucketName}' created successfully`);
  return true;
}

async function setupRLSPolicies() {
  console.log(`\n🔒 Setting up RLS policies...`);
  
  // Note: Storage RLS policies need to be created via SQL
  // We'll provide the SQL commands to run
  
  const policies = `
-- RLS Policies for meeting-documents bucket
CREATE POLICY "Users can upload meeting documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meeting-documents' AND
    (storage.foldername(name))[1] = 'meetings'
);

CREATE POLICY "Users can read meeting documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

CREATE POLICY "Users can update meeting documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

CREATE POLICY "Users can delete meeting documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
);

-- RLS Policies for client-documents bucket
CREATE POLICY "Users can upload client documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read client documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update client documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete client documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'client-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
`;

  console.log(`\n📋 RLS Policies SQL (run these in Supabase SQL Editor):`);
  console.log(policies);
  
  // Try to apply policies via RPC (if available)
  try {
    // Execute the SQL directly
    const { error } = await supabase.rpc('exec_sql', { sql: policies });
    
    if (error) {
      console.log(`\n⚠️  Could not auto-apply RLS policies via API`);
      console.log(`   Please run the SQL above in Supabase Dashboard > SQL Editor`);
    } else {
      console.log(`✅ RLS policies applied successfully`);
    }
  } catch (err) {
    console.log(`\n⚠️  Could not auto-apply RLS policies`);
    console.log(`   Please run the SQL above in Supabase Dashboard > SQL Editor`);
  }
}

async function verifyBuckets() {
  console.log(`\n🔍 Verifying buckets...`);
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error(`❌ Error listing buckets:`, error.message);
    return;
  }
  
  console.log(`\n📦 Existing buckets:`);
  buckets.forEach(bucket => {
    console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
  });
  
  // Check for our required buckets
  const requiredBuckets = ['meeting-documents', 'client-documents'];
  const missingBuckets = requiredBuckets.filter(
    name => !buckets.some(b => b.name === name)
  );
  
  if (missingBuckets.length === 0) {
    console.log(`\n✅ All required buckets exist!`);
  } else {
    console.log(`\n⚠️  Missing buckets: ${missingBuckets.join(', ')}`);
  }
}

async function main() {
  console.log('🚀 Advicly Storage Bucket Setup');
  console.log('================================\n');
  
  try {
    // Create buckets
    const bucket1 = await createBucket('meeting-documents');
    const bucket2 = await createBucket('client-documents');
    
    if (!bucket1 || !bucket2) {
      console.error('\n❌ Failed to create one or more buckets');
      process.exit(1);
    }
    
    // Setup RLS policies
    await setupRLSPolicies();
    
    // Verify
    await verifyBuckets();
    
    console.log('\n✅ Storage bucket setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. If RLS policies were not auto-applied, run the SQL in Supabase Dashboard');
    console.log('   2. Try uploading a document in the Advicly app');
    console.log('   3. Check Supabase Storage to see the uploaded file\n');
    
  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    process.exit(1);
  }
}

main();

