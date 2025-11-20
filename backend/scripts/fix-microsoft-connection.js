#!/usr/bin/env node

/**
 * Script to fix existing Microsoft Calendar connections
 * This script will help users re-authenticate to get a valid refresh token
 * 
 * Usage:
 *   node backend/scripts/fix-microsoft-connection.js
 */

require('dotenv').config();
const { getSupabase } = require('../src/lib/supabase');

async function fixMicrosoftConnections() {
  console.log('🔧 Microsoft Calendar Connection Fix Script');
  console.log('='.repeat(80));
  
  try {
    const supabase = getSupabase();
    
    // Find all Microsoft calendar connections
    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'microsoft');
    
    if (error) {
      console.error('❌ Error fetching connections:', error);
      return;
    }
    
    if (!connections || connections.length === 0) {
      console.log('ℹ️  No Microsoft calendar connections found.');
      return;
    }
    
    console.log(`\n📊 Found ${connections.length} Microsoft calendar connection(s):\n`);
    
    for (const conn of connections) {
      console.log('─'.repeat(80));
      console.log(`Connection ID: ${conn.id}`);
      console.log(`User ID: ${conn.user_id}`);
      console.log(`Email: ${conn.provider_account_email}`);
      console.log(`Active: ${conn.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`Access Token: ${conn.access_token ? '✅ Present' : '❌ Missing'}`);
      console.log(`Refresh Token: ${conn.refresh_token ? '✅ Present' : '❌ Missing'}`);
      console.log(`Token Expires: ${conn.token_expires_at || 'Unknown'}`);
      console.log(`Created: ${conn.created_at}`);
      console.log(`Updated: ${conn.updated_at}`);
      
      // Check if refresh token is missing
      if (!conn.refresh_token) {
        console.log('\n⚠️  ISSUE: Refresh token is missing!');
        console.log('📋 ACTION REQUIRED:');
        console.log('   1. User needs to disconnect and reconnect their Microsoft Calendar');
        console.log('   2. Go to Settings → Calendar Connections');
        console.log('   3. Click "Disconnect" for Microsoft Calendar');
        console.log('   4. Click "Connect Microsoft Calendar" again');
        console.log('   5. Complete the OAuth flow');
        console.log('\n   OR use the Web Shell command below to mark for re-auth:\n');
        console.log(`   UPDATE calendar_connections SET is_active = false WHERE id = '${conn.id}';`);
      } else {
        console.log('\n✅ Connection looks good!');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Script completed');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixMicrosoftConnections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

