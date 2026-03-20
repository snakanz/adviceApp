const { getSupabase } = require('../lib/supabase');
const axios = require('axios');
const clientExtractionService = require('./clientExtraction');
const { checkUserHasTranscriptionAccess } = require('../utils/subscriptionCheck');
const { decrypt, encrypt } = require('../utils/encryption');

// Recall.ai region configuration - EU Frankfurt for GDPR compliance
const RECALL_REGION = process.env.RECALL_REGION || 'eu-central-1';
const RECALL_BASE_URL = `https://${RECALL_REGION}.recall.ai/api/v1`;

/**
 * Calendly API v2 Service
 * Handles fetching meetings from Calendly API v2 and syncing with database
 *
 * IMPORTANT: This service uses USER-SPECIFIC OAuth tokens, not a global token.
 * Each user's Calendly data is fetched using their own access token from the database.
 *
 * API v2 Changes:
 * - Uses URI-based resource references (e.g., https://api.calendly.com/users/AAAA)
 * - Keyset-based pagination (cursor-based) instead of offset
 * - Deterministic responses based on request, not requester
 * - Better error handling with structured error responses
 */
class CalendlyService {
  /**
   * @param {string} accessToken - User-specific Calendly OAuth access token
   */
  constructor(accessToken = null) {
    this.baseURL = 'https://api.calendly.com';
    this.accessToken = accessToken; // User-specific OAuth token
  }

  /**
   * Check if Calendly is configured with a valid access token
   */
  isConfigured() {
    return !!this.accessToken;
  }

  /**
   * Make authenticated request to Calendly API using user's access token
   * @param {string} endpointOrFullUrl - Either an endpoint like '/users/me' or a full URL from Calendly's next_page
   */
  async makeRequest(endpointOrFullUrl, options = {}) {
    if (!this.accessToken) {
      throw new Error('Calendly access token not provided. Please connect your Calendly account.');
    }

    // Check if it's a full URL (from Calendly's pagination) or a relative endpoint
    const url = endpointOrFullUrl.startsWith('https://')
      ? endpointOrFullUrl
      : `${this.baseURL}${endpointOrFullUrl}`;

    // 🔍 DEBUG: Log the token prefix to verify we're using the right token
    const tokenPrefix = this.accessToken.substring(0, 20);
    console.log(`🔍 DEBUG API Request: ${endpointOrFullUrl.substring(0, 100)}...`);
    console.log(`   Token prefix: ${tokenPrefix}...`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly API error: ${response.status} - ${errorText}`);
    }

    // Handle 204 No Content (DELETE requests return empty response)
    if (response.status === 204) {
      return null;
    }

    const jsonData = await response.json();

    // 🔍 DEBUG: Log raw response for scheduled_events endpoint
    if (endpointOrFullUrl.includes('scheduled_events') && !endpointOrFullUrl.includes('invitees')) {
      console.log(`🔍 DEBUG RAW RESPONSE for ${endpointOrFullUrl.substring(0, 50)}...:`);
      console.log(`   Total events in response: ${jsonData.collection?.length || 0}`);
      if (jsonData.collection && jsonData.collection.length > 0) {
        // Log the LAST event (most recent by start_time since we sort asc)
        const lastEvent = jsonData.collection[jsonData.collection.length - 1];
        console.log(`   LAST event in response: ${lastEvent.name} at ${lastEvent.start_time}`);
        // Log the FIRST event (oldest)
        const firstEvent = jsonData.collection[0];
        console.log(`   FIRST event in response: ${firstEvent.name} at ${firstEvent.start_time}`);
      }
      console.log(`   Pagination: ${JSON.stringify(jsonData.pagination || {})}`);
    }

    return jsonData;
  }

  /**
   * Get current user information from Calendly
   */
  async getCurrentUser() {
    try {
      const data = await this.makeRequest('/users/me');
      const user = data.resource;

      // 🔍 DEBUG: Log user info to verify we're using the right account
      console.log(`🔍 DEBUG: Calendly User Info:`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   URI: ${user.uri}`);
      console.log(`   Organization: ${user.current_organization}`);
      console.log(`   Timezone: ${user.timezone}`);

      return user;
    } catch (error) {
      console.error('Error fetching Calendly user:', error);
      throw error;
    }
  }

  /**
   * Fetch scheduled events from Calendly with pagination support
   * Fetches BOTH active and canceled events to properly sync deletions
   * Uses intelligent time ranges based on sync status
   *
   * IMPORTANT: The Calendly API has two ways to fetch events:
   * 1. `user` parameter: Returns events where the user is the HOST
   * 2. `organization` parameter: Returns ALL events in the organization (requires admin/owner)
   *
   * We try both approaches to ensure we get all events the user can see.
   */
  async fetchScheduledEvents(options = {}) {
    try {
      // Get current user first to get their URI
      const user = await this.getCurrentUser();

      // Determine time range based on sync type
      const now = new Date();
      let timeMin, timeMax, syncType;

      if (options.fullSync || options.initialSync) {
        // INITIAL SYNC: Get all historical data (2 years back)
        timeMin = options.timeMin || new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000); // 2 years back
        timeMax = options.timeMax || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year forward
        syncType = 'FULL';
        console.log(`📅 FULL SYNC: Fetching all Calendly events (2 years back, 1 year forward)`);
      } else {
        // INCREMENTAL SYNC: Only recent data (3 months back, 6 months forward)
        timeMin = options.timeMin || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months back
        timeMax = options.timeMax || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months forward
        syncType = 'INCREMENTAL';
        console.log(`📅 INCREMENTAL SYNC: Fetching recent Calendly events (3 months back, 6 months forward)`);
      }

      console.log(`   Time range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

      // First, try fetching events using the USER parameter (events where user is HOST)
      console.log(`\n🔍 STRATEGY 1: Fetching events where user is HOST (user parameter)...`);
      const activeEventsAsHost = await this.fetchEventsByStatus(user.uri, null, timeMin, timeMax, 'active');
      const canceledEventsAsHost = await this.fetchEventsByStatus(user.uri, null, timeMin, timeMax, 'canceled');

      console.log(`   Found ${activeEventsAsHost.length} active, ${canceledEventsAsHost.length} canceled as HOST`);

      // Second, try fetching events using the ORGANIZATION parameter (all org events)
      // This requires admin/owner privileges but will catch events where user is invitee
      let activeEventsFromOrg = [];
      let canceledEventsFromOrg = [];

      if (user.current_organization) {
        console.log(`\n🔍 STRATEGY 2: Fetching ALL organization events (organization parameter)...`);
        try {
          activeEventsFromOrg = await this.fetchEventsByStatus(null, user.current_organization, timeMin, timeMax, 'active');
          canceledEventsFromOrg = await this.fetchEventsByStatus(null, user.current_organization, timeMin, timeMax, 'canceled');
          console.log(`   Found ${activeEventsFromOrg.length} active, ${canceledEventsFromOrg.length} canceled in ORGANIZATION`);
        } catch (orgError) {
          // This might fail if user doesn't have admin/owner privileges
          console.log(`   ⚠️ Organization fetch failed (may require admin privileges): ${orgError.message}`);
        }
      }

      // Merge and deduplicate events from both strategies
      const allActiveEvents = this.mergeAndDeduplicateEvents(activeEventsAsHost, activeEventsFromOrg);
      const allCanceledEvents = this.mergeAndDeduplicateEvents(canceledEventsAsHost, canceledEventsFromOrg);

      console.log(`\n✅ ${syncType} fetch complete: ${allActiveEvents.length} active, ${allCanceledEvents.length} canceled (after deduplication)`);

      return {
        active: allActiveEvents,
        canceled: allCanceledEvents,
        all: [...allActiveEvents, ...allCanceledEvents],
        syncType
      };
    } catch (error) {
      console.error('Error fetching Calendly events:', error);
      throw error;
    }
  }

  /**
   * Merge and deduplicate events from multiple sources
   * Uses event URI as unique identifier
   */
  mergeAndDeduplicateEvents(events1, events2) {
    const eventMap = new Map();

    // Add events from first array
    for (const event of events1) {
      eventMap.set(event.uri, event);
    }

    // Add events from second array (will overwrite duplicates)
    for (const event of events2) {
      eventMap.set(event.uri, event);
    }

    return Array.from(eventMap.values());
  }

  /**
   * Fetch events by status with keyset-based pagination (v2)
   * v2 uses cursor-based pagination instead of offset
   *
   * @param {string|null} userUri - User URI to filter by (events where user is host)
   * @param {string|null} organizationUri - Organization URI to filter by (all org events)
   * @param {Date} timeMin - Minimum start time
   * @param {Date} timeMax - Maximum start time
   * @param {string} status - Event status ('active' or 'canceled')
   */
  async fetchEventsByStatus(userUri, organizationUri, timeMin, timeMax, status) {
    let allEvents = [];
    let pageCount = 0;
    let cursor = null; // v2 uses cursor for pagination

    // Build initial request URL with v2 parameters
    const params = new URLSearchParams({
      min_start_time: timeMin.toISOString(),
      max_start_time: timeMax.toISOString(),
      status: status,
      sort: 'start_time:asc',
      count: '100' // Calendly API v2 uses 'count' parameter (max 100)
    });

    // Add either user or organization parameter (one is required)
    if (userUri) {
      params.set('user', userUri);
    } else if (organizationUri) {
      params.set('organization', organizationUri);
    } else {
      throw new Error('Either userUri or organizationUri must be provided');
    }

    let requestUrl = `/scheduled_events?${params}`;

    // 🔍 DEBUG: Log the full request URL and parameters
    const filterType = userUri ? 'USER (host only)' : 'ORGANIZATION (all events)';
    console.log(`🔍 DEBUG: Fetching ${status} events with ${filterType}:`);
    console.log(`   ${userUri ? 'User URI' : 'Organization URI'}: ${userUri || organizationUri}`);
    console.log(`   Time Range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
    console.log(`   Full URL: ${requestUrl}`);

    // Use next_page URL directly from Calendly's response (more reliable than reconstructing)
    let nextPageUrl = null;

    do {
      console.log(`📄 Fetching ${status} events page ${pageCount + 1}...`);

      // For first page, use the constructed URL; for subsequent pages, use Calendly's next_page URL
      const urlToFetch = nextPageUrl || requestUrl;

      const data = await this.makeRequest(urlToFetch);

      const events = data.collection || [];
      allEvents = allEvents.concat(events);
      pageCount++;

      console.log(`📊 Page ${pageCount}: Found ${events.length} ${status} events (Total: ${allEvents.length})`);

      // 🔍 DEBUG: Log first and last event of each page
      if (events.length > 0) {
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        console.log(`   First event: ${firstEvent.name || 'Unnamed'} | ${new Date(firstEvent.start_time).toISOString()}`);
        console.log(`   Last event: ${lastEvent.name || 'Unnamed'} | ${new Date(lastEvent.start_time).toISOString()}`);
      }

      // v2 API pagination - use the next_page URL directly from Calendly's response
      // This is more reliable than trying to reconstruct it with page_token
      const pagination = data.pagination || {};

      // Use the full next_page URL directly - this is the recommended approach
      nextPageUrl = pagination.next_page || null;

      console.log(`📄 Pagination info: next_page=${nextPageUrl ? 'present' : 'none'}, next_page_token=${pagination.next_page_token ? 'present' : 'none'}`);

      // If we got fewer than 100 events, we're at the end
      if (events.length < 100) {
        console.log(`📄 Received ${events.length} ${status} events (less than 100), reached end of results`);
        nextPageUrl = null;
      }

      // Safety check to prevent infinite loops
      if (pageCount > 50) {
        console.warn('⚠️  Reached maximum page limit (50), stopping pagination');
        break;
      }

    } while (nextPageUrl);

    console.log(`✅ Fetched ${allEvents.length} ${status} events across ${pageCount} pages`);

    // 🔍 DEBUG: Log summary of all events with dates
    if (allEvents.length > 0) {
      console.log(`🔍 DEBUG: Summary of all ${status} events by date:`);
      const eventsByDate = {};
      allEvents.forEach(event => {
        const dateKey = new Date(event.start_time).toISOString().split('T')[0];
        if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
        eventsByDate[dateKey].push(event.name || 'Unnamed');
      });
      Object.keys(eventsByDate).sort().forEach(date => {
        console.log(`   ${date}: ${eventsByDate[date].length} event(s) - ${eventsByDate[date].join(', ')}`);
      });
    }

    return allEvents;
  }

  /**
   * Get event invitees for a specific event
   */
  async getEventInvitees(eventUuid) {
    try {
      const data = await this.makeRequest(`/scheduled_events/${eventUuid}/invitees`);
      return data.collection || [];
    } catch (error) {
      console.error('Error fetching event invitees:', error);
      return [];
    }
  }

  /**
   * Transform Calendly event to Advicly meeting format with enhanced data
   */
  async transformEventToMeeting(calendlyEvent, userId) {
    try {
      // Get invitees for this event with enhanced details
      const invitees = await this.getEventInvitees(calendlyEvent.uri.split('/').pop());

      // Extract client email from invitees (first invitee is usually the client)
      const clientEmail = invitees.length > 0 ? invitees[0].email : null;

      // Create enhanced attendees array with more details
      const attendees = invitees.map(invitee => ({
        email: invitee.email,
        displayName: invitee.name,
        responseStatus: 'accepted', // Calendly events are confirmed
        // Enhanced Calendly invitee data
        calendlyInviteeUri: invitee.uri,
        calendlyInviteeUuid: invitee.uri ? invitee.uri.split('/').pop() : null,
        timezone: invitee.timezone,
        createdAt: invitee.created_at,
        updatedAt: invitee.updated_at,
        cancelUrl: invitee.cancel_url,
        rescheduleUrl: invitee.reschedule_url,
        // Custom fields and questions/answers
        questionsAndAnswers: invitee.questions_and_answers || [],
        trackingData: invitee.tracking || {},
        paymentInfo: invitee.payment || null
      }));

      // Generate unique event ID for Calendly meetings
      const calendlyEventId = `calendly_${calendlyEvent.uri.split('/').pop()}`;

      // Enhanced location parsing and meeting URL extraction
      let locationDetails = null;
      let locationType = 'unknown';
      let meetingUrl = null; // Store the actual meeting URL separately

      if (calendlyEvent.location) {
        if (calendlyEvent.location.type === 'physical') {
          locationType = 'physical';
          locationDetails = calendlyEvent.location.location;
        } else if (calendlyEvent.location.type === 'custom') {
          locationType = 'custom';
          locationDetails = calendlyEvent.location.location;
        } else if (calendlyEvent.location.type === 'zoom') {
          locationType = 'zoom';
          meetingUrl = calendlyEvent.location.join_url || null;
          locationDetails = meetingUrl || 'Zoom meeting (details in Calendly)';
        } else if (calendlyEvent.location.type === 'google_meet') {
          locationType = 'google_meet';
          meetingUrl = calendlyEvent.location.join_url || null;
          locationDetails = meetingUrl || 'Google Meet (details in Calendly)';
        } else if (calendlyEvent.location.type === 'microsoft_teams') {
          locationType = 'microsoft_teams';
          meetingUrl = calendlyEvent.location.join_url || null;
          locationDetails = meetingUrl || 'Microsoft Teams (details in Calendly)';
        } else if (calendlyEvent.location.type === 'gotomeeting') {
          locationType = 'gotomeeting';
          meetingUrl = calendlyEvent.location.join_url || null;
          locationDetails = meetingUrl || 'GoToMeeting (details in Calendly)';
        } else if (calendlyEvent.location.type === 'webex') {
          locationType = 'webex';
          meetingUrl = calendlyEvent.location.join_url || null;
          locationDetails = meetingUrl || 'Webex (details in Calendly)';
        } else if (calendlyEvent.location.type === 'phone_call') {
          locationType = 'phone';
          locationDetails = 'Phone call (details in Calendly)';
        }
      }

      return {
        user_id: userId,
        external_id: calendlyEventId, // Use calendly prefix to distinguish
        title: calendlyEvent.name || 'Calendly Meeting',
        starttime: calendlyEvent.start_time,
        endtime: calendlyEvent.end_time,
        description: `Calendly meeting: ${calendlyEvent.name}`,
        attendees: JSON.stringify(attendees),
        meeting_source: 'calendly',
        location: locationDetails,
        meeting_url: meetingUrl, // Store the extracted meeting URL
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error transforming Calendly event:', error);
      throw error;
    }
  }

  /**
   * Sync Calendly meetings to database
   * Automatically determines if full or incremental sync is needed
   */
  async syncMeetingsToDatabase(userId, options = {}) {
    try {
      console.log(`🔄 Starting Calendly sync for user ${userId}...`);

      if (!this.isConfigured()) {
        console.log('⚠️  No Calendly access token provided, skipping sync');
        return { synced: 0, errors: 0, message: 'No Calendly access token provided' };
      }

      // Check if transcription is enabled for Calendly connection
      const { data: connection } = await getSupabase()
        .from('calendar_connections')
        .select('transcription_enabled')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      const transcriptionEnabled = connection?.transcription_enabled === true;

      // Default to incremental sync (3 months back, 6 months forward) for manual syncs
      // Full sync (2 years) only when explicitly requested (e.g., initial connection)
      const needsInitialSync = options.forceFullSync === true;

      if (needsInitialSync) {
        console.log('🎯 Performing full sync - will fetch 2 years of historical data');
      } else {
        console.log('⚡ Performing incremental sync - fetching recent data only (3 months back, 6 months forward)');
      }

      // Fetch events from Calendly (both active and canceled)
      const eventData = await this.fetchScheduledEvents({
        initialSync: needsInitialSync,
        fullSync: options.forceFullSync
      });
      const activeEvents = eventData.active || [];
      const canceledEvents = eventData.canceled || [];

      console.log(`📅 Found ${activeEvents.length} active and ${canceledEvents.length} canceled Calendly events`);

      // Get existing Calendly meetings from database
      // Include id and recall_bot_id so we can cancel bots for deleted meetings
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('id, external_id, is_deleted, recall_bot_id')
        .eq('user_id', userId)
        .eq('meeting_source', 'calendly');

      console.log(`💾 Found ${existingMeetings?.length || 0} existing Calendly meetings in database`);

      const existingEventMap = new Map(
        (existingMeetings || []).map(m => [m.external_id, m])
      );

      let syncedCount = 0;
      let errorCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let restoredCount = 0;

      // Process ACTIVE events - create or update
      console.log(`🔄 Processing ${activeEvents.length} active events...`);
      for (const event of activeEvents) {
        try {
          const eventUuid = event.uri.split('/').pop();
          const calendlyEventId = `calendly_${eventUuid}`;

          const existingMeeting = existingEventMap.get(calendlyEventId);
          const meetingData = await this.transformEventToMeeting(event, userId);

          if (existingMeeting) {
            // Update existing meeting and ensure it's NOT deleted
            const { error } = await getSupabase()
              .from('meetings')
              .update({
                title: meetingData.title,
                starttime: meetingData.starttime,
                endtime: meetingData.endtime,
                description: meetingData.description,
                attendees: meetingData.attendees,
                location: meetingData.location,
                is_deleted: false, // Restore if it was previously deleted
                updated_at: meetingData.updated_at
              })
              .eq('external_id', calendlyEventId)
              .eq('user_id', userId);

            if (error) {
              console.error(`Error updating active meeting ${eventUuid}:`, error);
              errorCount++;
            } else {
              if (existingMeeting.is_deleted) {
                console.log(`♻️  Restored previously deleted meeting: ${meetingData.title}`);
                restoredCount++;
              } else {
                console.log(`🔄 Updated active meeting: ${meetingData.title}`);
                updatedCount++;
              }
            }
          } else {
            // Insert new meeting
            const { data: newMeeting, error } = await getSupabase()
              .from('meetings')
              .insert(meetingData)
              .select('id')
              .single();

            if (error) {
              console.error(`Error inserting new meeting ${eventUuid}:`, error);
              errorCount++;
            } else {
              console.log(`✅ Created new meeting: ${meetingData.title}`);
              syncedCount++;

              // Schedule Recall bot if transcription is enabled AND meeting is happening now / very soon
              if (transcriptionEnabled && newMeeting) {
                try {
                  // Check if user has transcription access (paid or within free limit)
                  const hasAccess = await checkUserHasTranscriptionAccess(userId);
                  if (!hasAccess) {
                    console.log(`🚫 User ${userId} has exceeded free meeting limit - skipping Recall bot for meeting ${newMeeting.id}`);
                    // Mark meeting as needing upgrade
                    await getSupabase()
                      .from('meetings')
                      .update({ recall_status: 'upgrade_required' })
                      .eq('id', newMeeting.id);
                  } else {
                    const now = new Date();
                    const start = new Date(event.start_time);
                    const end = new Date(event.end_time);

                    const alreadyOver = end <= now;
                    const startsTooFarInFuture = start.getTime() - now.getTime() > 1 * 60 * 1000; // more than 1 minute ahead (per Recall recommendation)

                    if (!alreadyOver && !startsTooFarInFuture) {
                      await this.scheduleRecallBotForCalendlyEvent(event, newMeeting.id, userId);
                    } else {
                      console.log(
                        `⏭️  Skipping Recall bot for Calendly event "${event.name}" (start=${start.toISOString()}, end=${end.toISOString()})`
                      );
                    }
                  }
                } catch (recallError) {
                  console.warn(`⚠️  Failed to schedule Recall bot for meeting ${newMeeting.id}:`, recallError.message);
                  // Don't fail the sync if Recall scheduling fails
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing active event:', error);
          errorCount++;
        }
      }

      // Process CANCELED events - mark as deleted
      console.log(`🗑️  Processing ${canceledEvents.length} canceled events...`);
      for (const event of canceledEvents) {
        try {
          const eventUuid = event.uri.split('/').pop();
          const calendlyEventId = `calendly_${eventUuid}`;

          // Try to find by external_id
          const existingMeeting = existingEventMap.get(calendlyEventId);

          if (existingMeeting) {
            if (!existingMeeting.is_deleted) {
              // Mark as deleted
              const { error } = await getSupabase()
                .from('meetings')
                .update({
                  is_deleted: true,
                  updated_at: new Date().toISOString()
                })
                .eq('external_id', calendlyEventId)
                .eq('user_id', userId);

              if (error) {
                console.error(`Error marking canceled meeting ${eventUuid}:`, error);
                errorCount++;
              } else {
                console.log(`🗑️  Marked as canceled: ${event.name} (UUID: ${eventUuid})`);
                deletedCount++;

                // Cancel any scheduled Recall bot for this meeting
                if (existingMeeting.recall_bot_id) {
                  await this.cancelRecallBot(existingMeeting.recall_bot_id, existingMeeting.id);
                }
              }
            } else {
              console.log(`⏭️  Already deleted: ${event.name}`);
            }
          } else {
            // Canceled event that we never had - this is normal for old canceled meetings
            console.log(`⏭️  Skipping canceled event (never synced): ${event.name}`);
          }
        } catch (error) {
          console.error('Error processing canceled event:', error);
          errorCount++;
        }
      }

      // **FIX**: ALWAYS run client extraction after sync to catch any unlinked meetings
      // This ensures clients are created even if meetings were synced before this feature was added
      try {
        console.log('🔄 Running client extraction to link any unlinked Calendly meetings...');
        const extractionResult = await clientExtractionService.linkMeetingsToClients(userId);
        console.log('✅ Client extraction completed for Calendly meetings:', extractionResult);
      } catch (error) {
        console.error('❌ Error extracting clients from Calendly meetings:', error);
        // Don't fail the whole sync if client extraction fails
      }

      // Update user's sync status
      const updateData = {
        last_calendly_sync: new Date().toISOString()
      };

      // Note: calendly_initial_sync_complete column may not exist yet
      // We track initial sync completion via last_calendly_sync timestamp instead

      await getSupabase()
        .from('users')
        .update(updateData)
        .eq('id', userId);

      const syncTypeLabel = needsInitialSync ? 'FULL' : 'INCREMENTAL';
      console.log(`🎉 ${syncTypeLabel} Calendly sync complete: ${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${restoredCount} restored, ${errorCount} errors`);

      return {
        synced: syncedCount,
        updated: updatedCount,
        deleted: deletedCount,
        restored: restoredCount,
        errors: errorCount,
        syncType: syncTypeLabel,
        message: `${syncTypeLabel} sync: ${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${restoredCount} restored meetings from Calendly`
      };

    } catch (error) {
      console.error('Error in Calendly sync:', error);
      throw error;
    }
  }

  /**
   * Schedule Recall bot for a Calendly event
   */
  async scheduleRecallBotForCalendlyEvent(event, meetingId, userId) {
    try {
      const now = new Date();
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);

      // Only create a bot if the meeting is in progress or starting very soon
      // Per Recall recommendation: bot should join 1 minute before meeting starts
      const graceMs = 1 * 60 * 1000; // 1-minute grace period before start
      const inProgressOrJustStarting =
        start.getTime() - graceMs <= now.getTime() &&
        now.getTime() <= end.getTime();

      if (!inProgressOrJustStarting) {
        console.log(
          `⏭️  Not creating Recall bot for Calendly event outside live window: "${event.name}" (start=${start.toISOString()}, end=${end.toISOString()})`
        );
        return;
      }

      // Extract meeting URL from Calendly event
      let meetingUrl = null;

      if (event.location) {
        if (event.location.type === 'zoom' && event.location.join_url) {
          meetingUrl = event.location.join_url;
        } else if (event.location.type === 'google_meet' && event.location.join_url) {
          meetingUrl = event.location.join_url;
        } else if (event.location.type === 'microsoft_teams' && event.location.join_url) {
          meetingUrl = event.location.join_url;
        } else if (event.location.type === 'webex' && event.location.join_url) {
          meetingUrl = event.location.join_url;
        } else if (event.location.type === 'gotomeeting' && event.location.join_url) {
          meetingUrl = event.location.join_url;
        }
      }

      if (!meetingUrl) {
        console.log(`⚠️  No meeting URL found for Calendly event ${event.uri}`);
        return;
      }

      // Create Recall bot
      const apiKey = process.env.RECALL_API_KEY;

      if (!apiKey) {
        console.warn('⚠️  RECALL_API_KEY not configured');
        return;
      }

      console.log(`🤖 Creating Recall bot in ${RECALL_REGION} region...`);
      const response = await axios.post(`${RECALL_BASE_URL}/bot/`, {
        meeting_url: meetingUrl,
        recording_config: {
          transcript: {
            provider: {
              meeting_captions: {} // FREE transcription
            }
          }
        },
        metadata: {
          user_id: userId,
          meeting_id: meetingId,
          source: 'advicly'
        }
      }, {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Store bot ID in meeting
      await getSupabase()
        .from('meetings')
        .update({
          recall_bot_id: response.data.id,
          recall_status: 'recording',
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      console.log(`✅ Recall bot scheduled for Calendly meeting ${meetingId}: ${response.data.id}`);

    } catch (error) {
      console.error('Error scheduling Recall bot for Calendly event:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Test Calendly connection
   */
  async testConnection() {
    try {
      if (!this.isConfigured()) {
        return { connected: false, error: 'Access token not provided' };
      }

      const user = await this.getCurrentUser();
      return {
        connected: true,
        user: {
          name: user.name,
          email: user.email,
          uri: user.uri
        }
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Fetch user's Calendly access token from database
   * Automatically refreshes the token if it's expired (when token_expires_at is available)
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Access token or null if not found
   */
  static async getUserAccessToken(userId) {
    try {
      const { data: connection, error } = await getSupabase()
        .from('calendar_connections')
        .select('access_token, refresh_token, token_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      if (error || !connection) {
        console.log(`⚠️  No active Calendly connection found for user ${userId}`);
        return null;
      }

      // Check if token is expired (if expiry date is available)
      if (connection.token_expires_at && connection.refresh_token) {
        const expiresAt = new Date(connection.token_expires_at);
        const now = new Date();

        // Refresh if token expires within the next 5 minutes
        if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
          console.log(`🔄 Calendly token expired or expiring soon for user ${userId}, refreshing...`);

          try {
            const CalendlyOAuthService = require('./calendlyOAuth');
            const oauthService = new CalendlyOAuthService();
            const refreshedTokens = await oauthService.refreshAccessToken(decrypt(connection.refresh_token));

            // Update tokens in database (encrypted at rest)
            const { error: updateError } = await getSupabase()
              .from('calendar_connections')
              .update({
                access_token: encrypt(refreshedTokens.access_token),
                refresh_token: refreshedTokens.refresh_token ? encrypt(refreshedTokens.refresh_token) : connection.refresh_token,
                token_expires_at: refreshedTokens.expires_in
                  ? new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString()
                  : null,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('provider', 'calendly');

            if (updateError) {
              console.error('Error updating refreshed Calendly token:', updateError);
              // Continue with old token
              return connection.access_token;
            }

            console.log(`✅ Calendly token refreshed successfully for user ${userId}`);
            return refreshedTokens.access_token;
          } catch (refreshError) {
            console.error('Error refreshing Calendly token:', refreshError);
            // Fall back to existing token
            return decrypt(connection.access_token);
          }
        }
      }

      return decrypt(connection.access_token);
    } catch (error) {
      console.error('Error fetching Calendly access token:', error);
      return null;
    }
  }

  /**
   * Cancel a Recall bot when meeting is canceled
   * This prevents bots from joining meetings that no longer exist
   */
  async cancelRecallBot(recallBotId, meetingId) {
    try {
      const apiKey = process.env.RECALL_API_KEY;
      if (!apiKey) {
        console.warn('⚠️  RECALL_API_KEY not configured, cannot cancel bot');
        return;
      }

      console.log(`🤖 Canceling Recall bot ${recallBotId} for canceled Calendly meeting ${meetingId}...`);

      // Call Recall API to delete/stop the bot
      await axios.delete(`${RECALL_BASE_URL}/bot/${recallBotId}/`, {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      });

      console.log(`✅ Recall bot ${recallBotId} canceled successfully`);

      // Update meeting to clear the bot reference
      await getSupabase()
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
}

module.exports = CalendlyService;
