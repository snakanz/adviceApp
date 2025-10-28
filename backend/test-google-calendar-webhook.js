#!/usr/bin/env node

/**
 * 🧪 Google Calendar Webhook Diagnostic Test
 * 
 * This script tests:
 * 1. Google Calendar connection status
 * 2. Webhook setup and storage
 * 3. Meeting data fetching
 * 4. Calendar switching behavior
 * 5. Webhook status determination
 */

require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');
const GoogleCalendarWebhookService = require('./src/services/googleCalendarWebhook');

const TEST_USER_ID = process.env.TEST_USER_ID || '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';

async function runTests() {
  console.log('🧪 Google Calendar Webhook Diagnostic Test Suite');
  console.log('=' .repeat(70));
  console.log(`Testing user: ${TEST_USER_ID}\n`);

  try {
    // Test 1: Check calendar connections
    console.log('\n📋 TEST 1: Calendar Connections');
    console.log('-' .repeat(70));
    await testCalendarConnections();

    // Test 2: Check webhook channel storage
    console.log('\n📡 TEST 2: Webhook Channel Storage');
    console.log('-' .repeat(70));
    await testWebhookChannelStorage();

    // Test 3: Check meeting data
    console.log('\n📅 TEST 3: Meeting Data');
    console.log('-' .repeat(70));
    await testMeetingData();

    // Test 4: Check webhook status determination
    console.log('\n⚡ TEST 4: Webhook Status Determination');
    console.log('-' .repeat(70));
    await testWebhookStatusDetermination();

    // Test 5: Simulate webhook setup
    console.log('\n🔧 TEST 5: Webhook Setup Simulation');
    console.log('-' .repeat(70));
    await testWebhookSetup();

    console.log('\n' + '=' .repeat(70));
    console.log('✅ All diagnostic tests completed!');
    console.log('=' .repeat(70));

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

async function testCalendarConnections() {
  try {
    const supabase = getSupabase();
    
    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', TEST_USER_ID);

    if (error) {
      console.error('❌ Error fetching connections:', error);
      return;
    }

    console.log(`✅ Found ${connections.length} calendar connection(s)`);
    
    connections.forEach((conn, idx) => {
      console.log(`\n  Connection ${idx + 1}:`);
      console.log(`    Provider: ${conn.provider}`);
      console.log(`    Active: ${conn.is_active}`);
      console.log(`    Email: ${conn.provider_account_email || 'N/A'}`);
      console.log(`    Has Access Token: ${!!conn.access_token}`);
      console.log(`    Has Refresh Token: ${!!conn.refresh_token}`);
      console.log(`    Last Sync: ${conn.last_sync_at || 'Never'}`);
      console.log(`    Created: ${new Date(conn.created_at).toLocaleString()}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testWebhookChannelStorage() {
  try {
    const supabase = getSupabase();
    
    const { data: channels, error } = await supabase
      .from('calendar_watch_channels')
      .select('*')
      .eq('user_id', TEST_USER_ID);

    if (error) {
      console.error('❌ Error fetching watch channels:', error);
      return;
    }

    if (!channels || channels.length === 0) {
      console.log('⚠️  No webhook channels found in database');
      console.log('   This explains why webhook status shows "polling"');
      return;
    }

    console.log(`✅ Found ${channels.length} webhook channel(s)`);
    
    channels.forEach((channel, idx) => {
      const expiration = new Date(channel.expiration);
      const now = new Date();
      const isExpired = expiration < now;
      const daysUntilExpiration = Math.ceil((expiration - now) / (1000 * 60 * 60 * 24));

      console.log(`\n  Channel ${idx + 1}:`);
      console.log(`    Channel ID: ${channel.channel_id}`);
      console.log(`    Resource ID: ${channel.resource_id}`);
      console.log(`    Expiration: ${expiration.toLocaleString()}`);
      console.log(`    Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
      console.log(`    Days Until Expiration: ${daysUntilExpiration}`);
      console.log(`    Created: ${new Date(channel.created_at).toLocaleString()}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testMeetingData() {
  try {
    const supabase = getSupabase();
    
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('starttime', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching meetings:', error);
      return;
    }

    console.log(`✅ Found ${meetings.length} recent meetings`);
    
    if (meetings.length === 0) {
      console.log('   ⚠️  No meetings found - webhook may not be syncing');
      return;
    }

    // Group by source
    const bySource = meetings.reduce((acc, m) => {
      const source = m.meeting_source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    console.log('\n  Meetings by source:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`    ${source}: ${count}`);
    });

    console.log('\n  Recent meetings:');
    meetings.slice(0, 3).forEach((m, idx) => {
      console.log(`    ${idx + 1}. ${m.title || 'Untitled'}`);
      console.log(`       Start: ${new Date(m.starttime).toLocaleString()}`);
      console.log(`       Source: ${m.meeting_source || 'unknown'}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testWebhookStatusDetermination() {
  try {
    const supabase = getSupabase();
    
    // Get active Google connection
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single();

    if (!connection) {
      console.log('⚠️  No active Google Calendar connection');
      return;
    }

    console.log('✅ Active Google Calendar connection found');
    console.log(`   Email: ${connection.provider_account_email}`);

    // Check webhook status (same logic as backend)
    const { data: watchChannel } = await supabase
      .from('calendar_watch_channels')
      .select('expiration, created_at')
      .eq('user_id', TEST_USER_ID)
      .single();

    if (!watchChannel) {
      console.log('\n❌ PROBLEM IDENTIFIED:');
      console.log('   No webhook channel found in calendar_watch_channels table');
      console.log('   This is why UI shows "🕐 Polling sync (15 min)"');
      console.log('\n   Possible causes:');
      console.log('   1. Webhook setup failed during connection');
      console.log('   2. Webhook channel was deleted');
      console.log('   3. Webhook setup was never called');
      return;
    }

    const expirationDate = new Date(watchChannel.expiration);
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));

    console.log('\n✅ Webhook channel found:');
    console.log(`   Expiration: ${expirationDate.toLocaleString()}`);
    console.log(`   Days until expiration: ${daysUntilExpiration}`);

    if (daysUntilExpiration > 0) {
      console.log(`   Status: ✅ WEBHOOK SHOULD BE ACTIVE`);
      console.log('   But UI shows polling - check backend logs');
    } else {
      console.log(`   Status: ❌ WEBHOOK EXPIRED`);
      console.log('   Needs renewal or re-setup');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testWebhookSetup() {
  try {
    console.log('⚠️  This test requires valid Google credentials');
    console.log('   Skipping actual webhook setup to avoid errors');
    console.log('\n   To manually test webhook setup:');
    console.log('   1. Disconnect Google Calendar in Settings');
    console.log('   2. Reconnect Google Calendar');
    console.log('   3. Check backend logs for "Setting up Google Calendar watch"');
    console.log('   4. Verify entry appears in calendar_watch_channels table');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
runTests().catch(console.error);

