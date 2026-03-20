#!/usr/bin/env node

/**
 * Test script to verify Calendly integration is working
 * Run this in your browser console after the backend redeploys
 */

const API_URL = 'https://adviceapp-9rgw.onrender.com';

async function testCalendlyIntegration() {
  console.log('🧪 Testing Calendly Integration...\n');

  // Get token from Supabase session
  const token = localStorage.getItem('supabase.auth.token') || 
                sessionStorage.getItem('supabase.auth.token');

  if (!token) {
    console.error('❌ No token found. Please log in first.');
    return;
  }

  let accessToken;
  try {
    const parsed = typeof token === 'string' ? JSON.parse(token) : token;
    accessToken = parsed.access_token;
  } catch (e) {
    console.error('❌ Failed to parse token:', e);
    return;
  }

  if (!accessToken) {
    console.error('❌ No access token in session');
    return;
  }

  console.log('✅ Token found');
  console.log(`📋 Token preview: ${accessToken.substring(0, 30)}...\n`);

  // Test 1: Check calendar connections
  console.log('📡 Test 1: Fetching calendar connections...');
  try {
    const response = await fetch(`${API_URL}/api/calendar-connections`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error(`   ❌ Error: ${error.error || error.message}`);
      return;
    }

    const data = await response.json();
    console.log(`   ✅ Success! Found ${data.connections.length} connection(s)`);
    
    data.connections.forEach(conn => {
      console.log(`   - ${conn.provider}: ${conn.provider_account_email} (active: ${conn.is_active})`);
    });
  } catch (err) {
    console.error(`   ❌ Network error: ${err.message}`);
    return;
  }

  // Test 2: Check Calendly status
  console.log('\n📡 Test 2: Checking Calendly connection status...');
  try {
    const response = await fetch(`${API_URL}/api/calendly/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error(`   ❌ Error: ${error.error || error.message}`);
    } else {
      const data = await response.json();
      console.log(`   ✅ Connected: ${data.connected}`);
      if (data.calendly_account) {
        console.log(`   📧 Account: ${data.calendly_account}`);
      }
    }
  } catch (err) {
    console.error(`   ❌ Network error: ${err.message}`);
  }

  // Test 3: Check meetings
  console.log('\n📡 Test 3: Fetching meetings...');
  try {
    const response = await fetch(`${API_URL}/api/dev/meetings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error(`   ❌ Error: ${error.error || error.message}`);
    } else {
      const data = await response.json();
      console.log(`   ✅ Found ${data.meetings?.length || 0} meetings`);
      
      // Count Calendly meetings
      const calendlyMeetings = data.meetings?.filter(m => m.meeting_source === 'calendly') || [];
      console.log(`   📅 Calendly meetings: ${calendlyMeetings.length}`);
    }
  } catch (err) {
    console.error(`   ❌ Network error: ${err.message}`);
  }

  console.log('\n✅ All tests completed!');
}

// Run the tests
testCalendlyIntegration();

