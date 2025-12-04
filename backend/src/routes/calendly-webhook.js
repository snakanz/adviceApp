const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const CalendlyService = require('../services/calendlyService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const clientExtractionService = require('../services/clientExtraction');

const router = express.Router();

console.log('🔄 Calendly webhook-only route loaded (for raw body handling)');

/**
 * ✅ Verify Calendly webhook signature using RAW body (v2 compatible)
 * Calendly v2 signature format: "t=TIMESTAMP,v1=HEX_SIGNATURE"
 * HMAC is computed over: timestamp + "." + raw_body
 * Reference: https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-signatures
 *
 * v2 API Note: Signature format is identical to v1, so verification code works unchanged
 */
function verifyCalendlySignature(rawBody, signatureHeader, signingKey) {
  if (!signatureHeader) {
    console.warn('⚠️  No Calendly-Webhook-Signature header provided');
    return false;
  }

  try {
    // ✅ Parse signature header - Calendly uses "t=TIMESTAMP,v1=HEX_SIGNATURE"
    // This format is consistent across v1 and v2 APIs
    const parts = signatureHeader.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));

    if (!tPart || !v1Part) {
      console.error('❌ Invalid signature header format:', signatureHeader);
      console.error('   Expected format: t=TIMESTAMP,v1=HEX_SIGNATURE');
      console.error('   Received:', signatureHeader);
      return false;
    }

    const timestamp = tPart.split('=')[1];
    const sigHex = v1Part.split('=')[1];

    console.log(`🔐 Signature verification:`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Signature (first 20 chars): ${sigHex.substring(0, 20)}...`);

    // ✅ FIX: Compute HMAC over raw body bytes (not parsed JSON)
    // Calendly computes: HMAC-SHA256(signing_key, timestamp + "." + raw_body)
    const signedContent = timestamp + '.' + rawBody.toString('utf8');

    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(signedContent);
    const computed = hmac.digest('hex');

    console.log(`   Computed (first 20 chars): ${computed.substring(0, 20)}...`);

    // ✅ FIX: Use constant-time comparison with proper buffer lengths
    const computedBuffer = Buffer.from(computed, 'hex');
    const signatureBuffer = Buffer.from(sigHex, 'hex');

    if (computedBuffer.length !== signatureBuffer.length) {
      console.error('❌ Signature length mismatch:', {
        computed: computedBuffer.length,
        received: signatureBuffer.length
      });
      return false;
    }

    const isValid = crypto.timingSafeEqual(computedBuffer, signatureBuffer);

    if (isValid) {
      console.log('✅ SIGNATURE VALID');
    } else {
      console.error('❌ Invalid webhook signature');
      console.error('   Expected:', computed);
      console.error('   Received:', sigHex);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    console.error('   Error details:', error.message);
    // ✅ FIX #5: Never throw - return false gracefully
    return false;
  }
}

/**
 * ✅ FIX #2: Calendly Webhook Handler with RAW BODY middleware
 * PRODUCTION-READY PATTERN:
 * 1. Use express.raw() to preserve raw body for signature verification
 * 2. Verify signature over raw bytes (not parsed JSON)
 * 3. Return 200 immediately (before processing)
 * 4. Process webhook asynchronously (no blocking)
 * 5. Handle all errors gracefully (no 500s)
 * 6. Implement idempotency (dedupe retries)
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CALENDLY WEBHOOK RECEIVED                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // ✅ FIX #2: req.body is now a Buffer (raw bytes)
    const rawBody = req.body;
    
    if (!Buffer.isBuffer(rawBody)) {
      console.error('❌ CRITICAL: Raw body is not a Buffer:', typeof rawBody);
      // ✅ FIX #4: Return 200 even on error to prevent webhook disablement
      return res.status(200).json({ received: true, error: 'Invalid body format' });
    }

    console.log(`📦 Raw body length: ${rawBody.length} bytes`);

    // ✅ FIX #3: Verify signature using raw body
    const signatureHeader = req.headers['calendly-webhook-signature'];

    // ✅ USER-SCOPED: Get the webhook signing key from the database
    // Each USER has their own webhook subscription with their own signing key
    // We need to find the correct user's webhook by trying all active user-scoped webhooks

    let isValid = false;
    let verificationError = null;
    let webhookUserId = null;  // ✅ Track which user this webhook belongs to

    if (!isSupabaseAvailable()) {
      console.warn('⚠️  Database unavailable - cannot verify webhook signature');
      // Continue anyway - webhook will be processed but unverified
    } else {
      try {
        const supabase = getSupabase();

        // ✅ USER-SCOPED: Get all active USER-SCOPED webhooks (not organization-scoped)
        const { data: webhooks, error: webhookError } = await supabase
          .from('calendly_webhook_subscriptions')
          .select('webhook_signing_key, user_id, user_uri')
          .eq('is_active', true)
          .eq('scope', 'user');  // ✅ Only user-scoped webhooks

        if (webhookError) {
          console.error('❌ Error fetching webhook signing keys:', webhookError);
          verificationError = webhookError;
        } else if (!webhooks || webhooks.length === 0) {
          console.warn('⚠️  No active user-scoped webhooks found in database');
          verificationError = 'No active webhooks';
        } else {
          // Check if ANY webhook has a signing key
          const webhooksWithKeys = webhooks.filter(w => w.webhook_signing_key);

          if (webhooksWithKeys.length === 0) {
            console.warn('⚠️  No webhooks have signing keys stored');
            console.warn('⚠️  v2 API: Signing keys should be returned during webhook creation');
            console.warn('⚠️  Reconnect Calendly to ensure signing keys are properly stored');
            verificationError = 'No signing keys available';
          } else {
            // ✅ USER-SCOPED: Try to verify with each user's webhook signing key
            for (const webhook of webhooksWithKeys) {
              const result = verifyCalendlySignature(rawBody, signatureHeader, webhook.webhook_signing_key);
              if (result) {
                isValid = true;
                webhookUserId = webhook.user_id;  // ✅ Track which user this webhook belongs to
                console.log(`✅ Signature verified successfully for user: ${webhookUserId}`);
                break;
              }
            }

            if (!isValid) {
              console.error('❌ Webhook signature verification failed with all user keys');
              verificationError = 'Signature mismatch';
            }
          }
        }
      } catch (error) {
        console.error('❌ Error during signature verification:', error);
        verificationError = error.message;
      }
    }

    if (verificationError && !isValid) {
      console.error('❌ Webhook signature verification failed:', verificationError);
      // ✅ v2 API: Properly reject invalid signatures
      // With v2, signing keys should always be available, so we can enforce verification
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // ✅ FIX #4: Return 200 IMMEDIATELY (before processing)
    // This prevents timeouts and webhook disablement
    res.status(200).json({ received: true });

    // ✅ FIX #4: Process webhook asynchronously (non-blocking)
    // Parse JSON after sending response
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawBody.toString('utf8'));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook JSON:', parseError);
      // Already sent 200, just log and return
      return;
    }

    console.log('📥 Webhook event:', {
      event: parsedPayload.event,
      created_at: parsedPayload.created_at
    });

    // ✅ FIX #7: Handle DB unavailability gracefully (already sent 200)
    if (!isSupabaseAvailable()) {
      console.error('❌ Database unavailable - webhook will be lost');
      console.error('⚠️  TODO: Implement queue for retry (SQS/Redis/etc)');
      // Already sent 200, so Calendly won't retry
      return;
    }

    const { event, payload } = parsedPayload;

    // ✅ FIX #5: Validate payload structure before processing
    if (!event || !payload) {
      console.error('❌ Invalid webhook payload structure:', {
        hasEvent: !!event,
        hasPayload: !!payload
      });
      return;
    }

    // ✅ USER-SCOPED: Process webhook event asynchronously with user context
    // Pass webhookUserId so event handler knows which user this webhook belongs to
    processWebhookEvent(event, payload, webhookUserId).catch(error => {
      console.error('❌ Error in async webhook processing:', error);
      console.error('   Stack:', error.stack);
      // Error already logged, webhook already acknowledged with 200
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in webhook handler:', error);
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Always return 200 to prevent webhook disablement
    // If we haven't sent response yet, send it now
    if (!res.headersSent) {
      res.status(200).json({ received: true, error: 'Internal error' });
    }
  }
});

/**
 * ✅ FIX #4: Async webhook processor (runs after 200 response sent)
 * This function processes the webhook event without blocking the HTTP response
 *
 * ✅ USER-SCOPED: Now receives webhookUserId to route event to correct user
 */
async function processWebhookEvent(event, payload, webhookUserId) {
  try {
    console.log(`\n🔄 Processing webhook event: ${event}`);
    console.log(`   For user: ${webhookUserId}`);

    // Import handler functions from main calendly.js
    // We'll call them dynamically to avoid circular dependencies
    const handlers = {
      'invitee.created': handleInviteeCreated,
      'invitee.canceled': handleInviteeCanceled,
      'invitee.updated': handleInviteeUpdated
    };

    const handler = handlers[event];
    if (handler) {
      // ✅ USER-SCOPED: Pass webhookUserId to handler
      await handler(payload, webhookUserId);
    } else {
      console.log(`⚠️  Unhandled webhook event: ${event}`);
    }

    console.log(`✅ Webhook event processed: ${event}\n`);
  } catch (error) {
    console.error(`❌ Error processing webhook event ${event}:`, error);
    throw error; // Re-throw for logging in caller
  }
}

// =====================================================
// WEBHOOK EVENT HANDLERS (with idempotency & error handling)
// =====================================================

/**
 * ✅ FIX #6: Handle invitee.created with idempotency
 * Stores event ID BEFORE processing to prevent duplicate processing on retries
 *
 * ✅ USER-SCOPED: Now receives webhookUserId directly from webhook verification
 * No need to look up user by Calendly URI - we already know which user this webhook belongs to
 */
async function handleInviteeCreated(payload, webhookUserId) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.created:', payload);
      return;
    }

    console.log('✅ New meeting scheduled via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();

    // ✅ FIX #6: IDEMPOTENCY - Store event ID FIRST (before processing)
    // This prevents duplicate processing if webhook is retried
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.created')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
      // Continue anyway - better to process twice than not at all
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY to claim this event
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.created',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      // Check if it's a duplicate key error (race condition)
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed by another request (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
      // Continue processing anyway
    }

    // ✅ USER-SCOPED: We already know which user this webhook belongs to
    // No need to look up by Calendly URI - webhookUserId was verified during signature verification
    if (!webhookUserId) {
      console.error('❌ No webhookUserId provided - cannot route event to user');
      return;
    }

    console.log(`✅ Webhook belongs to user: ${webhookUserId}`);

    // ✅ USER-SCOPED: Get user's Calendly connection directly
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('user_id, access_token')
      .eq('user_id', webhookUserId)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Error querying calendar connection:', connectionError);
      return;
    }

    if (!connection) {
      console.error('❌ No active Calendly connection found for user:', webhookUserId);
      return;
    }

    console.log(`✅ Found Calendly connection for user: ${webhookUserId}`);

    // Create CalendlyService with user's specific OAuth token
    const calendlyService = new CalendlyService(connection.access_token);

    // Fetch event details using user's token
    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);
    
    if (!eventData || !eventData.resource) {
      console.error('❌ Invalid event data from Calendly API');
      return;
    }

    const event = eventData.resource;
    const userId = connection.user_id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);

    // Check if meeting already exists (by external_id)
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('external_id', meetingData.external_id)
      .eq('user_id', userId)
      .maybeSingle();

    let error;
    if (existingMeeting) {
      // Update existing meeting instead of creating duplicate
      console.log('⚠️  Meeting already exists, updating instead');
      const updateResult = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', existingMeeting.id);
      error = updateResult.error;
    } else {
      // Create new meeting
      const insertResult = await supabase
        .from('meetings')
        .insert(meetingData);
      error = insertResult.error;
    }

    if (error) {
      console.error('❌ Error saving meeting from webhook:', error);
      throw error; // Re-throw to log in caller
    } else {
      console.log('✅ Meeting saved from webhook:', meetingData.title);

      // Update user's last sync time
      await supabase
        .from('users')
        .update({
          last_calendly_sync: new Date().toISOString()
        })
        .eq('id', userId);

      // Extract and link client from the new meeting
      try {
        console.log('🔄 Starting client extraction for Calendly webhook meeting...');
        const extractionResult = await clientExtractionService.linkMeetingsToClients(userId);
        console.log('✅ Client extraction completed for Calendly webhook:', extractionResult);
      } catch (extractionError) {
        console.error('❌ Error extracting client from Calendly webhook meeting:', extractionError);
        // Don't fail the webhook if client extraction fails
      }
    }
  } catch (error) {
    console.error('❌ Error handling invitee.created:', error);
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

/**
 * ✅ FIX #6: Handle invitee.canceled with idempotency
 * ✅ USER-SCOPED: Now receives webhookUserId directly
 */
async function handleInviteeCanceled(payload, webhookUserId) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.canceled:', payload);
      return;
    }

    console.log('🗑️  Meeting cancelled via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();
    const calendlyEventId = `calendly_${eventUuid}`;

    // ✅ FIX #6: IDEMPOTENCY - Check and store event ID FIRST
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.canceled')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.canceled',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
    }

    // ✅ USER-SCOPED: Use webhookUserId to find the meeting
    // Also fetch recall_bot_id so we can cancel the bot
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, user_id, recall_bot_id')
      .eq('user_id', webhookUserId)
      .eq('external_id', calendlyEventId)
      .maybeSingle();

    const { error } = await supabase
      .from('meetings')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', calendlyEventId);

    if (error) {
      console.error('❌ Error marking meeting as deleted:', error);
      throw error;
    } else {
      console.log('✅ Meeting marked as canceled via webhook:', calendlyEventId);

      // Cancel any scheduled Recall bot for this meeting
      if (meeting?.recall_bot_id) {
        await cancelRecallBot(meeting.recall_bot_id, meeting.id);
      }

      if (meeting?.user_id) {
        // Update user's last sync time
        await supabase
          .from('users')
          .update({
            last_calendly_sync: new Date().toISOString()
          })
          .eq('id', meeting.user_id);
      }
    }
  } catch (error) {
    console.error('❌ Error handling invitee.canceled:', error);
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

/**
 * Cancel a Recall bot when meeting is canceled
 * This prevents bots from joining meetings that no longer exist
 */
async function cancelRecallBot(recallBotId, meetingId) {
  try {
    const apiKey = process.env.RECALL_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  RECALL_API_KEY not configured, cannot cancel bot');
      return;
    }

    console.log(`🤖 Canceling Recall bot ${recallBotId} for canceled meeting ${meetingId}...`);

    // Call Recall API to delete/stop the bot
    // DELETE /api/v1/bot/{id}/ removes a scheduled bot
    await axios.delete(`https://us-west-2.recall.ai/api/v1/bot/${recallBotId}/`, {
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    console.log(`✅ Recall bot ${recallBotId} canceled successfully`);

    // Update meeting to clear the bot reference
    const supabase = getSupabase();
    await supabase
      .from('meetings')
      .update({
        recall_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

  } catch (error) {
    // Bot may already be recording or finished - that's okay
    if (error.response?.status === 404) {
      console.log(`⚠️  Recall bot ${recallBotId} not found (may have already finished or been deleted)`);
    } else {
      console.error(`❌ Error canceling Recall bot ${recallBotId}:`, error.response?.data || error.message);
    }
  }
}

/**
 * ✅ FIX #6: Handle invitee.updated with idempotency
 * ✅ USER-SCOPED: Now receives webhookUserId directly
 */
async function handleInviteeUpdated(payload, webhookUserId) {
  const supabase = getSupabase();
  let eventUuid = null;

  try {
    // ✅ FIX #5: Validate payload structure
    if (!payload || !payload.event) {
      console.error('❌ Invalid payload structure for invitee.updated:', payload);
      return;
    }

    console.log('🔄 Meeting updated via webhook:', payload.event);

    const eventUri = payload.event;
    eventUuid = eventUri.split('/').pop();

    // ✅ FIX #6: IDEMPOTENCY - Check and store event ID FIRST
    const { data: existingWebhookEvent, error: checkError } = await supabase
      .from('calendly_webhook_events')
      .select('id')
      .eq('event_id', eventUuid)
      .eq('event_type', 'invitee.updated')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking webhook event deduplication:', checkError);
    }

    if (existingWebhookEvent) {
      console.log('⏭️  Webhook event already processed, skipping (idempotency)');
      return;
    }

    // ✅ FIX #6: Store event ID IMMEDIATELY
    const { error: insertEventError } = await supabase
      .from('calendly_webhook_events')
      .insert({
        event_id: eventUuid,
        event_type: 'invitee.updated',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log('⏭️  Event already being processed (race condition)');
        return;
      }
      console.error('❌ Error storing webhook event:', insertEventError);
    }

    // ✅ USER-SCOPED: Use webhookUserId to find the meeting
    console.log(`✅ Processing update for user: ${webhookUserId}`);

    // ✅ FIX #5: Validate required fields
    const calendlyUserUri = payload.created_by;
    if (!calendlyUserUri) {
      console.error('❌ No created_by (Calendly user URI) in webhook payload');
      return;
    }

    console.log(`🔍 Looking for user with Calendly URI: ${calendlyUserUri}`);

    // Query for the specific user's connection using calendly_user_uri
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('user_id, access_token')
      .eq('provider', 'calendly')
      .eq('calendly_user_uri', calendlyUserUri)
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Error querying calendar connection:', connectionError);
      return;
    }

    if (!connection) {
      console.error('❌ No matching Calendly connection found for webhook:', {
        calendlyUserUri
      });
      return;
    }

    console.log(`✅ Found matching user: ${connection.user_id}`);

    // Create CalendlyService with user's specific OAuth token
    const calendlyService = new CalendlyService(connection.access_token);

    // Fetch the updated event details from Calendly using user's token
    const eventData = await calendlyService.makeRequest(`/scheduled_events/${eventUuid}`);

    if (!eventData || !eventData.resource) {
      console.error('❌ Invalid event data from Calendly API');
      return;
    }

    const event = eventData.resource;

    // Find the existing meeting in database
    const calendlyEventId = `calendly_${eventUuid}`;
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('external_id', calendlyEventId)
      .maybeSingle();

    if (!existingMeeting) {
      console.log('⚠️  Meeting not found in database, creating new one');
      // If meeting doesn't exist, create it
      await handleInviteeCreated(payload);
      return;
    }

    // Transform the updated event data
    const userId = existingMeeting.user_id;
    const meetingData = await calendlyService.transformEventToMeeting(event, userId);
    meetingData.updated_at = new Date().toISOString();

    // Update the meeting
    const { error } = await supabase
      .from('meetings')
      .update(meetingData)
      .eq('id', existingMeeting.id);

    if (error) {
      console.error('❌ Error updating meeting from webhook:', error);
      throw error;
    } else {
      console.log('✅ Meeting updated from webhook:', meetingData.title);

      // Update user's last sync time
      await supabase
        .from('users')
        .update({
          last_calendly_sync: new Date().toISOString()
        })
        .eq('id', userId);
    }
  } catch (error) {
    console.error('❌ Error handling invitee.updated:', error);
    console.error('   Stack:', error.stack);
    // ✅ FIX #5: Don't re-throw - already logged
  }
}

module.exports = router;

