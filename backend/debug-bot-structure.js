#!/usr/bin/env node

/**
 * Debug script to show the exact bot structure from Recall.ai API
 */

require('dotenv').config();
const axios = require('axios');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const BASE_URL = 'https://us-west-2.recall.ai/api/v1';
const BOT_ID = '1135ddc6-6116-490b-a88e-1f2e2e737c23'; // From meeting 473

console.log('\n' + '='.repeat(80));
console.log('🔍 RECALL.AI BOT STRUCTURE DEBUG');
console.log('='.repeat(80));

async function debugBotStructure() {
  try {
    console.log(`\n📝 Fetching bot details for: ${BOT_ID}`);
    const botResponse = await axios.get(`${BASE_URL}/bot/${BOT_ID}/`, {
      headers: { 'Authorization': `Token ${RECALL_API_KEY}` }
    });

    const bot = botResponse.data;

    console.log('\n✅ Full Bot Response:');
    console.log(JSON.stringify(bot, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS');
    console.log('='.repeat(80));

    // Check recordings
    if (bot.recordings && bot.recordings.length > 0) {
      console.log(`\n✅ Found ${bot.recordings.length} recording(s):`);
      bot.recordings.forEach((rec, i) => {
        console.log(`\n   [${i + 1}] Recording:`);
        console.log(`       ID: ${rec.id}`);
        console.log(`       Status: ${rec.status}`);
        console.log(`       Keys: ${Object.keys(rec).join(', ')}`);

        // Check for transcript
        if (rec.media_shortcuts) {
          console.log(`       Media Shortcuts: ${Object.keys(rec.media_shortcuts).join(', ')}`);
          if (rec.media_shortcuts.transcript) {
            console.log(`       ✅ Transcript found!`);
            console.log(`          ${JSON.stringify(rec.media_shortcuts.transcript, null, 10)}`);
          }
        }
      });
    } else {
      console.log('\n❌ No recordings found');
    }

    // Check status_changes
    if (bot.status_changes && bot.status_changes.length > 0) {
      console.log(`\n✅ Status changes: ${bot.status_changes.length}`);
      bot.status_changes.slice(0, 3).forEach((change, i) => {
        console.log(`   [${i + 1}] ${change.code} at ${change.timestamp}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

debugBotStructure();

