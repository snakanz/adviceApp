const { getSupabase } = require('../lib/supabase');
const clientExtractionService = require('./clientExtraction');

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
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.accessToken) {
      throw new Error('Calendly access token not provided. Please connect your Calendly account.');
    }

    const url = `${this.baseURL}${endpoint}`;
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

    return response.json();
  }

  /**
   * Get current user information from Calendly
   */
  async getCurrentUser() {
    try {
      const data = await this.makeRequest('/users/me');
      return data.resource;
    } catch (error) {
      console.error('Error fetching Calendly user:', error);
      throw error;
    }
  }

  /**
   * Fetch scheduled events from Calendly with pagination support
   * Fetches BOTH active and canceled events to properly sync deletions
   * Uses intelligent time ranges based on sync status
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

      // Fetch both active and canceled events
      const activeEvents = await this.fetchEventsByStatus(user.uri, timeMin, timeMax, 'active');
      const canceledEvents = await this.fetchEventsByStatus(user.uri, timeMin, timeMax, 'canceled');

      console.log(`✅ ${syncType} fetch complete: ${activeEvents.length} active, ${canceledEvents.length} canceled`);

      return {
        active: activeEvents,
        canceled: canceledEvents,
        all: [...activeEvents, ...canceledEvents],
        syncType
      };
    } catch (error) {
      console.error('Error fetching Calendly events:', error);
      throw error;
    }
  }

  /**
   * Fetch events by status with keyset-based pagination (v2)
   * v2 uses cursor-based pagination instead of offset
   */
  async fetchEventsByStatus(userUri, timeMin, timeMax, status) {
    let allEvents = [];
    let pageCount = 0;
    let cursor = null; // v2 uses cursor for pagination

    // Build initial request URL with v2 parameters
    const params = new URLSearchParams({
      user: userUri,
      min_start_time: timeMin.toISOString(),
      max_start_time: timeMax.toISOString(),
      status: status,
      sort: 'start_time:asc',
      page_size: '100' // v2 uses page_size instead of count
    });

    let requestUrl = `/scheduled_events?${params}`;

    do {
      console.log(`📄 Fetching ${status} events page ${pageCount + 1}...`);

      // Add cursor to URL if we have one (for pagination)
      let urlToFetch = requestUrl;
      if (cursor) {
        urlToFetch += `&pagination_token=${encodeURIComponent(cursor)}`;
      }

      const data = await this.makeRequest(urlToFetch);

      const events = data.collection || [];
      allEvents = allEvents.concat(events);
      pageCount++;

      console.log(`📊 Page ${pageCount}: Found ${events.length} ${status} events (Total: ${allEvents.length})`);

      // v2 uses pagination_token instead of next_page
      const pagination = data.pagination || {};
      cursor = pagination.next_page_token || null;

      // If we got fewer than 100 events, we're at the end
      if (events.length < 100) {
        console.log(`📄 Received fewer than 100 ${status} events, reached end of results`);
        cursor = null;
      }

      // Safety check to prevent infinite loops
      if (pageCount > 50) {
        console.warn('⚠️  Reached maximum page limit (50), stopping pagination');
        break;
      }

    } while (cursor);

    console.log(`✅ Fetched ${allEvents.length} ${status} events across ${pageCount} pages`);
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

      // Enhanced location parsing
      let locationDetails = null;
      let locationType = 'unknown';

      if (calendlyEvent.location) {
        if (calendlyEvent.location.type === 'physical') {
          locationType = 'physical';
          locationDetails = calendlyEvent.location.location;
        } else if (calendlyEvent.location.type === 'custom') {
          locationType = 'custom';
          locationDetails = calendlyEvent.location.location;
        } else if (calendlyEvent.location.type === 'zoom') {
          locationType = 'zoom';
          locationDetails = calendlyEvent.location.join_url || 'Zoom meeting (details in Calendly)';
        } else if (calendlyEvent.location.type === 'google_meet') {
          locationType = 'google_meet';
          locationDetails = calendlyEvent.location.join_url || 'Google Meet (details in Calendly)';
        } else if (calendlyEvent.location.type === 'microsoft_teams') {
          locationType = 'microsoft_teams';
          locationDetails = calendlyEvent.location.join_url || 'Microsoft Teams (details in Calendly)';
        } else if (calendlyEvent.location.type === 'gotomeeting') {
          locationType = 'gotomeeting';
          locationDetails = calendlyEvent.location.join_url || 'GoToMeeting (details in Calendly)';
        } else if (calendlyEvent.location.type === 'webex') {
          locationType = 'webex';
          locationDetails = calendlyEvent.location.join_url || 'Webex (details in Calendly)';
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

      // ✅ FIX: Don't query for non-existent columns
      // The users table doesn't have last_calendly_sync column yet
      // For now, always perform full sync on first connection
      // This will be improved once database schema is updated
      const needsInitialSync = options.forceFullSync !== false;

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
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('external_id, is_deleted')
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

              // Schedule Recall bot if transcription is enabled
              if (transcriptionEnabled && newMeeting) {
                try {
                  await this.scheduleRecallBotForCalendlyEvent(event, newMeeting.id, userId);
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

      // After syncing meetings, extract and associate clients
      if (syncedCount > 0 || updatedCount > 0 || restoredCount > 0) {
        try {
          console.log('🔄 Starting client extraction for Calendly meetings...');
          const extractionResult = await clientExtractionService.linkMeetingsToClients(userId);
          console.log('✅ Client extraction completed for Calendly meetings:', extractionResult);
        } catch (error) {
          console.error('❌ Error extracting clients from Calendly meetings:', error);
          // Don't fail the whole sync if client extraction fails
        }
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
      const axios = require('axios');
      const apiKey = process.env.RECALL_API_KEY;
      const baseUrl = 'https://us-west-2.recall.ai/api/v1';

      if (!apiKey) {
        console.warn('⚠️  RECALL_API_KEY not configured');
        return;
      }

      const response = await axios.post(`${baseUrl}/bot/`, {
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
            const refreshedTokens = await oauthService.refreshAccessToken(connection.refresh_token);

            // Update tokens in database
            const { error: updateError } = await getSupabase()
              .from('calendar_connections')
              .update({
                access_token: refreshedTokens.access_token,
                refresh_token: refreshedTokens.refresh_token || connection.refresh_token,
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
            return connection.access_token;
          }
        }
      }

      return connection.access_token;
    } catch (error) {
      console.error('Error fetching Calendly access token:', error);
      return null;
    }
  }
}

module.exports = CalendlyService;
