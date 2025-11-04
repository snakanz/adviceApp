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
        showDeleted: includeDeleted, // This is key for deletion detection
        fields: 'items(id,summary,start,end,location,description,attendees,status,conferenceData)' // Request attendees data and conference data for meeting URLs
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
        const { error: insertError, data: newMeeting } = await getSupabase()
          .from('meetings')
          .insert(meetingData)
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Failed to insert meeting "${calendarEvent.summary}":`, insertError);
          results.errors++;
          results.details.errors.push({
            event: calendarEvent.summary,
            error: insertError.message
          });
          return; // Skip this meeting
        }

        // Schedule Recall bot if transcription is enabled AND meeting is in the future AND user has access
        try {
          const connection = await getSupabase()
            .from('calendar_connections')
            .select('transcription_enabled')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .eq('is_active', true)
            .single();

          if (connection.data?.transcription_enabled) {
            const now = new Date();
            const meetingStart = new Date(calendarEvent.start.dateTime || calendarEvent.start.date);

            if (meetingStart > now) {
              // Check if user has transcription access (5 free meetings or paid subscription)
              const hasAccess = await this.checkUserHasTranscriptionAccess(userId);

              if (hasAccess) {
                // Check if meeting is within 30 days (don't schedule bots too far in advance)
                const daysUntilMeeting = (meetingStart - now) / (1000 * 60 * 60 * 24);

                if (daysUntilMeeting <= 30) {
                  await this.scheduleRecallBotForMeeting(calendarEvent, newMeeting.id, userId);
                } else {
                  console.log(`⏭️  Skipping Recall bot for meeting too far in future: ${calendarEvent.summary} (${Math.round(daysUntilMeeting)} days away)`);
                }
              } else {
                console.log(`⏭️  User ${userId} has exceeded free meeting limit. Skipping bot for: ${calendarEvent.summary}`);

                // Update meeting with upgrade_required status
                await getSupabase()
                  .from('meetings')
                  .update({
                    recall_status: 'upgrade_required',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', newMeeting.id);
              }
            } else {
              console.log(`⏭️  Skipping Recall bot for past meeting: ${calendarEvent.summary} (${meetingStart.toISOString()})`);
            }
          }
        } catch (recallError) {
          console.warn(`⚠️  Failed to schedule Recall bot for meeting ${newMeeting?.id}:`, recallError.message);
          // Don't fail the sync if Recall scheduling fails
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
   * Check if user has access to transcription (5 free meetings or paid subscription)
   */
  async checkUserHasTranscriptionAccess(userId) {
    try {
      // Get subscription
      const { data: subscription } = await getSupabase()
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check if user has active paid subscription
      const isPaid = subscription &&
                     (subscription.status === 'active' || subscription.status === 'trialing') &&
                     subscription.plan !== 'free';

      if (isPaid) {
        return true; // User has paid, unlimited access
      }

      // Count meetings with successful Recall bot transcription
      const { count } = await getSupabase()
        .from('meetings')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .not('recall_bot_id', 'is', null)
        .in('recall_status', ['completed', 'done']);

      const meetingsTranscribed = count || 0;
      const freeLimit = subscription?.free_meetings_limit || 5;

      return meetingsTranscribed < freeLimit;
    } catch (error) {
      console.error('Error checking transcription access:', error);
      return false; // Fail closed - don't schedule bot if we can't verify access
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
   * Schedule Recall bot for a meeting (only for future meetings)
   */
  async scheduleRecallBotForMeeting(event, meetingId, userId) {
    try {
      // Extract meeting URL from event
      let meetingUrl = null;

      // Google Meet
      if (event.conferenceData?.entryPoints) {
        const videoEntry = event.conferenceData.entryPoints
          .find(ep => ep.entryPointType === 'video');
        if (videoEntry) meetingUrl = videoEntry.uri;
      }

      // Zoom/Teams/Webex in location or description
      if (!meetingUrl) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = (event.location || event.description || '').match(urlRegex) || [];

        for (const url of urls) {
          if (url.includes('zoom.us') || url.includes('teams.microsoft.com') ||
              url.includes('webex.com') || url.includes('meet.google.com')) {
            meetingUrl = url;
            break;
          }
        }
      }

      if (!meetingUrl) {
        console.log(`⚠️  No meeting URL found for event ${event.id}`);
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
        bot_name: 'Advicly Notetaker',
        recording_config: {
          transcript: {
            provider: {
              meeting_captions: {} // FREE transcription
            }
          }
        },
        automatic_leave: {
          // OPTIMIZED: Detect other bots and leave after 5 minutes (was 10 minutes)
          bot_detection: {
            using_participant_names: {
              matches: ['bot', 'notetaker', 'recall', 'advicly', 'fireflies', 'otter', 'fathom', 'grain', 'sembly', 'airgram'],
              timeout: 300, // Leave after 5 minutes if bot detected (was 600)
              activate_after: 600 // Start checking after 10 minutes (was 1200)
            }
          },
          // Leave 5 seconds after everyone else has left
          everyone_left_timeout: {
            timeout: 5,
            activate_after: 60 // Start checking after 1 minute
          },
          // OPTIMIZED: Leave after 5 minutes in waiting room (was 20 minutes)
          // Recall.ai charges for waiting room time, so minimize it
          // 95% of bots that get admitted are let in within 9 minutes
          waiting_room_timeout: 300, // 5 minutes (was 1200)
          // Leave after 30 seconds if recording permission denied
          recording_permission_denied_timeout: 30,
          // OPTIMIZED: Leave after 30 minutes of continuous silence (was 60 minutes)
          silence_detection: {
            timeout: 1800, // 30 minutes (was 3600)
            activate_after: 600 // Start checking after 10 minutes (was 1200)
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

      console.log(`✅ Recall bot scheduled for meeting ${meetingId}: ${response.data.id}`);

    } catch (error) {
      // Check for insufficient credits error (402)
      if (error.response?.status === 402) {
        console.error('❌ CRITICAL: Insufficient Recall.ai credits! Please top up your account.');
        console.error('   Visit: https://recall.ai/dashboard to add credits');

        // Update meeting with error status
        await getSupabase()
          .from('meetings')
          .update({
            recall_status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);
      } else {
        console.error('Error scheduling Recall bot:', error.response?.data || error.message);
      }
      throw error;
    }
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
