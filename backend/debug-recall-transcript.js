#!/usr/bin/env node

/**
 * Debug script to test Recall.ai transcript fetching
 * Tests the API endpoints and shows what data is being returned
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'https://us-west-2.recall.ai/api/v1';

console.log('\n' + '='.repeat(70));
console.log('🔍 RECALL.AI TRANSCRIPT DEBUG');
console.log('='.repeat(70));

// Check environment
console.log('\n📋 Environment Check:');
console.log(`   RECALL_API_KEY: ${RECALL_API_KEY ? '✅ Present' : '❌ MISSING'}`);
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Present' : '❌ MISSING'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✅ Present' : '❌ MISSING'}`);

if (!RECALL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing required environment variables');
  process.exit(1);
}

async function debugRecallTranscript() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Get meetings with recall_bot_id
    console.log('\n' + '='.repeat(70));
    console.log('📊 Step 1: Fetching meetings with Recall bots');
    console.log('='.repeat(70));

    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, recall_bot_id, recall_status, transcript')
      .not('recall_bot_id', 'is', null)
      .limit(5);

    if (meetingsError) {
      console.error('❌ Error fetching meetings:', meetingsError);
      return;
    }

    console.log(`\n✅ Found ${meetings.length} meetings with Recall bots:`);
    meetings.forEach((m, i) => {
      console.log(`\n   [${i + 1}] Meeting ID: ${m.id}`);
      console.log(`       Title: ${m.title}`);
      console.log(`       Bot ID: ${m.recall_bot_id}`);
      console.log(`       Status: ${m.recall_status}`);
      console.log(`       Transcript: ${m.transcript ? `✅ ${m.transcript.substring(0, 50)}...` : '❌ EMPTY'}`);
    });

    if (meetings.length === 0) {
      console.log('\n⚠️  No meetings with Recall bots found');
      return;
    }

    // Step 2: Test API calls for first meeting
    const meeting = meetings[0];
    const botId = meeting.recall_bot_id;

    console.log('\n' + '='.repeat(70));
    console.log(`🤖 Step 2: Testing Recall.ai API for Bot: ${botId}`);
    console.log('='.repeat(70));

    // Test 2a: Get bot details
    console.log('\n📝 2a. Fetching bot details...');
    try {
      const botResponse = await axios.get(`${BASE_URL}/bot/${botId}/`, {
        headers: { 'Authorization': `Token ${RECALL_API_KEY}` }
      });

      const bot = botResponse.data;
      console.log('✅ Bot details retrieved:');
      console.log(`   ID: ${bot.id}`);
      console.log(`   Status: ${bot.status}`);
      console.log(`   Recording ID: ${bot.recording_id || '❌ MISSING'}`);
      console.log(`   Full response keys:`, Object.keys(bot));

      if (!bot.recording_id) {
        console.error('\n❌ PROBLEM: Bot has no recording_id!');
        console.log('   This is why transcript cannot be fetched');
        return;
      }

      // Test 2b: Get transcript
      console.log('\n📝 2b. Fetching transcript...');
      try {
        const transcriptResponse = await axios.get(
          `${BASE_URL}/recording/${bot.recording_id}/transcript/`,
          { headers: { 'Authorization': `Token ${RECALL_API_KEY}` } }
        );

        const transcript = transcriptResponse.data;
        console.log('✅ Transcript response retrieved:');
        console.log(`   Response keys:`, Object.keys(transcript));
        console.log(`   Full response:`, JSON.stringify(transcript, null, 2));

        // Check for transcript text
        const transcriptText = transcript.text || transcript.transcript || transcript.content || '';
        console.log(`\n   Transcript text found: ${transcriptText ? '✅ YES' : '❌ NO'}`);
        if (transcriptText) {
          console.log(`   Length: ${transcriptText.length} characters`);
          console.log(`   Preview: ${transcriptText.substring(0, 100)}...`);
        }

      } catch (error) {
        console.error('❌ Error fetching transcript:');
        console.error(`   Status: ${error.response?.status}`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Response:`, error.response?.data);
      }

    } catch (error) {
      console.error('❌ Error fetching bot details:');
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Response:`, error.response?.data);
    }

    // Step 3: Check webhook events
    console.log('\n' + '='.repeat(70));
    console.log('📨 Step 3: Checking webhook events');
    console.log('='.repeat(70));

    const { data: webhooks, error: webhooksError } = await supabase
      .from('recall_webhook_events')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (webhooksError) {
      console.error('❌ Error fetching webhooks:', webhooksError);
    } else {
      console.log(`\n✅ Found ${webhooks.length} webhook events for this bot:`);
      webhooks.forEach((w, i) => {
        console.log(`\n   [${i + 1}] Event Type: ${w.event_type}`);
        console.log(`       Status: ${w.status}`);
        console.log(`       Created: ${w.created_at}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Debug script error:', error.message);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Debug complete');
  console.log('='.repeat(70) + '\n');
}

debugRecallTranscript();

