const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { generateMeetingSummary } = require('../services/openai');

/**
 * Verify Recall.ai webhook signature
 * Uses HMAC-SHA256 with the API key
 */
function verifyRecallWebhookSignature(payload, signature, apiKey) {
  try {
    const hash = crypto
      .createHmac('sha256', apiKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    return hash === signature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
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
      console.warn(`⚠️  No meeting found for bot ${botId}`);
      return;
    }

    console.log(`📝 Processing transcript for meeting ${meeting.id}`);

    // Download transcript from URL if provided
    let transcriptText = meeting.transcript || '';
    if (data.transcript_url) {
      try {
        const response = await fetch(data.transcript_url);
        const transcriptData = await response.json();
        transcriptText = transcriptData.text || transcriptData.transcript || '';
      } catch (error) {
        console.error('Error downloading transcript:', error);
      }
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
      console.warn(`⚠️  No meeting found for bot ${botId}`);
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
      console.error('Error updating bot status:', updateError);
      return;
    }

    console.log(`✅ Bot status updated to "${status}" for meeting ${meeting.id}`);

  } catch (error) {
    console.error('Error handling bot status change:', error);
  }
}

/**
 * Main webhook endpoint
 * Receives events from Recall.ai
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-recall-signature'];
    const apiKey = process.env.RECALL_API_KEY;

    if (!signature || !apiKey) {
      console.error('❌ Missing signature or API key');
      return res.status(401).json({ error: 'Invalid request' });
    }

    // Verify webhook signature
    if (!verifyRecallWebhookSignature(req.body, signature, apiKey)) {
      console.error('❌ Invalid Recall webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Return 200 OK immediately (process async)
    res.status(200).json({ received: true });

    const { id: webhookId, bot_id, event_type, data } = req.body;

    console.log(`📥 Received Recall webhook: ${event_type} for bot ${bot_id}`);

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

    // Record webhook event
    await supabase
      .from('recall_webhook_events')
      .insert({
        webhook_id: webhookId,
        bot_id,
        event_type,
        status: data?.status,
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

