#!/usr/bin/env node

/**
 * Manually update a meeting with transcript for testing
 * This simulates what the webhook handler does
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'https://us-west-2.recall.ai/api/v1';

console.log('\n' + '='.repeat(80));
console.log('📝 MANUAL TRANSCRIPT UPDATE FOR TESTING');
console.log('='.repeat(80));

async function updateMeetingTranscript() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get completed meeting
    console.log('\n📋 Finding completed meeting...');
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, recall_bot_id, recall_status, transcript')
      .eq('recall_status', 'completed')
      .limit(1);

    if (!meetings || meetings.length === 0) {
      console.error('❌ No completed meetings found');
      return;
    }

    const meeting = meetings[0];
    const botId = meeting.recall_bot_id;

    console.log(`✅ Found meeting: ${meeting.id} - ${meeting.title}`);

    // Fetch transcript from Recall.ai
    console.log('\n📥 Fetching transcript from Recall.ai...');
    const botResponse = await axios.get(`${BASE_URL}/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${RECALL_API_KEY}` }
    });

    const bot = botResponse.data;
    const recording = bot.recordings[0];
    const transcriptUrl = recording.media_shortcuts?.transcript?.data?.download_url;

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
    }

    console.log(`✅ Transcript fetched: ${transcriptText.length} characters`);

    // Update meeting
    console.log('\n💾 Updating meeting in database...');
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: transcriptText,
        transcript_source: 'recall',
        recall_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', meeting.id);

    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return;
    }

    console.log(`✅ Meeting updated successfully!`);

    // Verify update
    console.log('\n✅ Verifying update...');
    const { data: updated } = await supabase
      .from('meetings')
      .select('id, title, transcript')
      .eq('id', meeting.id)
      .single();

    console.log(`   Meeting ID: ${updated.id}`);
    console.log(`   Title: ${updated.title}`);
    console.log(`   Transcript length: ${updated.transcript?.length || 0} characters`);
    console.log(`   Preview: "${updated.transcript?.substring(0, 100)}..."`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS: Meeting updated with transcript!');
    console.log('='.repeat(80));
    console.log('\nNow go to the Advicly app and:');
    console.log(`1. Click on meeting "${meeting.title}"`);
    console.log('2. Click on the "Transcript" tab');
    console.log('3. You should see the transcript displayed');
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

updateMeetingTranscript();

