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
      // Get user's active calendar connection (Google OR Microsoft)
      const { data: connections, error: connError } = await getSupabase()
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('provider', ['google', 'microsoft']);

      if (connError || !connections || connections.length === 0) {
        console.error('Calendar connection error:', connError);
        throw new Error(`No active calendar connection found for user ${userId}. Please connect your calendar.`);
      }

      // Use the first active connection (user should only have one active at a time)
      const connection = connections[0];
      const provider = connection.provider;

      console.log(`📅 Found active ${provider} Calendar connection for user ${userId}`);

      if (!connection.access_token) {
        throw new Error(`${provider} Calendar token not available`);
      }

      console.log(`📅 Token expires: ${connection.token_expires_at}`);

      // Check if token is expired
      const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
      const now = new Date();
      const isExpired = expiresAt && expiresAt <= now;

      console.log(`🔐 Token status: ${isExpired ? 'EXPIRED' : 'VALID'} (expires: ${expiresAt?.toISOString() || 'unknown'})`);

      // Calculate time range
      const timeMin = timeRange === 'recent'
        ? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 2 weeks ago
        : new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 6 months ago

      let calendarEvents = [];

      // Fetch events based on provider
      if (provider === 'google') {
        calendarEvents = await this.fetchGoogleCalendarEvents(connection, timeMin, includeDeleted, isExpired);
      } else if (provider === 'microsoft') {
        calendarEvents = await this.fetchMicrosoftCalendarEvents(connection, userId, timeMin, includeDeleted, isExpired);
      }

      console.log(`📊 Found ${calendarEvents.length} events in ${provider} calendar`);

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
        { dryRun, provider }
      );

      // Update user's last sync time
      if (!dryRun) {
        await getSupabase()
          .from('users')
          .update({ last_calendar_sync: now.toISOString() })
          .eq('id', userId);
      }

      // After syncing meetings, extract and associate clients
      if (syncResults.added > 0 || syncResults.updated > 0 || syncResults.restored > 0) {
        try {
          console.log('🔄 Starting client extraction from synced meetings...');
          const clientExtractionService = require('./clientExtraction');
          const extractionResult = await clientExtractionService.linkMeetingsToClients(userId);
          console.log('✅ Client extraction completed:', extractionResult);

          // Add extraction results to sync results
          syncResults.clientsCreated = extractionResult.clientsCreated || 0;
          syncResults.clientsLinked = extractionResult.linked || 0;
        } catch (error) {
          console.error('❌ Error extracting clients from synced meetings:', error);
          // Don't fail the whole sync if client extraction fails
          syncResults.clientsCreated = 0;
          syncResults.clientsLinked = 0;
        }
      } else {
        syncResults.clientsCreated = 0;
        syncResults.clientsLinked = 0;
      }

      return syncResults;

    } catch (error) {
      console.error('Calendar sync error:', error);
      throw error;
    }
  }

  /**
   * Fetch events from Google Calendar
   */
  async fetchGoogleCalendarEvents(connection, timeMin, includeDeleted, isExpired) {
    console.log('📅 Fetching events from Google Calendar...');

    // Set up OAuth client
    this.oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null
    });

    // If token is expired, try to refresh it
    if (isExpired && connection.refresh_token) {
      console.log('🔄 Refreshing expired Google access token...');
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

        console.log(`✅ Google token refreshed successfully, new expiry: ${newExpiresAt.toISOString()}`);
      } catch (refreshError) {
        console.error('❌ Failed to refresh Google token:', refreshError);
        throw new Error('Google Calendar token expired and could not be refreshed. Please reconnect your Google Calendar.');
      }
    }

    // Fetch events from Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    console.log(`📅 Fetching Google events from ${timeMin.toISOString()} to future...`);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: includeDeleted,
      fields: 'items(id,summary,start,end,location,description,attendees,status,conferenceData)'
    });

    return response.data.items || [];
  }

  /**
   * Fetch events from Microsoft Calendar
   */
  async fetchMicrosoftCalendarEvents(connection, userId, timeMin, includeDeleted, isExpired) {
    console.log('📅 Fetching events from Microsoft Calendar...');

    const MicrosoftCalendarService = require('./microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    // Refresh token if expired
    if (isExpired && connection.refresh_token) {
      console.log('🔄 Refreshing expired Microsoft access token...');
      try {
        const refreshedTokens = await microsoftService.refreshAccessToken(connection.refresh_token);

        // Update tokens in database
        await getSupabase()
          .from('calendar_connections')
          .update({
            access_token: refreshedTokens.accessToken,
            token_expires_at: refreshedTokens.expiresOn ? new Date(refreshedTokens.expiresOn).toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        console.log('✅ Microsoft token refreshed successfully');

        // Update connection object with new token
        connection.access_token = refreshedTokens.accessToken;
      } catch (refreshError) {
        console.error('❌ Failed to refresh Microsoft token:', refreshError);
        throw new Error('Microsoft Calendar token expired and could not be refreshed. Please reconnect your Microsoft Calendar.');
      }
    }

    // Get Microsoft Graph client
    const client = microsoftService.getGraphClient(connection.access_token);

    console.log(`📅 Fetching Microsoft events from ${timeMin.toISOString()} to future...`);

    // Fetch events using calendarView (supports time range filtering)
    const endDateTime = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(); // 1 year ahead

    const response = await client
      .api('/me/calendar/calendarView')
      .query({
        startDateTime: timeMin.toISOString(),
        endDateTime: endDateTime,
        // IMPORTANT: Use 'onlineMeeting' NOT 'onlineMeetingUrl' - Microsoft deprecated onlineMeetingUrl
        // The actual Teams join URL is in onlineMeeting.joinUrl
        $select: 'id,subject,start,end,location,attendees,body,isOnlineMeeting,onlineMeeting,isCancelled',
        $orderby: 'start/dateTime',
        $top: 2500
      })
      .get();

    // Transform Microsoft events to match Google Calendar format
    const events = (response.value || []).map(event => {
      // Extract Teams meeting URL from onlineMeeting.joinUrl (NOT onlineMeetingUrl which is deprecated/null)
      const teamsJoinUrl = event.onlineMeeting?.joinUrl || null;

      return {
        id: event.id,
        summary: event.subject,
        start: {
          dateTime: event.start?.dateTime,
          timeZone: event.start?.timeZone
        },
        end: {
          dateTime: event.end?.dateTime,
          timeZone: event.end?.timeZone
        },
        location: event.location?.displayName || '',
        description: event.body?.content || '',
        attendees: event.attendees?.map(a => ({
          email: a.emailAddress?.address,
          displayName: a.emailAddress?.name,
          responseStatus: a.status?.response
        })) || [],
        status: event.isCancelled ? 'cancelled' : 'confirmed',
        conferenceData: (event.isOnlineMeeting && teamsJoinUrl) ? {
          entryPoints: [{
            entryPointType: 'video',
            uri: teamsJoinUrl
          }]
        } : null
      };
    });

    return events;
  }

  /**
   * Process sync results and handle additions, updates, deletions
   */
  async processSyncResults(userId, calendarEvents, existingMeetings, options = {}) {
    const { dryRun = false, provider = 'google' } = options;
    
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
          await this.handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun, provider);
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
  async handleActiveEvent(userId, calendarEvent, existingMeetingsMap, results, dryRun, provider = 'google') {
    // Skip all-day events
    if (!calendarEvent.start?.dateTime) {
      return;
    }

    const existingMeeting = existingMeetingsMap.get(calendarEvent.id);
    const meetingData = this.extractMeetingData(userId, calendarEvent, provider);

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

        // Schedule Recall bot if transcription is enabled AND meeting is happening now / very soon AND user has access
        try {
          const { data: connections } = await getSupabase()
            .from('calendar_connections')
            .select('transcription_enabled, provider')
            .eq('user_id', userId)
            .eq('is_active', true)
            .in('provider', ['google', 'microsoft']);

          const connection = connections?.[0];

          if (connection?.transcription_enabled) {
            const now = new Date();
            const start = new Date(calendarEvent.start.dateTime || calendarEvent.start.date);
            const end = new Date(calendarEvent.end?.dateTime || calendarEvent.end?.date || start);

            const alreadyOver = end <= now;
            const startsTooFarInFuture = start.getTime() - now.getTime() > 15 * 60 * 1000; // more than 15 minutes ahead

            if (!alreadyOver && !startsTooFarInFuture) {
              // Check if user has transcription access (5 free meetings or paid subscription)
              const hasAccess = await this.checkUserHasTranscriptionAccess(userId);

              if (hasAccess) {
                await this.scheduleRecallBotForMeeting(calendarEvent, newMeeting.id, userId);
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
              console.log(
                `⏭️  Skipping Recall bot for meeting outside live window: ${calendarEvent.summary} (start=${start.toISOString()}, end=${end.toISOString()})`
              );
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
   * Extract meeting URL from calendar event (Google Meet, Zoom, Teams, Webex)
   * Works for both Google Calendar and Microsoft/Outlook events
   */
  extractMeetingUrl(calendarEvent) {
    let meetingUrl = null;

    // 1. Check Google Meet / Microsoft Teams conferenceData
    if (calendarEvent.conferenceData?.entryPoints) {
      const videoEntry = calendarEvent.conferenceData.entryPoints
        .find(ep => ep.entryPointType === 'video');
      if (videoEntry?.uri) {
        meetingUrl = videoEntry.uri;
      }
    }

    // 2. Check for URLs in location field
    if (!meetingUrl && calendarEvent.location) {
      const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
      const urls = calendarEvent.location.match(urlRegex) || [];
      for (const url of urls) {
        if (url.includes('zoom.us') || url.includes('teams.microsoft.com') ||
            url.includes('webex.com') || url.includes('meet.google.com') ||
            url.includes('gotomeeting.com')) {
          meetingUrl = url;
          break;
        }
      }
    }

    // 3. Check for URLs in description field
    if (!meetingUrl && calendarEvent.description) {
      const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
      const urls = calendarEvent.description.match(urlRegex) || [];
      for (const url of urls) {
        if (url.includes('zoom.us') || url.includes('teams.microsoft.com') ||
            url.includes('webex.com') || url.includes('meet.google.com') ||
            url.includes('gotomeeting.com')) {
          meetingUrl = url;
          break;
        }
      }
    }

    return meetingUrl;
  }

  /**
   * Extract meeting data from calendar event (Google or Microsoft)
   */
  extractMeetingData(userId, calendarEvent, provider = 'google') {
    // Extract meeting URL from conferenceData, location, or description
    const meetingUrl = this.extractMeetingUrl(calendarEvent);

    return {
      external_id: calendarEvent.id,
      user_id: userId,
      title: calendarEvent.summary || 'Untitled Meeting',
      starttime: calendarEvent.start.dateTime,
      endtime: calendarEvent.end?.dateTime || null,
      description: calendarEvent.description || '',
      location: calendarEvent.location || null,
      attendees: JSON.stringify(calendarEvent.attendees || []),
      meeting_url: meetingUrl, // Store the extracted meeting URL
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      meeting_source: provider, // 'google' or 'microsoft'
      last_calendar_sync: new Date().toISOString()
    };
  }

  /**
   * Schedule Recall bot for a meeting (only when live / starting very soon)
   */
  async scheduleRecallBotForMeeting(event, meetingId, userId) {
    try {
      const now = new Date();
      const start = new Date(event.start?.dateTime || event.start?.date || new Date());
      const end = new Date(event.end?.dateTime || event.end?.date || start);

      // Only create a bot if the meeting is in progress or starting very soon
      const graceMs = 5 * 60 * 1000; // 5-minute grace period before start
      const inProgressOrJustStarting =
        start.getTime() - graceMs <= now.getTime() &&
        now.getTime() <= end.getTime();

      if (!inProgressOrJustStarting) {
        console.log(
          `⏭️  Not creating Recall bot for event outside live window: "${event.summary || event.id}" (start=${start.toISOString()}, end=${end.toISOString()})`
        );
        return;
      }

      // Extract meeting URL using shared helper function
      const meetingUrl = this.extractMeetingUrl(event);

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
