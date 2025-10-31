const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { generateMeetingSummary } = require('../services/openai');

/**
 * SVIX Webhook Verification (Correct Implementation)
 * Recall.ai uses Svix for webhook delivery
 */
function verifySvixSignature(rawBody, headers, webhookSecret) {
  try {
    console.log('\n🔐 SVIX SIGNATURE VERIFICATION');
    console.log('================================');

    // Extract SVIX headers
    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];

    console.log(`📋 Headers received:`);
    console.log(`   svix-id: ${svixId}`);
    console.log(`   svix-timestamp: ${svixTimestamp}`);
    console.log(`   svix-signature: ${svixSignature}`);
    console.log(`   webhook-secret: ${webhookSecret ? '✅ Present' : '❌ MISSING'}`);

    // Validate headers exist
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('❌ Missing SVIX headers!');
      console.error(`   Available headers:`, Object.keys(headers).filter(h => h.includes('svix') || h.includes('x-recall')));
      return false;
    }

    if (!webhookSecret) {
      console.error('❌ RECALL_WEBHOOK_SECRET environment variable not set!');
      return false;
    }

    // Construct signed content (Svix format)
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    console.log(`\n📝 Signed content (first 100 chars): ${signedContent.substring(0, 100)}...`);

    // Extract base64 secret (after 'whsec_' prefix)
    const secretParts = webhookSecret.split('_');
    if (secretParts.length !== 2) {
      console.error('❌ Invalid webhook secret format. Expected: whsec_<base64>');
      return false;
    }

    const secretBase64 = secretParts[1];
    console.log(`🔑 Secret (base64): ${secretBase64.substring(0, 20)}...`);

    // Decode base64 secret to bytes
    const secretBytes = Buffer.from(secretBase64, 'base64');
    console.log(`🔑 Secret bytes length: ${secretBytes.length}`);

    // Compute HMAC-SHA256
    const computedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    console.log(`\n✅ Computed signature: ${computedSignature}`);

    // Parse received signature (format: v1,<signature>)
    const signatureParts = svixSignature.split(',');
    if (signatureParts.length < 2) {
      console.error('❌ Invalid signature format. Expected: v1,<signature>');
      return false;
    }

    const [version, receivedSignature] = signatureParts;
    console.log(`📌 Received signature: ${receivedSignature}`);
    console.log(`📌 Version: ${version}`);

    // Compare signatures (constant-time comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(receivedSignature)
    );

    console.log(`\n${isValid ? '✅ SIGNATURE VALID' : '❌ SIGNATURE INVALID'}`);
    console.log('================================\n');

    return isValid;

  } catch (error) {
    console.error('❌ Error verifying SVIX signature:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Fetch transcript from Recall.ai API
 * Called when transcript.done webhook is received
 */
async function fetchTranscriptFromRecall(botId) {
  try {
    const apiKey = process.env.RECALL_API_KEY;
    const baseUrl = 'https://us-west-2.recall.ai/api/v1';

    console.log(`\n📥 FETCHING TRANSCRIPT FROM RECALL.AI`);
    console.log(`=====================================`);
    console.log(`Bot ID: ${botId}`);
    console.log(`API Key: ${apiKey ? '✅ Present' : '❌ MISSING'}`);

    if (!apiKey) {
      console.error('❌ RECALL_API_KEY not configured');
      return null;
    }

    // Fetch bot details first
    console.log(`\n🔍 Step 1: Fetching bot details...`);
    const botResponse = await axios.get(`${baseUrl}/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${apiKey}` }
    });

    const bot = botResponse.data;
    console.log(`✅ Bot found: ${bot.id}`);
    console.log(`   Recording ID: ${bot.recording_id}`);
    console.log(`   Status: ${bot.status}`);

    if (!bot.recording_id) {
      console.error('❌ No recording_id in bot data');
      return null;
    }

    // Fetch transcript
    console.log(`\n🔍 Step 2: Fetching transcript...`);
    const transcriptResponse = await axios.get(
      `${baseUrl}/recording/${bot.recording_id}/transcript/`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    );

    const transcript = transcriptResponse.data;
    const transcriptText = transcript.text || transcript.transcript || '';

    console.log(`✅ Transcript retrieved`);
    console.log(`   Length: ${transcriptText.length} characters`);
    console.log(`   Preview: ${transcriptText.substring(0, 100)}...`);
    console.log(`=====================================\n`);

    return transcriptText;
  } catch (error) {
    console.error('❌ Error fetching transcript:', error.message);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response:`, error.response.data);
    }
    return null;
  }
}

/**
 * Handle transcript completion
 * Downloads transcript and stores in database
 */
async function handleTranscriptComplete(botId, data) {
  try {
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available for transcript handling');
      return;
    }

    const supabase = getSupabase();

    // Find meeting by recall_bot_id
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, user_id, transcript')
      .eq('recall_bot_id', botId)
      .single();

    if (meetingError || !meeting) {
      console.error(`❌ No meeting found for bot ${botId}. Error: ${meetingError?.message || 'Not found'}`);
      return;
    }

    console.log(`📝 Processing transcript for meeting ${meeting.id}`);

    // Fetch transcript from Recall.ai API
    // Note: Recall.ai webhook does NOT include transcript_url, so we must fetch via API
    let transcriptText = meeting.transcript || '';
    const recallTranscript = await fetchTranscriptFromRecall(botId);
    if (recallTranscript) {
      transcriptText = recallTranscript;
      console.log(`✅ Transcript fetched from Recall.ai API`);
    } else {
      console.warn(`⚠️  Could not fetch transcript from Recall.ai API`);
    }

    // Update meeting with transcript
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
      console.error('Error updating meeting with transcript:', updateError);
      return;
    }

    console.log(`✅ Transcript stored for meeting ${meeting.id}`);

    // Trigger AI summary generation
    try {
      await generateMeetingSummary(meeting.id, meeting.user_id);
      console.log(`✅ Summary generation triggered for meeting ${meeting.id}`);
    } catch (error) {
      console.error('Error generating summary:', error);
      // Don't fail the webhook if summary generation fails
    }

  } catch (error) {
    console.error('Error handling transcript completion:', error);
  }
}

/**
 * Handle bot status change
 * Updates recall_status in database
 */
async function handleBotStatusChange(botId, data) {
  try {
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available for status update');
      return;
    }

    const supabase = getSupabase();
    const status = data.status || 'unknown';

    // Find meeting by recall_bot_id
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('recall_bot_id', botId)
      .single();

    if (meetingError || !meeting) {
      console.error(`❌ No meeting found for bot ${botId}. Error: ${meetingError?.message || 'Not found'}`);
      return;
    }

    // Update recall_status
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        recall_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', meeting.id);

    if (updateError) {
      console.error(`❌ Error updating bot status for meeting ${meeting.id}:`, updateError);
      return;
    }

    console.log(`✅ Bot status updated to "${status}" for meeting ${meeting.id}`);

  } catch (error) {
    console.error('Error handling bot status change:', error);
  }
}

/**
 * Main webhook endpoint - WITH COMPREHENSIVE DEBUGGING
 * Receives events from Recall.ai using Svix
 * Uses raw body for signature verification
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         RECALL.AI WEBHOOK RECEIVED                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Log all headers
    console.log('📨 ALL REQUEST HEADERS:');
    Object.entries(req.headers).forEach(([key, value]) => {
      if (key.includes('svix') || key.includes('recall') || key.includes('signature')) {
        console.log(`   ${key}: ${value}`);
      }
    });

    // Get webhook secret
    const webhookSecret = process.env.RECALL_WEBHOOK_SECRET;
    console.log(`\n🔑 Webhook Secret: ${webhookSecret ? '✅ Configured' : '❌ NOT CONFIGURED'}`);

    if (!webhookSecret) {
      console.error('❌ CRITICAL: RECALL_WEBHOOK_SECRET not set in environment!');
      console.error('   Set it in your .env file: RECALL_WEBHOOK_SECRET=whsec_...');
      return res.status(401).json({ error: 'Webhook secret not configured' });
    }

    // Verify SVIX signature
    console.log(`\n🔐 Verifying SVIX signature...`);
    if (!verifySvixSignature(req.body, req.headers, webhookSecret)) {
      console.error('❌ SIGNATURE VERIFICATION FAILED - Rejecting webhook');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature verified successfully!');

    // Return 200 immediately (process async)
    res.status(200).json({ received: true });

    // Parse payload
    console.log(`\n📦 Parsing payload...`);
    const payload = JSON.parse(req.body);
    const { id: webhookId, bot_id, event_type, data } = payload;

    console.log(`✅ Payload parsed`);
    console.log(`   Webhook ID: ${webhookId}`);
    console.log(`   Bot ID: ${bot_id}`);
    console.log(`   Event Type: ${event_type}`);
    console.log(`   Data:`, JSON.stringify(data, null, 2));

    // Check Supabase
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available!');
      return;
    }

    const supabase = getSupabase();

    // Prevent duplicates
    console.log(`\n🔍 Checking for duplicate webhooks...`);
    const { data: existing } = await supabase
      .from('recall_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (existing) {
      console.log(`⏭️  Webhook already processed (ID: ${webhookId})`);
      return;
    }

    console.log(`✅ New webhook (not a duplicate)`);

    // Record webhook event
    console.log(`\n💾 Recording webhook event in database...`);
    const { error: insertError } = await supabase
      .from('recall_webhook_events')
      .insert({
        webhook_id: webhookId,
        bot_id,
        event_type,
        status: data?.status,
        payload: JSON.stringify(data),
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error recording webhook:', insertError);
      return;
    }

    console.log(`✅ Webhook event recorded`);

    // Handle event types
    console.log(`\n🎯 Processing event type: ${event_type}`);

    if (event_type === 'transcript.done') {
      await handleTranscriptComplete(bot_id, data);
    } else if (event_type === 'bot.status_change') {
      await handleBotStatusChange(bot_id, data);
    } else if (event_type === 'recording.done') {
      console.log(`✅ Recording complete for bot ${bot_id}`);
    } else {
      console.log(`⚠️  Unhandled event type: ${event_type}`);
    }

    console.log('\n✅ WEBHOOK PROCESSING COMPLETE\n');

  } catch (error) {
    console.error('\n❌ WEBHOOK ERROR:', error.message);
    console.error(error.stack);
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Test endpoint to verify webhook is accessible
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    success: true,
    message: 'Recall.ai webhook endpoint is accessible',
    url: `${req.protocol}://${req.get('host')}/api/webhooks/webhook`,
    environment: {
      webhookSecretConfigured: !!process.env.RECALL_WEBHOOK_SECRET,
      apiKeyConfigured: !!process.env.RECALL_API_KEY,
      supabaseConfigured: !!process.env.SUPABASE_URL
    },
    instructions: [
      '1. Go to Recall.ai dashboard → Webhooks',
      '2. Create new endpoint with URL above',
      '3. Subscribe to: transcript.done, bot.status_change, recording.done',
      '4. Recall will send events to this endpoint'
    ]
  });
});

module.exports = router;

