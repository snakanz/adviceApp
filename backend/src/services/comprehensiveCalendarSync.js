const { google } = require('googleapis');
const { getSupabase } = require('../config/supabase');

class ComprehensiveCalendarSync {
  constructor() {
    this.oauth2Client = null;
  }

  /**
   * Initialize OAuth2 client with user tokens
   */
  async initializeAuth(userId) {
    const { data: user } = await getSupabase()
      .from('users')
      .select('googleaccesstoken, googlerefreshtoken')
      .eq('id', userId)
      .single();

    if (!user?.googleaccesstoken) {
      throw new Error('No Google access token found for user');
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: user.googleaccesstoken,
      refresh_token: user.googlerefreshtoken
    });
  }

  /**
   * Fetch all events from Google Calendar
   */
  async fetchGoogleCalendarEvents(userId, timeMin = null, timeMax = null) {
    await this.initializeAuth(userId);
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    const params = {
      calendarId: 'primary',
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false // Only get active events
    };

    if (timeMin) params.timeMin = timeMin;
    if (timeMax) params.timeMax = timeMax;

    try {
      const response = await calendar.events.list(params);
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error;
    }
  }

  /**
   * Fetch all meetings from database
   */
  async fetchDatabaseMeetings(userId) {
    const { data: meetings } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .order('starttime', { ascending: false });

    return meetings || [];
  }

  /**
   * Detect calendar state and categorize data
   */
  async detectCalendarState(userId) {
    console.log(`🔍 Detecting calendar state for user ${userId}...`);
    
    // Fetch data from both sources
    const calendarEvents = await this.fetchGoogleCalendarEvents(userId);
    const databaseMeetings = await this.fetchDatabaseMeetings(userId);
    
    console.log(`📅 Found ${calendarEvents.length} events in Google Calendar`);
    console.log(`💾 Found ${databaseMeetings.length} meetings in database`);

    // Create maps for efficient lookup
    const calendarEventMap = new Map(calendarEvents.map(event => [event.id, event]));
    const databaseMeetingMap = new Map(databaseMeetings.map(meeting => [meeting.googleeventid, meeting]));

    const analysis = {
      calendar: {
        total: calendarEvents.length,
        events: calendarEvents
      },
      database: {
        total: databaseMeetings.length,
        active: databaseMeetings.filter(m => !m.is_deleted).length,
        deleted: databaseMeetings.filter(m => m.is_deleted).length,
        meetings: databaseMeetings
      },
      categorization: {
        active: [], // Exists in both calendar and database
        deleted: [], // Exists in database but not in calendar
        orphaned: [], // Historical data with no calendar reference
        new: [], // Exists in calendar but not in database
        inconsistent: [] // Exists in both but with different data
      }
    };

    // Categorize database meetings
    for (const meeting of databaseMeetings) {
      const calendarEvent = calendarEventMap.get(meeting.googleeventid);
      
      if (calendarEvent) {
        // Meeting exists in both - check if it should be active
        if (meeting.is_deleted) {
          // Meeting was marked deleted but exists in calendar - inconsistent
          analysis.categorization.inconsistent.push({
            type: 'deleted_but_exists',
            meeting,
            calendarEvent
          });
        } else {
          analysis.categorization.active.push({
            meeting,
            calendarEvent
          });
        }
      } else {
        // Meeting exists in database but not in calendar
        if (meeting.is_deleted) {
          analysis.categorization.orphaned.push(meeting);
        } else {
          analysis.categorization.deleted.push(meeting);
        }
      }
    }

    // Find new events in calendar
    for (const event of calendarEvents) {
      if (!databaseMeetingMap.has(event.id)) {
        analysis.categorization.new.push(event);
      }
    }

    console.log(`📊 Analysis complete:`);
    console.log(`   Active: ${analysis.categorization.active.length}`);
    console.log(`   Deleted: ${analysis.categorization.deleted.length}`);
    console.log(`   Orphaned: ${analysis.categorization.orphaned.length}`);
    console.log(`   New: ${analysis.categorization.new.length}`);
    console.log(`   Inconsistent: ${analysis.categorization.inconsistent.length}`);

    return analysis;
  }

  /**
   * Reconcile calendar data with database
   */
  async reconcileCalendarData(userId, dryRun = false) {
    console.log(`🔄 Starting calendar reconciliation for user ${userId} (dry run: ${dryRun})`);
    
    const analysis = await this.detectCalendarState(userId);
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      restored: 0,
      errors: 0,
      details: {
        createdMeetings: [],
        updatedMeetings: [],
        deletedMeetings: [],
        restoredMeetings: [],
        errors: []
      }
    };

    try {
      // Process deleted meetings (exist in DB but not in calendar)
      for (const meeting of analysis.categorization.deleted) {
        if (!dryRun) {
          await this.markMeetingAsDeleted(meeting.id);
        }
        results.deleted++;
        results.details.deletedMeetings.push({
          id: meeting.id,
          title: meeting.title,
          googleEventId: meeting.googleeventid
        });
      }

      // Process inconsistent meetings (marked deleted but exist in calendar)
      for (const item of analysis.categorization.inconsistent) {
        if (item.type === 'deleted_but_exists') {
          if (!dryRun) {
            await this.restoreMeeting(item.meeting.id);
          }
          results.restored++;
          results.details.restoredMeetings.push({
            id: item.meeting.id,
            title: item.meeting.title,
            googleEventId: item.meeting.googleeventid
          });
        }
      }

      // Process new meetings (exist in calendar but not in DB)
      for (const event of analysis.categorization.new) {
        if (!dryRun) {
          await this.createMeetingFromCalendarEvent(event, userId);
        }
        results.created++;
        results.details.createdMeetings.push({
          googleEventId: event.id,
          title: event.summary || 'Untitled Event'
        });
      }

      results.processed = results.created + results.updated + results.deleted + results.restored;

      // Update client statuses after all changes
      if (!dryRun) {
        await this.updateAllClientStatuses(userId);
      }

      console.log(`✅ Reconciliation complete: ${results.processed} items processed`);
      return results;

    } catch (error) {
      console.error('Error during reconciliation:', error);
      results.errors++;
      results.details.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Mark a meeting as deleted
   */
  async markMeetingAsDeleted(meetingId) {
    const { error } = await getSupabase()
      .from('meetings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        last_calendar_sync: new Date().toISOString(),
        sync_status: 'deleted'
      })
      .eq('id', meetingId);

    if (error) throw error;
  }

  /**
   * Restore a deleted meeting
   */
  async restoreMeeting(meetingId) {
    const { error } = await getSupabase()
      .from('meetings')
      .update({
        is_deleted: false,
        deleted_at: null,
        last_calendar_sync: new Date().toISOString(),
        sync_status: 'active'
      })
      .eq('id', meetingId);

    if (error) throw error;
  }

  /**
   * Create meeting from calendar event
   */
  async createMeetingFromCalendarEvent(event, userId) {
    const meetingData = {
      user_id: userId,
      external_id: event.id,
      title: event.summary || 'Untitled Event',
      starttime: event.start?.dateTime || event.start?.date,
      endtime: event.end?.dateTime || event.end?.date,
      description: event.description || null,
      attendees: event.attendees ? JSON.stringify(event.attendees) : null,
      is_deleted: false,
      meeting_source: 'google',
      last_calendar_sync: new Date().toISOString()
    };

    const { error } = await getSupabase()
      .from('meetings')
      .insert(meetingData);

    if (error) throw error;
  }

  /**
   * Update all client statuses (triggers will handle this automatically)
   */
  async updateAllClientStatuses(userId) {
    // The triggers we created will automatically update client statuses
    // This is just a manual refresh to ensure consistency
    const { data: clients } = await getSupabase()
      .from('clients')
      .select('id')
      .eq('advisor_id', userId);

    if (clients) {
      for (const client of clients) {
        // Trigger the update by touching the client record
        await getSupabase()
          .from('clients')
          .update({ last_activity_sync: new Date().toISOString() })
          .eq('id', client.id);
      }
    }
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId) {
    const analysis = await this.detectCalendarState(userId);
    
    return {
      lastSync: new Date().toISOString(),
      calendarEvents: analysis.calendar.total,
      databaseMeetings: analysis.database.total,
      activeMeetings: analysis.database.active,
      deletedMeetings: analysis.database.deleted,
      needsSync: analysis.categorization.deleted.length > 0 || 
                 analysis.categorization.new.length > 0 || 
                 analysis.categorization.inconsistent.length > 0,
      issues: {
        orphaned: analysis.categorization.orphaned.length,
        inconsistent: analysis.categorization.inconsistent.length,
        needsCreation: analysis.categorization.new.length,
        needsDeletion: analysis.categorization.deleted.length
      }
    };
  }
}

module.exports = new ComprehensiveCalendarSync();
