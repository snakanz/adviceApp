const { google } = require('googleapis');
const { getSupabase } = require('../lib/supabase');

/**
 * Comprehensive Calendar Sync Service
 * Handles additions, updates, and DELETIONS from Google Calendar
 * Works with both existing meetings and ICS imports
 */
class CalendarSyncService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Full calendar sync with deletion detection
   * @param {string} userId - User ID (UUID)
   * @param {Object} options - Sync options
   */
  async syncUserCalendar(userId, options = {}) {
    const {
      timeRange = 'extended', // 'recent' (2 weeks) or 'extended' (6 months)
      includeDeleted = true,
      dryRun = false
    } = options;

    console.log(`🔄 Starting calendar sync for user ${userId}...`);

    try {
      // Get user's active Google Calendar connection from calendar_connections table
      const { data: connection, error: connError } = await getSupabase()
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        console.error('Calendar connection error:', connError);
        throw new Error(`No active Google Calendar connection found for user ${userId}. Please reconnect your Google Calendar.`);
      }

      if (!connection.access_token) {
        throw new Error('Google Calendar token not available');
      }

      console.log(`📅 Found active Google Calendar connection for user ${userId}, expires: ${connection.token_expires_at}`);

      // Check if token is expired
      const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
      const now = new Date();
      const isExpired = expiresAt && expiresAt <= now;

      console.log(`🔐 Token status: ${isExpired ? 'EXPIRED' : 'VALID'} (expires: ${expiresAt?.toISOString() || 'unknown'})`);

      // Set up OAuth client
      this.oauth2Client.setCredentials({
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expiry_date: expiresAt ? expiresAt.getTime() : null
      });

      // If token is expired, try to refresh it
      if (isExpired && connection.refresh_token) {
        console.log('🔄 Refreshing expired access token...');
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();

          // Update the token in database
          const newExpiresAt = new Date(credentials.expiry_date);
          await getSupabase()
            .from('calendar_connections')
            .update({
              access_token: credentials.access_token,
              token_expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          console.log(`✅ Token refreshed successfully, new expiry: ${newExpiresAt.toISOString()}`);
        } catch (refreshError) {
          console.error('❌ Failed to refresh token:', refreshError);
          throw new Error('Google Calendar token expired and could not be refreshed. Please reconnect your Google Calendar.');
        }
      }

      // Calculate time range (reuse 'now' from token expiry check)
      const timeMin = timeRange === 'recent'
        ? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 2 weeks ago
        : new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 6 months ago

      // Fetch events from Google Calendar
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      console.log(`📅 Fetching events from ${timeMin.toISOString()} to future...`);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        maxResults: 2500, // Increased for comprehensive sync
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: includeDeleted // This is key for deletion detection
      });

      const calendarEvents = response.data.items || [];
      console.log(`📊 Found ${calendarEvents.length} events in calendar`);

      // Get existing meetings from database in the same time range
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('starttime', timeMin.toISOString())
        .order('starttime');

      console.log(`💾 Found ${existingMeetings?.length || 0} existing meetings in database`);

      // Process sync results
      const syncResults = await this.processSyncResults(
        userId, 
        calendarEvents, 
        existingMeetings || [], 
        { dryRun }
      );

      // Update user's last sync time
      if (!dryRun) {
        await getSupabase()
          .from('users')
          .update({ last_calendar_sync: now.toISOString() })
          .eq('id', userId);
      }

      return syncResults;

    } catch (error) {
      console.error('Calendar sync error:', error);
      throw error;
    }
  }

  /**
   * Process sync results and handle additions, updates, deletions
   */
  async processSyncResults(userId, calendarEvents, existingMeetings, options = {}) {
    const { dryRun = false } = options;
    
    // Create maps for efficient lookup
    const calendarEventsMap = new Map(
      calendarEvents.map(event => [event.id, event])
    );

    const existingMeetingsMap = new Map(
      existingMeetings.map(meeting => [meeting.external_id, meeting])
    );

    const results = {
      added: 0,
      updated: 0,
      deleted: 0,
      restored: 0,
      errors: 0,
      details: {
        addedEvents: [],
        updatedEvents: [],
        deletedEvents: [],
        restoredEvents: [],
        errors: []
      }
    };

    // Process calendar events (additions and updates)
    for (const calendarEvent of calendarEvents) {
      try {
        if (calendarEvent.status === 'cancelled') {
          // Handle deleted events
          await this.handleDeletedEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun);
        } else {
          // Handle active events (add or update)
          await this.handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun);
        }
      } catch (error) {
        console.error(`Error processing event ${calendarEvent.id}:`, error);
        results.errors++;
        results.details.errors.push({
          eventId: calendarEvent.id,
          error: error.message
        });
      }
    }

    // Process database meetings that are no longer in calendar (deletions)
    for (const [eventId, meeting] of existingMeetingsMap) {
      if (!calendarEventsMap.has(eventId) && !meeting.is_deleted && !meeting.imported_from_ics) {
        // Meeting exists in database but not in calendar and wasn't imported from ICS
        try {
          await this.handleMissingEvent(userId, meeting, results, dryRun);
        } catch (error) {
          console.error(`Error handling missing event ${eventId}:`, error);
          results.errors++;
          results.details.errors.push({
            eventId,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Handle deleted/cancelled events
   */
  async handleDeletedEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun) {
    const existingMeeting = existingMeetingsMap.get(calendarEvent.id);
    
    if (existingMeeting && !existingMeeting.is_deleted) {
      // Mark as deleted in database
      if (!dryRun) {
        await getSupabase()
          .from('meetings')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            last_calendar_sync: new Date().toISOString()
          })
          .eq('external_id', calendarEvent.id)
          .eq('user_id', userId);

        // Cancel any associated Recall bots
        await this.cancelRecallBot(existingMeeting);
      }

      results.deleted++;
      results.details.deletedEvents.push({
        id: calendarEvent.id,
        title: existingMeeting.title,
        startTime: existingMeeting.starttime
      });

      console.log(`🗑️  Marked as deleted: ${existingMeeting.title}`);
    }
  }

  /**
   * Handle active events (add or update)
   */
  async handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun) {
    // Skip all-day events
    if (!calendarEvent.start?.dateTime) {
      return;
    }

    const existingMeeting = existingMeetingsMap.get(calendarEvent.id);
    const meetingData = this.extractMeetingData(userId, calendarEvent);

    if (existingMeeting) {
      // Check if meeting was previously deleted and is now restored
      if (existingMeeting.is_deleted) {
        if (!dryRun) {
          await getSupabase()
            .from('meetings')
            .update({
              ...meetingData,
              is_deleted: false,
              deleted_at: null,
              last_calendar_sync: new Date().toISOString()
            })
            .eq('external_id', calendarEvent.id)
            .eq('user_id', userId);
        }

        results.restored++;
        results.details.restoredEvents.push({
          id: calendarEvent.id,
          title: calendarEvent.summary
        });

        console.log(`🔄 Restored: ${calendarEvent.summary}`);
      } else {
        // Update existing meeting
        if (!dryRun) {
          await getSupabase()
            .from('meetings')
            .update({
              ...meetingData,
              last_calendar_sync: new Date().toISOString()
            })
            .eq('external_id', calendarEvent.id)
            .eq('user_id', userId);
        }

        results.updated++;
        results.details.updatedEvents.push({
          id: calendarEvent.id,
          title: calendarEvent.summary
        });
      }
    } else {
      // Add new meeting
      if (!dryRun) {
        const { error: insertError } = await getSupabase()
          .from('meetings')
          .insert(meetingData);

        if (insertError) {
          console.error(`❌ Failed to insert meeting "${calendarEvent.summary}":`, insertError);
          results.errors++;
          results.details.errors.push({
            event: calendarEvent.summary,
            error: insertError.message
          });
          return; // Skip this meeting
        }
      }

      results.added++;
      results.details.addedEvents.push({
        id: calendarEvent.id,
        title: calendarEvent.summary
      });

      console.log(`➕ Added: ${calendarEvent.summary}`);
    }
  }

  /**
   * Handle meetings that exist in database but not in calendar
   */
  async handleMissingEvent(userId, meeting, results, dryRun) {
    // Double-check by trying to fetch the specific event
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      await calendar.events.get({
        calendarId: 'primary',
        eventId: meeting.googleeventid
      });
      
      // Event still exists, no action needed
      return;
    } catch (error) {
      if (error.code === 404) {
        // Event definitely doesn't exist, mark as deleted
        if (!dryRun) {
          await getSupabase()
            .from('meetings')
            .update({
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              last_calendar_sync: new Date().toISOString()
            })
            .eq('id', meeting.id);

          // Cancel any associated Recall bots
          await this.cancelRecallBot(meeting);
        }

        results.deleted++;
        results.details.deletedEvents.push({
          id: meeting.googleeventid,
          title: meeting.title,
          startTime: meeting.starttime
        });

        console.log(`🗑️  Marked missing event as deleted: ${meeting.title}`);
      }
    }
  }

  /**
   * Cancel Recall bot for deleted meeting
   */
  async cancelRecallBot(meeting) {
    if (meeting.recall_bot_id) {
      try {
        // Update bot status to cancelled
        await getSupabase()
          .from('recall_bots')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('recall_bot_id', meeting.recall_bot_id);

        console.log(`🤖 Cancelled Recall bot for deleted meeting: ${meeting.recall_bot_id}`);
      } catch (error) {
        console.error('Error cancelling Recall bot:', error);
      }
    }
  }

  /**
   * Extract meeting data from Google Calendar event
   */
  extractMeetingData(userId, calendarEvent) {
    return {
      external_id: calendarEvent.id,
      user_id: userId,
      title: calendarEvent.summary || 'Untitled Meeting',
      starttime: calendarEvent.start.dateTime,
      endtime: calendarEvent.end?.dateTime || null,
      description: calendarEvent.description || '',
      location: calendarEvent.location || null,
      attendees: JSON.stringify(calendarEvent.attendees || []),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      meeting_source: 'google',
      last_calendar_sync: new Date().toISOString()
    };
  }

  /**
   * Get sync statistics for a user
   */
  async getSyncStats(userId) {
    const { data: meetings } = await getSupabase()
      .from('meetings')
      .select('is_deleted, imported_from_ics, last_calendar_sync')
      .eq('user_id', userId);

    const stats = {
      total: meetings?.length || 0,
      active: meetings?.filter(m => !m.is_deleted).length || 0,
      deleted: meetings?.filter(m => m.is_deleted).length || 0,
      imported: meetings?.filter(m => m.imported_from_ics).length || 0,
      lastSync: meetings?.reduce((latest, m) => {
        const syncTime = m.last_calendar_sync;
        return syncTime && (!latest || syncTime > latest) ? syncTime : latest;
      }, null)
    };

    return stats;
  }
}

module.exports = new CalendarSyncService();
