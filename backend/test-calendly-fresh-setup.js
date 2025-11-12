#!/usr/bin/env node

/**
 * 🧪 Calendly Fresh Setup Test
 * 
 * Tests the new Calendly OAuth credentials and webhook setup
 * Verifies:
 * 1. Environment variables are set correctly
 * 2. OAuth service is configured
 * 3. Webhook service is configured
 * 4. OAuth flow can be initiated
 */

require('dotenv').config();

console.log('🧪 Calendly Fresh Setup Test');
console.log('=' .repeat(70));

// Test 1: Check environment variables
console.log('\n✅ TEST 1: Environment Variables');
console.log('-' .repeat(70));

const requiredVars = {
  'CALENDLY_OAUTH_CLIENT_ID': process.env.CALENDLY_OAUTH_CLIENT_ID,
  'CALENDLY_OAUTH_CLIENT_SECRET': process.env.CALENDLY_OAUTH_CLIENT_SECRET,
  'CALENDLY_WEBHOOK_SIGNING_KEY': process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
  'BACKEND_URL': process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'
};

let allVarsSet = true;
Object.entries(requiredVars).forEach(([key, value]) => {
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    allVarsSet = false;
  }
});

if (!allVarsSet) {
  console.error('\n❌ Some environment variables are missing!');
  process.exit(1);
}

// Test 2: Check OAuth Service
console.log('\n✅ TEST 2: OAuth Service Configuration');
console.log('-' .repeat(70));

const CalendlyOAuthService = require('./src/services/calendlyOAuth');
const oauthService = new CalendlyOAuthService();

if (oauthService.isConfigured()) {
  console.log('✅ OAuth service is properly configured');
  console.log(`   Client ID: ${oauthService.clientId.substring(0, 20)}...`);
  console.log(`   Redirect URI: ${oauthService.redirectUri}`);
} else {
  console.error('❌ OAuth service is NOT configured');
  process.exit(1);
}

// Test 3: Check Webhook Service
console.log('\n✅ TEST 3: Webhook Service Configuration');
console.log('-' .repeat(70));

const CalendlyWebhookService = require('./src/services/calendlyWebhookService');
const webhookService = new CalendlyWebhookService('test-token');

if (webhookService.signingKey) {
  console.log('✅ Webhook signing key is set');
  console.log(`   Signing Key: ${webhookService.signingKey.substring(0, 20)}...`);
  console.log(`   Webhook URL: ${webhookService.webhookUrl}`);
} else {
  console.error('❌ Webhook signing key is NOT set');
  process.exit(1);
}

// Test 4: Generate OAuth URL
console.log('\n✅ TEST 4: OAuth Authorization URL');
console.log('-' .repeat(70));

try {
  const authUrl = oauthService.getAuthorizationUrl('test-state-123');
  console.log('✅ OAuth authorization URL generated successfully');
  console.log(`   URL: ${authUrl.substring(0, 100)}...`);
} catch (error) {
  console.error('❌ Failed to generate OAuth URL:', error.message);
  process.exit(1);
}

console.log('\n' + '=' .repeat(70));
console.log('✅ ALL TESTS PASSED!');
console.log('=' .repeat(70));
console.log('\n📋 Next Steps:');
console.log('1. Go to Settings → Calendar Integrations in Advicly');
console.log('2. Click the "+" button next to Calendly');
console.log('3. Complete the OAuth flow');
console.log('4. Monitor Render logs for webhook creation');
console.log('5. Create a test meeting in Calendly');
console.log('6. Verify it appears in Advicly within 5 seconds');

