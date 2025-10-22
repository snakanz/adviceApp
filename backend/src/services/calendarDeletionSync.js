const { google } = require('googleapis');
const { getSupabase } = require('../lib/supabase');

/**
 * Simple Calendar Deletion Detection Service
 * Handles calendar sync with deletion detection
 */
class CalendarDeletionSync {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Sync calendar with deletion detection
   */
  async syncCalendarWithDeletions(userId) {
    console.log(`🔄 Starting calendar sync with deletion detection for user ${userId}...`);

    try {
      // Get user's calendar token from calendartoken table
      const { data: calendarToken, error: tokenError } = await getSupabase()
        .from('calendartoken')
        .select('*')
        .eq('userid', userId)
        .single();

      if (tokenError || !calendarToken) {
        console.error('Calendar token error:', tokenError);
        throw new Error(`No calendar token found for user ${userId}. Please reconnect your Google Calendar.`);
      }

      console.log(`📅 Found calendar token for user ${userId}, expires: ${calendarToken.expiresat}`);

      // Check if token is expired
      const expiresAt = new Date(calendarToken.expiresat);
      const now = new Date();
      const isExpired = expiresAt <= now;

      console.log(`🔐 Token status: ${isExpired ? 'EXPIRED' : 'VALID'} (expires: ${expiresAt.toISOString()})`);

      // Set up OAuth client
      this.oauth2Client.setCredentials({
        access_token: calendarToken.accesstoken,
        refresh_token: calendarToken.refreshtoken,
        expiry_date: expiresAt.getTime()
      });

      // If token is expired, try to refresh it
      if (isExpired && calendarToken.refreshtoken) {
        console.log('🔄 Refreshing expired access token...');
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();

          // Update the token in database
          const newExpiresAt = new Date(credentials.expiry_date);
          await getSupabase()
            .from('calendartoken')
            .update({
              accesstoken: credentials.access_token,
              expiresat: newExpiresAt.toISOString(),
              updatedat: new Date().toISOString()
            })
            .eq('userid', userId);

          console.log(`✅ Token refreshed successfully, new expiry: ${newExpiresAt.toISOString()}`);
        } catch (refreshError) {
          console.error('❌ Failed to refresh token:', refreshError);
          throw new Error('Google Calendar token expired and could not be refreshed. Please reconnect your Google Calendar.');
        }
      }

      // Get calendar events (including deleted ones)
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Sync last 2 months to future
      const now = new Date();
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      console.log(`📅 Fetching events from ${twoMonthsAgo.toISOString()}...`);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: twoMonthsAgo.toISOString(),
        maxResults: 1000,
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: true // This is the key for deletion detection
      });

      const calendarEvents = response.data.items || [];
      console.log(`📊 Found ${calendarEvents.length} events in calendar`);

      // Get existing meetings from database
      const { data: existingMeetings } = await getSupabase()
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('starttime', twoMonthsAgo.toISOString());

      console.log(`💾 Found ${existingMeetings?.length || 0} existing meetings in database`);

      // Process sync
      const results = await this.processSync(userId, calendarEvents, existingMeetings || []);

      console.log('✅ Sync completed:', results);
      return results;

    } catch (error) {
      console.error('❌ Calendar sync error:', error);
      throw error;
    }
  }

  /**
   * Process the sync between calendar and database
   */
  async processSync(userId, calendarEvents, existingMeetings) {
    const results = {
      added: 0,
      updated: 0,
      deleted: 0,
      restored: 0,
      errors: 0
    };

    // Create maps for efficient lookup
    const calendarEventsMap = new Map(
      calendarEvents.map(event => [event.id, event])
    );

    const existingMeetingsMap = new Map(
      existingMeetings.map(meeting => [meeting.external_id, meeting])
    );

    // Process calendar events
    for (const calendarEvent of calendarEvents) {
      try {
        if (calendarEvent.status === 'cancelled') {
          // Handle deleted events
          await this.handleDeletedEvent(userId, calendarEvent, existingMeetingsMap, results);
        } else if (calendarEvent.start?.dateTime) {
          // Handle active events (skip all-day events)
          await this.handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results);
        }
      } catch (error) {
        console.error(`Error processing event ${calendarEvent.id}:`, error);
        results.errors++;
      }
    }

    // Check for meetings in database that are no longer in calendar
    for (const [eventId, meeting] of existingMeetingsMap) {
      if (!calendarEventsMap.has(eventId) && !meeting.is_deleted && !meeting.imported_from_ics) {
        try {
          await this.handleMissingEvent(userId, meeting, results);
        } catch (error) {
          console.error(`Error handling missing event ${eventId}:`, error);
          results.errors++;
        }
      }
    }

    return results;
  }

  /**
   * Handle deleted/cancelled events
   */
  async handleDeletedEvent(userId, calendarEvent, existingMeetingsMap, results) {
    const existingMeeting = existingMeetingsMap.get(calendarEvent.id);
    
    if (existingMeeting && !existingMeeting.is_deleted) {
      // Mark as deleted in database
      await getSupabase()
        .from('meetings')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          last_calendar_sync: new Date().toISOString()
        })
        .eq('external_id', calendarEvent.id)
        .eq('user_id', userId);

      results.deleted++;
      console.log(`🗑️  Marked as deleted: ${existingMeeting.title}`);
    }
  }

  /**
   * Handle active events (add or update)
   */
  async handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results) {
    const existingMeeting = existingMeetingsMap.get(calendarEvent.id);
    const meetingData = {
      googleeventid: calendarEvent.id,
      userid: userId,
      title: calendarEvent.summary || 'Untitled Meeting',
      starttime: calendarEvent.start.dateTime,
      endtime: calendarEvent.end?.dateTime || null,
      summary: calendarEvent.description || '',
      location: calendarEvent.location || null,
      attendees: JSON.stringify(calendarEvent.attendees || []),
      updatedat: new Date().toISOString(),
      last_calendar_sync: new Date().toISOString()
    };

    if (existingMeeting) {
      if (existingMeeting.is_deleted) {
        // Restore previously deleted meeting
        await getSupabase()
          .from('meetings')
          .update({
            ...meetingData,
            is_deleted: false
          })
          .eq('external_id', calendarEvent.id)
          .eq('user_id', userId);

        results.restored++;
        console.log(`🔄 Restored: ${calendarEvent.summary}`);
      } else {
        // Update existing meeting
        await getSupabase()
          .from('meetings')
          .update(meetingData)
          .eq('external_id', calendarEvent.id)
          .eq('user_id', userId);

        results.updated++;
      }
    } else {
      // Add new meeting
      await getSupabase()
        .from('meetings')
        .insert(meetingData);

      results.added++;
      console.log(`➕ Added: ${calendarEvent.summary}`);
    }
  }

  /**
   * Handle meetings that exist in database but not in calendar
   */
  async handleMissingEvent(userId, meeting, results) {
    // Double-check by trying to fetch the specific event
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      await calendar.events.get({
        calendarId: 'primary',
        eventId: meeting.external_id
      });

      // Event still exists, no action needed
      return;
    } catch (error) {
      if (error.code === 404) {
        // Event definitely doesn't exist, mark as deleted
        await getSupabase()
          .from('meetings')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            last_calendar_sync: new Date().toISOString()
          })
          .eq('id', meeting.id);

        results.deleted++;
        console.log(`🗑️  Marked missing event as deleted: ${meeting.title}`);
      }
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(userId) {
    const { data: meetings } = await getSupabase()
      .from('meetings')
      .select('is_deleted, imported_from_ics, last_calendar_sync')
      .eq('userid', userId);

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

  /**
   * Get deleted meetings for recovery
   */
  async getDeletedMeetings(userId, limit = 20) {
    const { data: deletedMeetings } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false })
      .limit(limit);

    return deletedMeetings || [];
  }

  /**
   * Restore a deleted meeting
   */
  async restoreMeeting(userId, eventId) {
    const { error } = await getSupabase()
      .from('meetings')
      .update({
        is_deleted: false,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', eventId)
      .eq('user_id', userId)
      .eq('is_deleted', true);

    if (error) {
      throw error;
    }

    return { success: true };
  }
}

module.exports = new CalendarDeletionSync();
