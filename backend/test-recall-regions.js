#!/usr/bin/env node

/**
 * Test which Recall.ai region your API key belongs to
 */

require('dotenv').config();
const axios = require('axios');

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const regions = [
  'us-east-1',
  'us-west-2',
  'eu-central-1',
  'ap-northeast-1'
];

console.log('\n' + '='.repeat(70));
console.log('🌍 Testing Recall.ai Regions');
console.log('='.repeat(70));
console.log(`\nTesting API key: ${RECALL_API_KEY.substring(0, 20)}...`);
console.log(`\nTrying regions: ${regions.join(', ')}\n`);

async function testRegions() {
  for (const region of regions) {
    const baseUrl = `https://${region}.recall.ai/api/v1`;
    console.log(`\n📍 Testing ${region}...`);
    console.log(`   URL: ${baseUrl}`);

    try {
      const response = await axios.get(`${baseUrl}/bot/`, {
        headers: { 'Authorization': `Token ${RECALL_API_KEY}` },
        timeout: 5000
      });

      console.log(`   ✅ SUCCESS! API key works for ${region}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return region;

    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`   ❌ 401 Unauthorized - Wrong region`);
      } else if (error.response?.status === 404) {
        console.log(`   ✅ 404 Not Found - But authentication works!`);
        console.log(`   This means the API key is valid for ${region}`);
        return region;
      } else {
        console.log(`   ⚠️  ${error.response?.status || 'Error'}: ${error.message}`);
      }
    }
  }

  console.log('\n❌ Could not determine region');
}

testRegions().then(region => {
  if (region) {
    console.log(`\n✅ Your API key is for: ${region}`);
    console.log(`\nUpdate backend/src/routes/recall-webhooks.js line 115:`);
    console.log(`   FROM: const baseUrl = 'https://us-west-2.recall.ai/api/v1';`);
    console.log(`   TO:   const baseUrl = 'https://${region}.recall.ai/api/v1';`);
  }
  console.log('\n' + '='.repeat(70) + '\n');
});

