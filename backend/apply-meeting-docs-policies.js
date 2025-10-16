#!/usr/bin/env node

/**
 * Apply RLS Policies for meeting-documents bucket
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function applyPolicies() {
  console.log('🔒 Applying RLS policies for meeting-documents bucket...\n');
  
  const policies = [
    {
      name: 'Users can upload meeting documents',
      sql: `
        CREATE POLICY "Users can upload meeting documents"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'meeting-documents' AND
            (storage.foldername(name))[1] = 'meetings'
        );
      `
    },
    {
      name: 'Users can read meeting documents',
      sql: `
        CREATE POLICY "Users can read meeting documents"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (
            bucket_id = 'meeting-documents'
        );
      `
    },
    {
      name: 'Users can update meeting documents',
      sql: `
        CREATE POLICY "Users can update meeting documents"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
            bucket_id = 'meeting-documents'
        );
      `
    },
    {
      name: 'Users can delete meeting documents',
      sql: `
        CREATE POLICY "Users can delete meeting documents"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'meeting-documents'
        );
      `
    }
  ];
  
  for (const policy of policies) {
    try {
      console.log(`📝 Creating policy: ${policy.name}`);
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        query: policy.sql 
      });
      
      if (error) {
        // Try alternative method - direct query
        const { error: queryError } = await supabase
          .from('_sql')
          .select('*')
          .limit(0);
        
        if (queryError) {
          console.log(`   ⚠️  Could not apply via API: ${error.message}`);
          console.log(`   Please run this SQL manually in Supabase Dashboard:`);
          console.log(policy.sql);
        }
      } else {
        console.log(`   ✅ Policy created successfully`);
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
  }
  
  console.log('\n🔍 Verifying policies...');
  
  // Check if policies exist
  const { data: existingPolicies, error: checkError } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'objects')
    .like('policyname', '%meeting documents%');
  
  if (checkError) {
    console.log('⚠️  Could not verify policies via API');
    console.log('\nPlease run this SQL in Supabase Dashboard > SQL Editor:\n');
    
    policies.forEach(p => {
      console.log(p.sql);
      console.log('');
    });
    
    console.log('\n📋 To verify, run:');
    console.log(`
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%meeting documents%';
    `);
  } else if (existingPolicies && existingPolicies.length > 0) {
    console.log('✅ Found existing policies:');
    existingPolicies.forEach(p => {
      console.log(`   - ${p.policyname} (${p.cmd})`);
    });
  } else {
    console.log('⚠️  No policies found. Please apply them manually.');
  }
}

async function main() {
  console.log('🚀 Meeting Documents Bucket - RLS Policy Setup');
  console.log('===============================================\n');
  
  try {
    await applyPolicies();
    
    console.log('\n✅ Setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Try uploading a document in the Advicly app');
    console.log('   2. Check Supabase Storage > meeting-documents bucket');
    console.log('   3. Check database > meeting_documents table for metadata\n');
    
  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    process.exit(1);
  }
}

main();

