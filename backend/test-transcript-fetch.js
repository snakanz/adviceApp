#!/usr/bin/env node

/**
 * Test the new transcript fetching logic
 */

require('dotenv').config();
const axios = require('axios');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const BASE_URL = 'https://us-west-2.recall.ai/api/v1';
const BOT_ID = '1135ddc6-6116-490b-a88e-1f2e2e737c23'; // From meeting 473

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING NEW TRANSCRIPT FETCH LOGIC');
console.log('='.repeat(80));

async function testTranscriptFetch() {
  try {
    // Step 1: Fetch bot details
    console.log(`\n📝 Step 1: Fetching bot details for ${BOT_ID}...`);
    const botResponse = await axios.get(`${BASE_URL}/bot/${BOT_ID}/`, {
      headers: { 'Authorization': `Token ${RECALL_API_KEY}` }
    });

    const bot = botResponse.data;
    console.log(`✅ Bot found: ${bot.id}`);

    // Step 2: Check recordings
    if (!bot.recordings || bot.recordings.length === 0) {
      console.error('❌ No recordings found');
      return;
    }

    const recording = bot.recordings[0];
    console.log(`✅ Recording found: ${recording.id}`);
    console.log(`   Status: ${recording.status?.code}`);

    // Step 3: Get transcript URL
    if (!recording.media_shortcuts?.transcript?.data?.download_url) {
      console.error('❌ No transcript URL');
      return;
    }

    const transcriptUrl = recording.media_shortcuts.transcript.data.download_url;
    console.log(`✅ Transcript URL found`);

    // Step 4: Download transcript
    console.log(`\n📝 Step 2: Downloading transcript...`);
    const transcriptResponse = await axios.get(transcriptUrl);
    const transcriptData = transcriptResponse.data;

    console.log(`✅ Transcript downloaded`);
    console.log(`   Type: ${typeof transcriptData}`);
    console.log(`   Is Array: ${Array.isArray(transcriptData)}`);

    // Step 5: Parse transcript
    console.log(`\n📝 Step 3: Parsing transcript...`);
    let transcriptText = '';

    if (Array.isArray(transcriptData)) {
      console.log(`   Format: Array with ${transcriptData.length} segments`);
      console.log(`   First segment keys: ${Object.keys(transcriptData[0] || {}).join(', ')}`);
      
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
      console.log(`   Format: Object with segments`);
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
      console.log(`   Format: String`);
      transcriptText = transcriptData;
    } else {
      console.log(`   Format: Unknown object`);
      console.log(`   Keys: ${Object.keys(transcriptData).join(', ')}`);
      transcriptText = transcriptData.text || transcriptData.transcript || JSON.stringify(transcriptData);
    }

    console.log(`\n✅ Transcript parsed successfully!`);
    console.log(`   Length: ${transcriptText.length} characters`);
    console.log(`   Preview (first 200 chars):`);
    console.log(`   "${transcriptText.substring(0, 200)}..."`);

    if (transcriptText.length === 0) {
      console.warn('\n⚠️  WARNING: Transcript is empty!');
    } else {
      console.log(`\n✅ SUCCESS: Transcript is ready to be stored in database`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

testTranscriptFetch();

