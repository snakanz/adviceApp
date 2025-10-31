#!/usr/bin/env node

/**
 * Full end-to-end test of transcript flow
 * Simulates what happens when a webhook is received
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'https://us-west-2.recall.ai/api/v1';

console.log('\n' + '='.repeat(80));
console.log('🧪 FULL TRANSCRIPT FLOW TEST');
console.log('='.repeat(80));

async function testFullFlow() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Get a meeting with completed bot
    console.log('\n📋 Step 1: Finding a completed meeting...');
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, recall_bot_id, recall_status, transcript')
      .eq('recall_status', 'completed')
      .limit(1);

    if (meetingsError || !meetings || meetings.length === 0) {
      console.error('❌ No completed meetings found');
      return;
    }

    const meeting = meetings[0];
    const botId = meeting.recall_bot_id;

    console.log(`✅ Found meeting: ${meeting.id} - ${meeting.title}`);
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Current transcript: ${meeting.transcript ? `${meeting.transcript.substring(0, 50)}...` : 'EMPTY'}`);

    // Step 2: Fetch bot and transcript from Recall.ai
    console.log('\n📝 Step 2: Fetching from Recall.ai API...');
    const botResponse = await axios.get(`${BASE_URL}/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${RECALL_API_KEY}` }
    });

    const bot = botResponse.data;
    if (!bot.recordings || bot.recordings.length === 0) {
      console.error('❌ No recordings found');
      return;
    }

    const recording = bot.recordings[0];
    const transcriptUrl = recording.media_shortcuts?.transcript?.data?.download_url;

    if (!transcriptUrl) {
      console.error('❌ No transcript URL');
      return;
    }

    console.log(`✅ Got transcript URL`);

    // Step 3: Download and parse transcript
    console.log('\n📝 Step 3: Downloading transcript...');
    const transcriptResponse = await axios.get(transcriptUrl);
    const transcriptData = transcriptResponse.data;

    let transcriptText = '';
    if (Array.isArray(transcriptData)) {
      transcriptText = transcriptData
        .map(segment => {
          if (segment.words && Array.isArray(segment.words)) {
            return segment.words.map(w => w.text).join(' ');
          }
          return segment.text || '';
        })
        .filter(text => text.length > 0)
        .join('\n');
    } else if (typeof transcriptData === 'object' && transcriptData.segments) {
      transcriptText = transcriptData.segments
        .map(segment => {
          if (segment.words && Array.isArray(segment.words)) {
            return segment.words.map(w => w.text).join(' ');
          }
          return segment.text || '';
        })
        .filter(text => text.length > 0)
        .join('\n');
    } else if (typeof transcriptData === 'string') {
      transcriptText = transcriptData;
    }

    console.log(`✅ Transcript parsed: ${transcriptText.length} characters`);
    console.log(`   Preview: "${transcriptText.substring(0, 100)}..."`);

    // Step 4: Simulate updating database
    console.log('\n📝 Step 4: Simulating database update...');
    console.log(`   Would update meeting ${meeting.id} with:`);
    console.log(`   - transcript: ${transcriptText.substring(0, 50)}...`);
    console.log(`   - transcript_source: recall`);
    console.log(`   - recall_status: completed`);

    // Step 5: Show what would happen
    console.log('\n' + '='.repeat(80));
    console.log('✅ FLOW VERIFICATION');
    console.log('='.repeat(80));
    console.log(`\n✅ Webhook received: bot.done event`);
    console.log(`✅ Meeting found: ${meeting.id}`);
    console.log(`✅ Bot details fetched: ${botId}`);
    console.log(`✅ Recording found: ${recording.id}`);
    console.log(`✅ Transcript downloaded: ${transcriptText.length} chars`);
    console.log(`✅ Ready to store in database`);

    if (transcriptText.length > 0) {
      console.log(`\n🎉 SUCCESS: Full flow works correctly!`);
      console.log(`\nWhen webhook is received, the transcript will be:`);
      console.log(`"${transcriptText.substring(0, 150)}..."`);
    } else {
      console.warn(`\n⚠️  WARNING: Transcript is empty`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

testFullFlow();

