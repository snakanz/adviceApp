/**
 * Storage Bucket Consolidation Script
 * 
 * This script migrates all files from 'meeting-documents' bucket to 'client-documents' bucket
 * and updates the database records accordingly.
 * 
 * Run this AFTER the database migration (021_full_document_consolidation.sql)
 * 
 * Usage: node backend/scripts/consolidate-storage-buckets.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_BUCKET = 'meeting-documents';
const TARGET_BUCKET = 'client-documents';
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set to 'true' to test without making changes

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Main consolidation function
 */
async function consolidateStorageBuckets() {
  console.log('🚀 Starting storage bucket consolidation...');
  console.log(`   Source: ${SOURCE_BUCKET}`);
  console.log(`   Target: ${TARGET_BUCKET}`);
  console.log(`   Dry Run: ${DRY_RUN ? 'YES (no changes will be made)' : 'NO (will make changes)'}`);
  console.log('');

  try {
    // Step 1: Get all documents that need migration
    console.log('📋 Step 1: Fetching documents from meeting-documents bucket...');
    const { data: documents, error: fetchError } = await supabase
      .from('client_documents')
      .select('*')
      .eq('storage_bucket', SOURCE_BUCKET)
      .eq('is_deleted', false);

    if (fetchError) {
      throw new Error(`Failed to fetch documents: ${fetchError.message}`);
    }

    console.log(`   Found ${documents.length} documents to migrate`);
    console.log('');

    if (documents.length === 0) {
      console.log('✅ No documents to migrate. Consolidation complete!');
      return;
    }

    // Step 2: Migrate each file
    console.log('📦 Step 2: Migrating files...');
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const progress = `[${i + 1}/${documents.length}]`;
      
      try {
        console.log(`${progress} Migrating: ${doc.original_name}`);
        console.log(`   Source path: ${doc.storage_path}`);

        // Download file from source bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(SOURCE_BUCKET)
          .download(doc.storage_path);

        if (downloadError) {
          throw new Error(`Download failed: ${downloadError.message}`);
        }

        // Generate new path in target bucket
        // Format: {advisor_id}/{filename}
        const fileName = doc.file_name;
        const newPath = `${doc.advisor_id}/${fileName}`;
        console.log(`   Target path: ${newPath}`);

        if (!DRY_RUN) {
          // Upload to target bucket
          const { error: uploadError } = await supabase.storage
            .from(TARGET_BUCKET)
            .upload(newPath, fileData, {
              contentType: doc.file_type,
              upsert: false // Don't overwrite if exists
            });

          if (uploadError) {
            // If file already exists, that's okay - skip it
            if (uploadError.message.includes('already exists')) {
              console.log(`   ⚠️  File already exists in target, using existing file`);
            } else {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }
          }

          // Update database record
          const { error: updateError } = await supabase
            .from('client_documents')
            .update({
              storage_path: newPath,
              storage_bucket: TARGET_BUCKET,
              metadata: {
                ...doc.metadata,
                migrated_storage: {
                  from_bucket: SOURCE_BUCKET,
                  from_path: doc.storage_path,
                  migrated_at: new Date().toISOString()
                }
              }
            })
            .eq('id', doc.id);

          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
          }

          console.log(`   ✅ Migrated successfully`);
        } else {
          console.log(`   ✅ Would migrate (dry run)`);
        }

        successCount++;

      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        errorCount++;
        errors.push({
          document: doc.original_name,
          id: doc.id,
          error: err.message
        });
      }

      console.log('');
    }

    // Step 3: Summary
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total documents: ${documents.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('');

    if (errors.length > 0) {
      console.log('❌ ERRORS:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.document} (${err.id})`);
        console.log(`   ${err.error}`);
      });
      console.log('');
    }

    if (!DRY_RUN && successCount > 0) {
      console.log('');
      console.log('⚠️  NEXT STEPS:');
      console.log('1. Verify all files are accessible in the new bucket');
      console.log('2. Test document downloads in the application');
      console.log('3. After verification (recommended: 7 days), delete old files:');
      console.log(`   node backend/scripts/cleanup-old-storage-bucket.js`);
      console.log('');
    }

    if (DRY_RUN) {
      console.log('');
      console.log('ℹ️  This was a DRY RUN - no changes were made');
      console.log('   To perform the actual migration, run:');
      console.log('   DRY_RUN=false node backend/scripts/consolidate-storage-buckets.js');
      console.log('');
    }

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Verify bucket access
 */
async function verifyBuckets() {
  console.log('🔍 Verifying bucket access...');
  
  // Check source bucket
  const { data: sourceList, error: sourceError } = await supabase.storage
    .from(SOURCE_BUCKET)
    .list('', { limit: 1 });

  if (sourceError) {
    console.error(`❌ Cannot access source bucket '${SOURCE_BUCKET}': ${sourceError.message}`);
    return false;
  }

  // Check target bucket
  const { data: targetList, error: targetError } = await supabase.storage
    .from(TARGET_BUCKET)
    .list('', { limit: 1 });

  if (targetError) {
    console.error(`❌ Cannot access target bucket '${TARGET_BUCKET}': ${targetError.message}`);
    return false;
  }

  console.log('✅ Both buckets accessible');
  console.log('');
  return true;
}

/**
 * Run the script
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  STORAGE BUCKET CONSOLIDATION');
  console.log('═══════════════════════════════════════');
  console.log('');

  // Verify buckets exist and are accessible
  const bucketsOk = await verifyBuckets();
  if (!bucketsOk) {
    process.exit(1);
  }

  // Run consolidation
  await consolidateStorageBuckets();

  console.log('✅ Script completed');
  console.log('');
}

// Run the script
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

