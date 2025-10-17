const { getSupabase } = require('../lib/supabase');
const clientExtractionService = require('./clientExtraction');

/**
 * Calendly API Service
 * Handles fetching meetings from Calendly API and syncing with database
 */
class CalendlyService {
  constructor() {
    this.baseURL = 'https://api.calendly.com';
    this.personalAccessToken = process.env.CALENDLY_PERSONAL_ACCESS_TOKEN;
  }

  /**
   * Check if Calendly is configured
   */
  isConfigured() {
    return !!this.personalAccessToken;
  }

  /**
   * Make authenticated request to Calendly API
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.personalAccessToken) {
      throw new Error('Calendly personal access token not configured');
    }

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.personalAccessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly API error: ${response.status} - ${errorText}`);
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
   */
  async fetchScheduledEvents(options = {}) {
    try {
      // Get current user first to get their URI
      const user = await this.getCurrentUser();

      // Calculate time range (default: 2 years back, 1 year forward for comprehensive sync)
      const now = new Date();
      const timeMin = options.timeMin || new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000); // 2 years back
      const timeMax = options.timeMax || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year forward

      console.log(`📅 Fetching Calendly events (active + canceled) from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

      // Fetch both active and canceled events
      const activeEvents = await this.fetchEventsByStatus(user.uri, timeMin, timeMax, 'active');
      const canceledEvents = await this.fetchEventsByStatus(user.uri, timeMin, timeMax, 'canceled');

      console.log(`✅ Calendly fetch complete: ${activeEvents.length} active, ${canceledEvents.length} canceled`);

      return {
        active: activeEvents,
        canceled: canceledEvents,
        all: [...activeEvents, ...canceledEvents]
      };
    } catch (error) {
      console.error('Error fetching Calendly events:', error);
      throw error;
    }
  }

  /**
   * Fetch events by status with pagination
   */
  async fetchEventsByStatus(userUri, timeMin, timeMax, status) {
    let allEvents = [];
    let nextPageUrl = null;
    let pageCount = 0;

    // Build initial request URL
    const params = new URLSearchParams({
      user: userUri,
      min_start_time: timeMin.toISOString(),
      max_start_time: timeMax.toISOString(),
      status: status,
      sort: 'start_time:asc',
      count: '100' // Maximum allowed by Calendly API
    });

    let requestUrl = `/scheduled_events?${params}`;

    do {
      console.log(`📄 Fetching ${status} events page ${pageCount + 1}...`);

      // Use the full next page URL if available, otherwise use the initial URL
      const urlToFetch = nextPageUrl ? nextPageUrl.replace(this.baseURL, '') : requestUrl;
      const data = await this.makeRequest(urlToFetch);

      const events = data.collection || [];
      allEvents = allEvents.concat(events);
      pageCount++;

      console.log(`📊 Page ${pageCount}: Found ${events.length} ${status} events (Total: ${allEvents.length})`);

      // Check for pagination - use the full next_page URL
      const pagination = data.pagination || {};

      // If we got fewer than 100 events, we're at the end
      if (events.length < 100) {
        console.log(`📄 Received fewer than 100 ${status} events, reached end of results`);
        nextPageUrl = null;
      } else {
        nextPageUrl = pagination.next_page || null;
      }

      // Safety check to prevent infinite loops
      if (pageCount > 50) {
        console.warn('⚠️  Reached maximum page limit (50), stopping pagination');
        break;
      }

    } while (nextPageUrl);

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
        userid: userId,
        googleeventid: calendlyEventId, // Use calendly prefix to distinguish
        title: calendlyEvent.name || 'Calendly Meeting',
        starttime: calendlyEvent.start_time,
        endtime: calendlyEvent.end_time,
        summary: `Calendly meeting: ${calendlyEvent.name}`,
        attendees: JSON.stringify(attendees),
        meeting_source: 'calendly',
        location: locationDetails,
        is_deleted: false,
        sync_status: 'active',
        last_calendar_sync: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updatedat: new Date().toISOString(),
        // Calendly-specific columns
        calendly_event_uri: calendlyEvent.uri,
        calendly_event_uuid: calendlyEvent.uri.split('/').pop(),
        client_email: clientEmail
      };
    } catch (error) {
      console.error('Error transforming Calendly event:', error);
      throw error;
    }
  }

  /**
   * Sync Calendly meetings to database
   */
  async syncMeetingsToDatabase(userId) {
    try {
      console.log(`🔄 Starting Calendly sync for user ${userId}...`);

      if (!this.isConfigured()) {
        console.log('⚠️  Calendly not configured, skipping sync');
        return { synced: 0, errors: 0, message: 'Calendly not configured' };
      }

      // Fetch events from Calendly (both active and canceled)
      const eventData = await this.fetchScheduledEvents();
      const activeEvents = eventData.active || [];
      const canceledEvents = eventData.canceled || [];

      console.log(`📅 Found ${activeEvents.length} active and ${canceledEvents.length} canceled Calendly events`);

      // Get existing Calendly meetings from database
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('googleeventid, is_deleted')
        .eq('userid', userId)
        .eq('meeting_source', 'calendly');

      const existingEventMap = new Map(
        (existingMeetings || []).map(m => [m.googleeventid, m])
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
                summary: meetingData.summary,
                attendees: meetingData.attendees,
                location: meetingData.location,
                is_deleted: false, // Restore if it was previously deleted
                sync_status: 'active',
                last_calendar_sync: meetingData.last_calendar_sync,
                updatedat: meetingData.updatedat,
                client_email: meetingData.client_email
              })
              .eq('googleeventid', calendlyEventId)
              .eq('userid', userId);

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
            const { error } = await getSupabase()
              .from('meetings')
              .insert(meetingData);

            if (error) {
              console.error(`Error inserting new meeting ${eventUuid}:`, error);
              errorCount++;
            } else {
              console.log(`✅ Created new meeting: ${meetingData.title}`);
              syncedCount++;
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

          const existingMeeting = existingEventMap.get(calendlyEventId);

          if (existingMeeting && !existingMeeting.is_deleted) {
            // Mark as deleted
            const { error } = await getSupabase()
              .from('meetings')
              .update({
                is_deleted: true,
                sync_status: 'canceled',
                updatedat: new Date().toISOString()
              })
              .eq('googleeventid', calendlyEventId)
              .eq('userid', userId);

            if (error) {
              console.error(`Error marking canceled meeting ${eventUuid}:`, error);
              errorCount++;
            } else {
              console.log(`🗑️  Marked as canceled: ${event.name}`);
              deletedCount++;
            }
          } else if (!existingMeeting) {
            // Canceled event that we never had - skip it
            console.log(`⏭️  Skipping canceled event that was never synced: ${event.name}`);
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
          const extractionResult = await clientExtractionService.extractClientsFromMeetings(userId);
          console.log('✅ Client extraction completed for Calendly meetings:', extractionResult);
        } catch (error) {
          console.error('❌ Error extracting clients from Calendly meetings:', error);
          // Don't fail the whole sync if client extraction fails
        }
      }

      console.log(`🎉 Calendly sync complete: ${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${restoredCount} restored, ${errorCount} errors`);
      return {
        synced: syncedCount,
        updated: updatedCount,
        deleted: deletedCount,
        restored: restoredCount,
        errors: errorCount,
        message: `Synced ${syncedCount} new, updated ${updatedCount}, deleted ${deletedCount}, restored ${restoredCount} meetings from Calendly`
      };

    } catch (error) {
      console.error('Error in Calendly sync:', error);
      throw error;
    }
  }

  /**
   * Test Calendly connection
   */
  async testConnection() {
    try {
      if (!this.isConfigured()) {
        return { connected: false, error: 'Personal access token not configured' };
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
}

module.exports = CalendlyService;
