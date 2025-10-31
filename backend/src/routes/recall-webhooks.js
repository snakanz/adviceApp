const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { generateMeetingSummary } = require('../services/openai');

/**
 * Verify Recall.ai webhook signature using Svix format
 * Uses HMAC-SHA256 with the webhook secret (not API key)
 * Signature format: msg_id.timestamp.signature
 */
function verifyRecallWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  try {
    if (!signatureHeader || !webhookSecret) {
      console.error('❌ Missing signature header or webhook secret');
      return false;
    }

    // Parse Svix signature format: msg_id.timestamp.signature
    const parts = signatureHeader.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid signature format. Expected: msg_id.timestamp.signature');
      return false;
    }

    const [msgId, timestamp, signature] = parts;

    // Reconstruct the signed content: msg_id.timestamp.body
    const signedContent = `${msgId}.${timestamp}.${rawBody}`;

    // Compute HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedContent)
      .digest('hex');

    // Compare signatures
    const isValid = hash === signature;

    if (!isValid) {
      console.error('❌ Webhook signature verification failed');
      console.error(`   Expected: ${signature}`);
      console.error(`   Got: ${hash}`);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
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

    if (!apiKey) {
      console.error('❌ RECALL_API_KEY not configured');
      return null;
    }

    console.log(`🔍 Fetching bot details for ${botId}...`);

    // Get bot details to find recording_id
    const botResponse = await axios.get(`${baseUrl}/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${apiKey}` }
    });

    const bot = botResponse.data;
    console.log(`✅ Bot details retrieved. Recording ID: ${bot.recording_id}`);

    if (!bot.recording_id) {
      console.warn(`⚠️  No recording_id found for bot ${botId}`);
      return null;
    }

    // Get transcript from recording
    console.log(`🔍 Fetching transcript for recording ${bot.recording_id}...`);
    const transcriptResponse = await axios.get(
      `${baseUrl}/recording/${bot.recording_id}/transcript/`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    );

    const transcript = transcriptResponse.data;
    const transcriptText = transcript.text || transcript.transcript || '';

    console.log(`✅ Transcript retrieved. Length: ${transcriptText.length} characters`);
    return transcriptText;
  } catch (error) {
    console.error('❌ Error fetching transcript from Recall:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
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
 * Main webhook endpoint
 * Receives events from Recall.ai using Svix
 * Uses raw body for signature verification
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signatureHeader = req.headers['x-recall-signature'];
    const webhookSecret = process.env.RECALL_WEBHOOK_SECRET;

    if (!signatureHeader || !webhookSecret) {
      console.error('❌ Missing signature header or RECALL_WEBHOOK_SECRET environment variable');
      return res.status(401).json({ error: 'Invalid request' });
    }

    // Verify webhook signature using raw body (Svix format)
    if (!verifyRecallWebhookSignature(req.body, signatureHeader, webhookSecret)) {
      console.error('❌ Invalid Recall webhook signature - rejecting event');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Return 200 OK immediately (process async)
    res.status(200).json({ received: true });

    // Parse body after verification
    const payload = JSON.parse(req.body);
    const { id: webhookId, bot_id, event_type, data } = payload;

    console.log(`📥 Received Recall webhook: ${event_type} for bot ${bot_id}`);
    console.log(`📋 Full payload:`, JSON.stringify(payload, null, 2));
    console.log(`📋 Data object:`, JSON.stringify(data, null, 2));

    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available');
      return;
    }

    const supabase = getSupabase();

    // Prevent duplicate processing
    const { data: existing, error: checkError } = await supabase
      .from('recall_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (existing) {
      console.log(`⏭️  Webhook ${webhookId} already processed`);
      return;
    }

    // Record webhook event with full payload for debugging
    await supabase
      .from('recall_webhook_events')
      .insert({
        webhook_id: webhookId,
        bot_id,
        event_type,
        status: data?.status,
        payload: JSON.stringify(data),  // ✅ Capture full data for debugging
        created_at: new Date().toISOString()
      });

    // Handle different event types
    if (event_type === 'transcript.done') {
      await handleTranscriptComplete(bot_id, data);
    } else if (event_type === 'bot.status_change') {
      await handleBotStatusChange(bot_id, data);
    } else if (event_type === 'recording.done') {
      console.log(`✅ Recording complete for bot ${bot_id}`);
    } else {
      console.log(`⚠️  Unhandled event type: ${event_type}`);
    }

  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Always return 200 to prevent Recall from retrying
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
    instructions: [
      '1. Go to Recall.ai dashboard → Webhooks',
      '2. Create new endpoint with URL above',
      '3. Subscribe to: transcript.done, bot.status_change, recording.done',
      '4. Recall will send events to this endpoint'
    ]
  });
});

module.exports = router;

