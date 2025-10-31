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

      // Generate Quick Summary (single sentence for Clients page)
      const quickSummaryPrompt = `# SYSTEM PROMPT: Advicly Quick Summary Generator
You are an expert financial advisor creating a single-sentence summary of a client meeting.

Generate ONE concise sentence that captures what was discussed in the meeting. Focus on the main topic or purpose of the meeting.

Examples:
- "Discussed client's retirement planning goals and reviewed current 401k allocation."
- "Reviewed portfolio performance and explored ESG investment opportunities."
- "Initial consultation covering financial goals, risk tolerance, and investment preferences."

Transcript:
${transcriptText}

Respond with ONLY the single sentence summary, no additional text.`;

      const quickSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: quickSummaryPrompt });

      // Generate Detailed Summary (structured format for Meetings page)
      const detailedSummaryPrompt = `# SYSTEM PROMPT: Advicly Detailed Summary Generator
You are an expert financial advisor creating a structured summary of a client meeting.

Generate a summary in this exact format:

[Single sentence overview of what was discussed]

**Key Points Discussed:**
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3 if applicable]

**Important Decisions or Outcomes:**
[Brief description of any decisions made or outcomes reached]

**Next Steps:**
[What will happen next or action items]

Keep it professional and concise. Use the exact format shown above.

Transcript:
${transcriptText}`;

      const detailedSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: detailedSummaryPrompt });

      // Generate Email Summary using Auto template with client name
      const autoTemplate = `Role: You are Nelson Greenwood, a professional financial advisor creating a concise follow-up email for a client.

Goal: Generate a brief, clean email (NO markdown formatting) that summarizes the meeting and confirms next steps.

Constraints:
1. NO markdown symbols (no **, ##, *, or bullet points)
2. Keep it SHORT - maximum 200 words total
3. Use plain text with simple numbered lists
4. Professional but warm tone
5. Include specific numbers/dates from the transcript
6. Focus on what matters most to the client

Format:

Hi ${clientName},

[One sentence: pleasure meeting + main topic discussed]

[2-3 short paragraphs covering the key points with specific numbers/details]

Best regards,
Nelson Greenwood
Financial Advisor

Transcript:
${transcriptText}

Respond with the **email body only** — no headers or subject lines.`;

      const emailSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: autoTemplate });

      // Extract action items from transcript
      const actionPointsPrompt = `You are an AI assistant that extracts action items from meeting transcripts.

Extract ONLY concrete, actionable tasks from this meeting transcript.

INCLUDE ONLY:
- Specific tasks with clear deliverables (e.g., "Send the updated Suitability Letter")
- Follow-up meetings to schedule (e.g., "Schedule follow-up meeting after budget")
- Documents to send, sign, or complete (e.g., "Complete internal BA check")
- Account setups or administrative tasks (e.g., "Set up online account logins")
- Client-facing actions that must be DONE (not discussed)

EXCLUDE:
- Advisor preparation work (e.g., "Research...", "Prepare information...")
- Discussion topics (e.g., "Discuss...", "Review options...")
- General notes or meeting agenda items
- Vague or exploratory items
- Anything that is not a concrete action

CRITICAL: Return ONLY a valid JSON array of strings. No markdown, no code blocks, no explanations.
Format: ["action 1", "action 2", "action 3"]
Limit: Maximum 5-7 most important action items.

Transcript:
${transcriptText}

Return only the JSON array:`;

      const actionPointsResponse = await generateMeetingSummary(transcriptText, 'standard', { prompt: actionPointsPrompt });

      // Parse action points JSON with robust error handling
      let actionPointsArray = [];
      let actionPoints = actionPointsResponse;

      try {
        // Clean the response - remove markdown code blocks if present
        let cleanedResponse = actionPointsResponse.trim();

        // Remove markdown code block markers
        cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

        // Try to extract JSON array from the response
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        // Parse the JSON
        const parsed = JSON.parse(cleanedResponse);

        if (Array.isArray(parsed)) {
          // Filter out invalid entries (empty strings, non-strings, broken JSON fragments)
          actionPointsArray = parsed
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .filter(item => {
              // Exclude broken JSON artifacts
              const trimmed = item.trim();
              return trimmed !== 'json' &&
                     trimmed !== '[' &&
                     trimmed !== ']' &&
                     trimmed !== '"""' &&
                     trimmed !== '"' &&
                     trimmed !== '{' &&
                     trimmed !== '}' &&
                     !trimmed.match(/^["'\[\]{}]+$/);
            })
            .map(item => item.trim())
            .slice(0, 7); // Enforce max 7 items

          // Convert to bullet list for display
          actionPoints = actionPointsArray.join('\n• ');
          if (actionPoints) actionPoints = '• ' + actionPoints;
        } else {
          console.warn('Action points response is not an array:', parsed);
          actionPointsArray = [];
          actionPoints = '';
        }
      } catch (e) {
        console.error('Failed to parse action points JSON:', e.message);
        console.error('Raw response:', actionPointsResponse);

        // Fallback: try to extract clean bullet points from plain text
        const lines = actionPointsResponse
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => line.replace(/^[•\-\*\d]+[\.\)]\s*/, '').trim())
          .filter(line => {
            // Exclude broken JSON artifacts and invalid entries
            return line.length > 10 && // Minimum length for valid action item
                   line !== 'json' &&
                   line !== '[' &&
                   line !== ']' &&
                   line !== '"""' &&
                   !line.match(/^["'\[\]{}]+$/) &&
                   !line.toLowerCase().startsWith('research') &&
                   !line.toLowerCase().startsWith('prepare to discuss');
          })
          .slice(0, 7);

        actionPointsArray = lines;
        actionPoints = lines.length > 0 ? '• ' + lines.join('\n• ') : '';
      }

      // Save summaries to database
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          quick_summary: quickSummary,           // Single sentence for Clients page
          detailed_summary: detailedSummary,     // Structured format for Meetings page
          email_summary_draft: emailSummary,     // Email format
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
      if (actionPointsArray.length > 0) {
        // First, delete existing pending action items for this meeting
        await supabase
          .from('pending_transcript_action_items')
          .delete()
          .eq('meeting_id', meeting.id);

        // Insert new pending action items
        const actionItemsToInsert = actionPointsArray.map((actionText, index) => ({
          meeting_id: meeting.id,
          client_id: fullMeeting.client_id,
          advisor_id: meeting.user_id,
          action_text: actionText,
          display_order: index
        }));

        const { error: actionItemsError } = await supabase
          .from('pending_transcript_action_items')
          .insert(actionItemsToInsert);

        if (actionItemsError) {
          console.error('Error saving pending action items:', actionItemsError);
          // Don't fail the whole request, just log the error
        } else {
          console.log(`✅ Saved ${actionPointsArray.length} PENDING action items for meeting ${meeting.id} (awaiting approval)`);
        }
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
    const status = data.code || 'unknown';

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
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode });
    } else if (eventCode === 'call_ended') {
      console.log(`✅ Call ended for bot ${botId}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode });
    } else if (eventCode === 'done') {
      console.log(`✅ Bot processing complete for ${botId}`);
      // Transcript should be ready now
      await handleTranscriptComplete(botId, payload);
    } else if (eventCode === 'fatal') {
      console.error(`❌ Bot encountered fatal error: ${eventSubCode}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode });
    } else if (eventCode === 'processing') {
      console.log(`⏳ Transcript processing for bot ${botId}`);
    } else {
      console.log(`ℹ️  Bot status: ${eventCode}`);
      await handleBotStatusChange(botId, { code: eventCode, sub_code: eventSubCode });
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

