const { getSupabase } = require('../lib/supabase');
// const ClientExtractionService = require('./clientExtraction');

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
   * Fetch scheduled events from Calendly
   */
  async fetchScheduledEvents(options = {}) {
    try {
      // Get current user first to get their URI
      const user = await this.getCurrentUser();
      
      // Calculate time range (default: 3 months back, 6 months forward)
      const now = new Date();
      const timeMin = options.timeMin || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const timeMax = options.timeMax || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        user: user.uri,
        min_start_time: timeMin.toISOString(),
        max_start_time: timeMax.toISOString(),
        status: 'active',
        sort: 'start_time:asc',
        count: '100' // Maximum allowed by Calendly API
      });

      const data = await this.makeRequest(`/scheduled_events?${params}`);
      return data.collection || [];
    } catch (error) {
      console.error('Error fetching Calendly events:', error);
      throw error;
    }
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
   * Transform Calendly event to Advicly meeting format
   */
  async transformEventToMeeting(calendlyEvent, userId) {
    try {
      // Get invitees for this event
      const invitees = await this.getEventInvitees(calendlyEvent.uri.split('/').pop());
      
      // Extract client email from invitees (first invitee is usually the client)
      const clientEmail = invitees.length > 0 ? invitees[0].email : null;
      
      // Create attendees array in the format expected by Advicly
      const attendees = invitees.map(invitee => ({
        email: invitee.email,
        displayName: invitee.name,
        responseStatus: 'accepted' // Calendly events are confirmed
      }));

      // Generate unique event ID for Calendly meetings
      const calendlyEventId = `calendly_${calendlyEvent.uri.split('/').pop()}`;

      return {
        userid: userId,
        googleeventid: calendlyEventId, // Use calendly prefix to distinguish
        title: calendlyEvent.name || 'Calendly Meeting',
        starttime: calendlyEvent.start_time,
        endtime: calendlyEvent.end_time,
        summary: `Calendly meeting: ${calendlyEvent.name}`,
        attendees: JSON.stringify(attendees),
        meeting_source: 'calendly',
        location: calendlyEvent.location?.location || null,
        is_deleted: false,
        sync_status: 'active',
        last_calendar_sync: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updatedat: new Date().toISOString()
        // Note: Calendly-specific columns (calendly_event_uri, calendly_event_uuid, client_email)
        // will be added after database migration
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

      // Fetch events from Calendly
      const calendlyEvents = await this.fetchScheduledEvents();
      console.log(`📅 Found ${calendlyEvents.length} Calendly events`);

      if (calendlyEvents.length === 0) {
        return { synced: 0, errors: 0, message: 'No Calendly events found' };
      }

      // Get existing Calendly meetings from database
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('googleeventid, calendly_event_uuid')
        .eq('userid', userId)
        .eq('meeting_source', 'calendly');

      const existingEventUuids = new Set(
        (existingMeetings || []).map(m => m.calendly_event_uuid).filter(Boolean)
      );

      let syncedCount = 0;
      let errorCount = 0;

      // Process each Calendly event
      for (const event of calendlyEvents) {
        try {
          const eventUuid = event.uri.split('/').pop();
          
          // Skip if already exists
          if (existingEventUuids.has(eventUuid)) {
            continue;
          }

          // Transform and insert meeting
          const meetingData = await this.transformEventToMeeting(event, userId);
          
          const { error } = await getSupabase()
            .from('meetings')
            .insert(meetingData);

          if (error) {
            console.error(`Error inserting Calendly meeting ${eventUuid}:`, error);
            errorCount++;
          } else {
            console.log(`✅ Synced Calendly meeting: ${meetingData.title}`);
            syncedCount++;
          }
        } catch (error) {
          console.error('Error processing Calendly event:', error);
          errorCount++;
        }
      }

      // After syncing meetings, extract and associate clients
      if (syncedCount > 0) {
        try {
          // const clientExtraction = new ClientExtractionService();
          // await clientExtraction.extractClientsFromMeetings(userId);
          console.log('✅ Client extraction completed for Calendly meetings (disabled for now)');
        } catch (error) {
          console.error('Error extracting clients from Calendly meetings:', error);
        }
      }

      console.log(`🎉 Calendly sync complete: ${syncedCount} synced, ${errorCount} errors`);
      return {
        synced: syncedCount,
        errors: errorCount,
        message: `Synced ${syncedCount} meetings from Calendly`
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
