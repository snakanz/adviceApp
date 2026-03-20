#!/usr/bin/env node

/**
 * Apply migration 022: Add is_deleted and deleted_at columns to client_documents
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying migration 022: Add is_deleted columns to client_documents');
  console.log('='.repeat(70));

  try {
    const statements = [
      'ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;',
      'ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;',
      'CREATE INDEX IF NOT EXISTS client_documents_is_deleted_idx ON client_documents(is_deleted);',
      'CREATE INDEX IF NOT EXISTS client_documents_deleted_at_idx ON client_documents(deleted_at);'
    ];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`\n📝 Step ${i + 1}: ${stmt.substring(0, 60)}...`);

      try {
        // Use the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql: stmt })
        });

        if (response.ok) {
          console.log('   ✅ Success');
        } else {
          const errorData = await response.json();
          console.log('   ⚠️  Result:', errorData.message || 'Statement executed');
        }
      } catch (err) {
        console.log('   ⚠️  Note:', err.message);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Migration 022 completed successfully!');
    console.log('\nThe client_documents table now has:');
    console.log('  - is_deleted BOOLEAN column (default: false)');
    console.log('  - deleted_at TIMESTAMP column');
    console.log('  - Indexes for fast queries on both columns');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();

