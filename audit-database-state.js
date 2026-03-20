#!/usr/bin/env node

/**
 * Database Audit Script
 * Checks the current state of calendar connections, meetings, clients, and user data
 * for user snaka1003@gmail.com (ID: 4c903cdf-85ba-4608-8be9-23ec8bbbaa7d)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
const USER_EMAIL = 'snaka1003@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function auditDatabase() {
  console.log('🔍 AUDITING DATABASE STATE FOR USER:', USER_EMAIL);
  console.log('   User ID:', USER_ID);
  console.log('━'.repeat(80));

  try {
    // 1. Check user record
    console.log('\n1️⃣  USER RECORD:');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, tenant_id, created_at')
      .eq('id', USER_ID)
      .single();

    if (userError) {
      console.error('   ❌ Error fetching user:', userError.message);
    } else if (user) {
      console.log('   ✅ User found:');
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.name}`);
      console.log(`      Tenant ID: ${user.tenant_id || '❌ NULL'}`);
      console.log(`      Created: ${user.created_at}`);
    } else {
      console.log('   ❌ User not found');
    }

    // 2. Check calendar connections
    console.log('\n2️⃣  CALENDAR CONNECTIONS:');
    const { data: connections, error: connError } = await supabase
      .from('calendar_connections')
      .select('id, provider, is_active, created_at, last_sync_at')
      .eq('user_id', USER_ID);

    if (connError) {
      console.error('   ❌ Error fetching connections:', connError.message);
    } else if (connections && connections.length > 0) {
      console.log(`   ✅ Found ${connections.length} connection(s):`);
      connections.forEach((conn, idx) => {
        console.log(`      ${idx + 1}. Provider: ${conn.provider}, Active: ${conn.is_active}, Last Sync: ${conn.last_sync_at || 'Never'}`);
      });
    } else {
      console.log('   ⚠️  No calendar connections found (empty)');
    }

    // 3. Check Calendly meetings
    console.log('\n3️⃣  CALENDLY MEETINGS:');
    const { data: calendlyMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, meeting_source, created_at')
      .eq('user_id', USER_ID)
      .eq('meeting_source', 'calendly');

    if (meetingsError) {
      console.error('   ❌ Error fetching meetings:', meetingsError.message);
    } else if (calendlyMeetings && calendlyMeetings.length > 0) {
      console.log(`   ⚠️  Found ${calendlyMeetings.length} stale Calendly meeting(s):`);
      calendlyMeetings.forEach((meeting, idx) => {
        console.log(`      ${idx + 1}. "${meeting.title}" (Created: ${meeting.created_at})`);
      });
    } else {
      console.log('   ✅ No Calendly meetings found (clean)');
    }

    // 4. Check all meetings count
    console.log('\n4️⃣  ALL MEETINGS:');
    const { data: allMeetings, error: allMeetingsError } = await supabase
      .from('meetings')
      .select('id, meeting_source')
      .eq('user_id', USER_ID);

    if (allMeetingsError) {
      console.error('   ❌ Error fetching all meetings:', allMeetingsError.message);
    } else {
      const sources = {};
      allMeetings?.forEach(m => {
        sources[m.meeting_source] = (sources[m.meeting_source] || 0) + 1;
      });
      console.log(`   Total meetings: ${allMeetings?.length || 0}`);
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`      - ${source}: ${count}`);
      });
    }

    // 5. Check clients
    console.log('\n5️⃣  CLIENTS:');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, created_at')
      .eq('user_id', USER_ID);

    if (clientsError) {
      console.error('   ❌ Error fetching clients:', clientsError.message);
    } else {
      console.log(`   Total clients: ${clients?.length || 0}`);
      if (clients && clients.length > 0) {
        clients.slice(0, 5).forEach((client, idx) => {
          console.log(`      ${idx + 1}. ${client.name} (${client.email})`);
        });
        if (clients.length > 5) {
          console.log(`      ... and ${clients.length - 5} more`);
        }
      }
    }

    console.log('\n' + '━'.repeat(80));
    console.log('✅ AUDIT COMPLETE\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

auditDatabase();

