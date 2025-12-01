const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { generateUnifiedMeetingSummary, adjustMeetingSummary } = require('../services/openai');

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
    // CRITICAL: Convert rawBody Buffer to string, otherwise it becomes "[object Object]"
    console.log(`\n🔍 DEBUG: rawBody type: ${typeof rawBody}, isBuffer: ${Buffer.isBuffer(rawBody)}`);
    console.log(`🔍 DEBUG: rawBody length: ${rawBody.length}`);

    let bodyString;
    if (Buffer.isBuffer(rawBody)) {
      bodyString = rawBody.toString('utf8');
    } else if (typeof rawBody === 'string') {
      bodyString = rawBody;
    } else {
      bodyString = String(rawBody);
    }

    const signedContent = `${svixId}.${svixTimestamp}.${bodyString}`;
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
 *
 * Recall.ai API structure:
 * bot.recordings[0].media_shortcuts.transcript.data.download_url
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

    // Check if bot has recordings
    if (!bot.recordings || bot.recordings.length === 0) {
      console.error('❌ No recordings found for bot');
      return null;
    }

    const recording = bot.recordings[0];
    console.log(`   Recording ID: ${recording.id}`);
    console.log(`   Status: ${recording.status?.code}`);

    // Check if recording has transcript
    if (!recording.media_shortcuts?.transcript?.data?.download_url) {
      console.error('❌ No transcript download URL in recording');
      return null;
    }

    const transcriptUrl = recording.media_shortcuts.transcript.data.download_url;
    console.log(`\n🔍 Step 2: Downloading transcript from URL...`);
    console.log(`   URL: ${transcriptUrl.substring(0, 100)}...`);

    // Download transcript JSON file
    const transcriptResponse = await axios.get(transcriptUrl);
    const transcriptData = transcriptResponse.data;

    console.log(`✅ Transcript file downloaded`);
    console.log(`   Type: ${typeof transcriptData}`);

    // Parse transcript based on format
    let transcriptText = '';

    if (Array.isArray(transcriptData)) {
      // If it's an array of segments, join them
      console.log(`   Format: Array with ${transcriptData.length} segments`);
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
      // If it has segments property
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
      // If it's already a string
      transcriptText = transcriptData;
    } else {
      // Try to extract text from common fields
      transcriptText = transcriptData.text || transcriptData.transcript || JSON.stringify(transcriptData);
    }

    console.log(`✅ Transcript parsed`);
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
async function handleTranscriptComplete(botId, data, userId) {
  try {
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available for transcript handling');
      return;
    }

    const supabase = getSupabase();

    // Find meeting by recall_bot_id AND user_id (prevents duplicate meeting issues)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, user_id, transcript')
      .eq('recall_bot_id', botId)
      .eq('user_id', userId)
      .single();

    if (meetingError || !meeting) {
      console.error(`❌ No meeting found for bot ${botId} and user ${userId}. Error: ${meetingError?.message || 'Not found'}`);
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
      if (!transcriptText || !transcriptText.trim()) {
        console.warn(`⚠️  No transcript text available for meeting ${meeting.id}`);
        return;
      }

      console.log(`🤖 Starting AI summary generation for meeting ${meeting.id}`);

      // Fetch full meeting data with client info for personalization
      const { data: fullMeeting, error: fetchError } = await supabase
        .from('meetings')
        .select(`
          *,
          client:clients(id, name, email)
        `)
        .eq('id', meeting.id)
        .single();

      if (fetchError || !fullMeeting) {
        console.error('Error fetching full meeting data:', fetchError);
        return;
      }

      // Extract client information for email personalization
      let clientName = 'Client';
      let clientEmail = null;

      if (fullMeeting?.client) {
        clientName = fullMeeting.client.name || fullMeeting.client.email.split('@')[0];
        clientEmail = fullMeeting.client.email;
      } else if (fullMeeting?.attendees) {
        try {
          const attendees = JSON.parse(fullMeeting.attendees);
          const clientAttendee = attendees.find(a => a.email);
          if (clientAttendee) {
            clientName = clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0];
            clientEmail = clientAttendee.email;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }


      // Use unified generator to get quick summary, email summary, detailed summary, and action points
      const unified = await generateUnifiedMeetingSummary(transcriptText, {
        clientName,
        includeDetailedSummary: true,
        maxActionItems: 7
      });

      let { quickSummary, emailSummary, detailedSummary, actionPointsArray } = unified;

      // Apply GPT-4 polish to the email summary for all users
      if (emailSummary) {
        try {
          const polishPrompt = 'Please refine this client follow-up email to improve clarity, tone, and professionalism without changing the factual content or adding any placeholders. Keep it in plain text with no markdown.';
          emailSummary = await adjustMeetingSummary(emailSummary, polishPrompt);
        } catch (polishError) {
          console.warn('⚠️  Premium polish failed, falling back to base email summary:', polishError.message);
        }
      }

      // Build actionPoints bullet string for storage (for backward compatibility)
      let actionPoints = '';
      if (Array.isArray(actionPointsArray) && actionPointsArray.length > 0) {
        actionPoints = '• ' + actionPointsArray.join('\n• ');
      } else {
        actionPointsArray = [];
      }

      // Save summaries to database
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          quick_summary: quickSummary,           // Single sentence for Clients page
          detailed_summary: detailedSummary,     // Structured format for Meetings page
          email_summary_draft: emailSummary,     // Email format (possibly premium polished)
          action_points: actionPoints,           // Action items for user
          last_summarized_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id);

      if (updateError) {
        console.error('Error saving summaries to database:', updateError);
        throw new Error('Failed to save summaries to database');
      }

      console.log('✅ Successfully saved summaries to database for meeting:', meeting.id);
      console.log('Quick summary length:', quickSummary?.length || 0);
      console.log('Detailed summary length:', detailedSummary?.length || 0);

      // Save individual action items to PENDING table (awaiting approval)
      console.log(`\n📋 Action Items Processing:`);
      console.log(`   Total action items extracted: ${actionPointsArray.length}`);
      console.log(`   Action items:`, actionPointsArray);

      if (actionPointsArray.length > 0) {
        console.log(`   Saving to pending_transcript_action_items table...`);

        // First, delete existing pending action items for this meeting
        const { error: deleteError } = await supabase
          .from('pending_transcript_action_items')
          .delete()
          .eq('meeting_id', meeting.id);

        if (deleteError) {
          console.warn(`⚠️  Error deleting old action items:`, deleteError);
        } else {
          console.log(`   ✅ Deleted old action items for meeting ${meeting.id}`);
        }

        // Insert new pending action items
        const actionItemsToInsert = actionPointsArray.map((actionText, index) => ({
          meeting_id: meeting.id,
          client_id: fullMeeting.client_id,
          advisor_id: meeting.user_id,
          action_text: actionText,
          display_order: index
        }));

        console.log(`   Inserting ${actionItemsToInsert.length} new action items:`, actionItemsToInsert);

        const { error: actionItemsError } = await supabase
          .from('pending_transcript_action_items')
          .insert(actionItemsToInsert);

        if (actionItemsError) {
          console.error('❌ Error saving pending action items:', actionItemsError);
          console.error('   Error details:', JSON.stringify(actionItemsError, null, 2));
          // Don't fail the whole request, just log the error
        } else {
          console.log(`✅ Saved ${actionPointsArray.length} PENDING action items for meeting ${meeting.id} (awaiting approval)`);
        }
      } else {
        console.log(`   ℹ️  No action items to save (array is empty)`);
      }

      console.log(`✅ Summary generation completed for meeting ${meeting.id}`);

    } catch (error) {
      console.error('Error generating summary:', error);
      // Don't fail the webhook if summary generation fails
    }

  } catch (error) {
    console.error('Error handling transcript completion:', error);
  }
}

/**
 * Map Recall.ai webhook status codes to valid database values
 */
function mapRecallStatusToDatabase(webhookStatus) {
  const statusMap = {
    'in_call_recording': 'recording',
    'call_ended': 'recording',
    'done': 'completed',
    'fatal': 'error',
    'failed': 'error',
    'processing': 'recording',
    'pending': 'pending',
    'recording': 'recording',
    'completed': 'completed',
    'error': 'error',
    'unknown': 'unknown'
  };

  return statusMap[webhookStatus] || 'unknown';
}

/**
 * Handle bot status change
 * Updates recall_status in database
 */
async function handleBotStatusChange(botId, data, userId) {
  try {
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available for status update');
      return;
    }

    const supabase = getSupabase();
    const webhookStatus = data.code || 'unknown';
    const webhookSubCode = data.sub_code || null;
    const dbStatus = mapRecallStatusToDatabase(webhookStatus);

    // Find meeting by recall_bot_id AND user_id (prevents duplicate meeting issues)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('recall_bot_id', botId)
      .eq('user_id', userId)
      .single();

    if (meetingError || !meeting) {
      console.error(`❌ No meeting found for bot ${botId} and user ${userId}. Error: ${meetingError?.message || 'Not found'}`);
      return;
    }

    // Build update object - always update status, optionally add sub_code to recall_error
    const updateData = {
      recall_status: dbStatus,
      updated_at: new Date().toISOString()
    };

    // Store sub_code in recall_error field for important status codes
    // This helps identify waiting room timeouts, no participants, etc.
    if (webhookSubCode) {
      updateData.recall_error = webhookSubCode;
      console.log(`📝 Storing sub_code "${webhookSubCode}" in recall_error`);
    }

    // Update recall_status with mapped value and optionally recall_error
    const { error: updateError } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', meeting.id);

    if (updateError) {
      console.error(`❌ Error updating bot status for meeting ${meeting.id}:`, updateError);
      return;
    }

    console.log(`✅ Bot status updated to "${dbStatus}" (webhook: "${webhookStatus}"${webhookSubCode ? `, sub_code: "${webhookSubCode}"` : ''}) for meeting ${meeting.id}`);

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
    const fullPayload = JSON.parse(req.body);

    // CRITICAL: Unwrap SVIX envelope
    // Svix wraps the actual event in a "data" field
    // Structure: { data: { bot: {...}, data: {...}, ... } }
    const payload = fullPayload.data || fullPayload;

    console.log(`🔍 DEBUG: Payload structure keys:`, Object.keys(payload));

    // Extract fields from actual Recall.ai webhook structure
    // The payload structure is: { bot: {...}, data: {...}, meeting_metadata: {...}, recording: {...} }
    const botId = payload.bot?.id;
    const eventCode = payload.data?.code;
    const eventSubCode = payload.data?.sub_code;
    const meetingId = payload.bot?.metadata?.meeting_id;
    const userId = payload.bot?.metadata?.user_id;

    // CRITICAL: Validate required fields
    if (!botId) {
      console.error('❌ CRITICAL: Bot ID missing from webhook payload');
      console.error('   Payload structure:', JSON.stringify(payload, null, 2));
      return res.status(400).json({ error: 'Bot ID missing from payload' });
    }

    if (!userId) {
      console.error('❌ CRITICAL: User ID missing from webhook metadata');
      console.error('   Bot metadata:', JSON.stringify(payload.bot?.metadata, null, 2));
      console.error('   This means the Recall bot was created without user_id in metadata');
      return res.status(400).json({ error: 'User ID missing from bot metadata' });
    }

    // Generate a unique webhook ID (SVIX ID is in headers, but we use bot_id + timestamp for uniqueness)
    const webhookId = `${botId}-${eventCode}-${Date.now()}`;

    // Map event code to event type
    const eventTypeMap = {
      'joining_call': 'bot.joining_call',
      'in_waiting_room': 'bot.in_waiting_room',
      'in_call_not_recording': 'bot.in_call_not_recording',
      'recording_permission_allowed': 'bot.recording_permission_allowed',
      'recording_permission_denied': 'bot.recording_permission_denied',
      'in_call_recording': 'bot.in_call_recording',
      'call_ended': 'bot.call_ended',
      'done': 'bot.done',
      'fatal': 'bot.fatal',
      'processing': 'transcript.processing'
    };

    const eventType = eventTypeMap[eventCode] || `bot.${eventCode}`;

    console.log(`✅ Payload parsed`);
    console.log(`   Webhook ID: ${webhookId}`);
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Event Type: ${eventType}`);
    console.log(`   Event Code: ${eventCode}`);
    console.log(`   Meeting ID: ${meetingId}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Data:`, JSON.stringify(payload.data, null, 2));

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
        bot_id: botId,
        event_type: eventType,
        status: eventCode,
        payload: JSON.stringify(payload),
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error recording webhook:', insertError);
      return;
    }

    console.log(`✅ Webhook event recorded`);

    // Handle event types
    console.log(`\n🎯 Processing event type: ${eventType} (code: ${eventCode})`);

    // Handle bot status changes
    if (eventCode === 'in_call_recording') {
      console.log(`✅ Bot is recording for meeting ${meetingId}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode }, userId);
    } else if (eventCode === 'call_ended') {
      console.log(`✅ Call ended for bot ${botId}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode }, userId);
    } else if (eventCode === 'done') {
      console.log(`✅ Bot processing complete for ${botId}`);
      // Transcript should be ready now
      await handleTranscriptComplete(botId, payload, userId);
    } else if (eventCode === 'fatal') {
      console.error(`❌ Bot encountered fatal error: ${eventSubCode}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode }, userId);
    } else if (eventCode === 'processing') {
      console.log(`⏳ Transcript processing for bot ${botId}`);
    } else {
      console.log(`ℹ️  Bot status: ${eventCode}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode }, userId);
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

