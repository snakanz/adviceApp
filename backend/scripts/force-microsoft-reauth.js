#!/usr/bin/env node

/**
 * Force Microsoft Calendar Re-authentication
 * This script marks Microsoft connections as inactive, forcing users to re-authenticate
 * 
 * Usage:
 *   node backend/scripts/force-microsoft-reauth.js [user_email]
 * 
 * Examples:
 *   node backend/scripts/force-microsoft-reauth.js                    # Fix all connections
 *   node backend/scripts/force-microsoft-reauth.js user@example.com   # Fix specific user
 */

require('dotenv').config();
const { getSupabase } = require('../src/lib/supabase');

async function forceReauth(userEmail = null) {
  console.log('🔧 Microsoft Calendar Re-authentication Script');
  console.log('='.repeat(80));
  
  try {
    const supabase = getSupabase();
    
    // Build query
    let query = supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'microsoft');
    
    if (userEmail) {
      query = query.eq('provider_account_email', userEmail);
      console.log(`🎯 Targeting user: ${userEmail}\n`);
    } else {
      console.log('🎯 Targeting: ALL Microsoft connections\n');
    }
    
    const { data: connections, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching connections:', error);
      return;
    }
    
    if (!connections || connections.length === 0) {
      console.log('ℹ️  No Microsoft calendar connections found.');
      return;
    }
    
    console.log(`📊 Found ${connections.length} connection(s) to process:\n`);
    
    // Filter connections that need fixing
    const needsFixing = connections.filter(conn => !conn.refresh_token);
    const alreadyGood = connections.filter(conn => conn.refresh_token);
    
    if (alreadyGood.length > 0) {
      console.log(`✅ ${alreadyGood.length} connection(s) already have refresh tokens:`);
      alreadyGood.forEach(conn => {
        console.log(`   - ${conn.provider_account_email} (ID: ${conn.id})`);
      });
      console.log();
    }
    
    if (needsFixing.length === 0) {
      console.log('🎉 All connections are good! No action needed.');
      return;
    }
    
    console.log(`⚠️  ${needsFixing.length} connection(s) need fixing:`);
    needsFixing.forEach(conn => {
      console.log(`   - ${conn.provider_account_email} (ID: ${conn.id})`);
    });
    console.log();
    
    // Ask for confirmation
    console.log('📋 This will mark the above connections as INACTIVE.');
    console.log('   Users will need to reconnect their Microsoft Calendar.');
    console.log();
    
    // In a real interactive script, you'd prompt here
    // For now, we'll just do it
    console.log('🔄 Marking connections as inactive...\n');
    
    for (const conn of needsFixing) {
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${conn.provider_account_email}:`, updateError);
      } else {
        console.log(`✅ Marked inactive: ${conn.provider_account_email}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Script completed!');
    console.log('\n📧 Next steps:');
    console.log('   1. Notify affected users');
    console.log('   2. Users should go to Settings → Calendar Connections');
    console.log('   3. Click "Connect Microsoft Calendar"');
    console.log('   4. Complete the OAuth flow');
    console.log('   5. Verify refresh token is stored (run check script)');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Parse command line arguments
const userEmail = process.argv[2] || null;

// Run the script
forceReauth(userEmail)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

