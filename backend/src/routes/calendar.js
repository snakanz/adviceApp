const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const calendarService = require('../services/calendar');
// const meetingService = require('../services/meeting'); // Removed because file does not exist
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const openai = require('../services/openai');
const { google } = require('googleapis');
const { getGoogleAuthClient, refreshAccessToken } = require('../services/calendar');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const calendarSyncService = require('../services/calendarSync');
const fileUploadService = require('../services/fileUpload'); // Legacy - kept for backward compatibility
const clientDocumentsService = require('../services/clientDocuments'); // Unified document system
const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');

// Get Google Calendar auth URL (for popup-based reconnection)
router.get('/auth/google', async (req, res) => {
  try {
    console.log('📅 /auth/google endpoint called');
    console.log('🔐 Environment check:');
    console.log('  - GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.log('  - GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('  - GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || '❌ Missing');

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('❌ Missing Google OAuth environment variables');
      return res.status(500).json({
        error: 'Google OAuth not configured',
        details: 'Missing environment variables'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    console.log('✅ OAuth URL generated successfully');
    // Return URL instead of redirecting (for popup-based flow)
    res.json({ url });
  } catch (error) {
    console.error('❌ Error generating OAuth URL:', error);
    res.status(500).json({
      error: 'Failed to generate OAuth URL',
      details: error.message
    });
  }
});

// Handle Google Calendar OAuth callback
// This route handles both initial login and reconnection from settings
// If state parameter is present, it's a reconnection from settings (popup-based)
// Otherwise, it's an initial login (redirect-based)
router.get('/auth/google/callback', async (req, res) => {
  const { code, error, state } = req.query;

  console.log('📅 /auth/google/callback called');
  console.log('  - code:', code ? '✅ Present' : '❌ Missing');
  console.log('  - error:', error || 'None');
  console.log('  - state:', state ? '✅ Present (popup mode)' : '❌ Missing (redirect mode)');

  if (error) {
    console.error('❌ OAuth error from Google:', error);
    // If this is a popup-based reconnection, send error to parent window
    if (state) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_OAUTH_ERROR',
                  error: '${error}'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: ${error}</p>
          </body>
        </html>
      `);
    }
    // Otherwise, redirect to login page
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    if (state) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_OAUTH_ERROR',
                  error: 'No authorization code received'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: No authorization code received</p>
          </body>
        </html>
      `);
    }
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=NoCode`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // ✅ POPUP-BASED RECONNECTION (state parameter present)
    if (state) {
      console.log(`🔄 Google OAuth reconnection for user: ${state}`);

      // Verify user exists and get tenant_id
      const { data: user, error: userError } = await getSupabase()
        .from('users')
        .select('id, email, tenant_id')
        .eq('id', state)
        .single();

      if (userError || !user) {
        console.error('❌ User not found:', userError);
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'GOOGLE_OAUTH_ERROR',
                    error: 'User not found'
                  }, '*');
                }
                window.close();
              </script>
              <p>Error: User not found</p>
            </body>
          </html>
        `);
      }

      if (!user.tenant_id) {
        console.error('❌ User has no tenant_id:', state);
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'GOOGLE_OAUTH_ERROR',
                    error: 'User has no tenant'
                  }, '*');
                }
                window.close();
              </script>
              <p>Error: User has no tenant</p>
            </body>
          </html>
        `);
      }

      // Deactivate other active connections
      await getSupabase()
        .from('calendar_connections')
        .update({ is_active: false })
        .eq('user_id', state)
        .neq('provider', 'google');

      // Create or update Google connection
      const { data: existingConnection } = await getSupabase()
        .from('calendar_connections')
        .select('id')
        .eq('user_id', state)
        .eq('provider', 'google')
        .single();

      if (existingConnection) {
        // Update existing connection
        await getSupabase()
          .from('calendar_connections')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            is_active: true,
            is_primary: true,
            sync_enabled: true,
            transcription_enabled: true,  // Enabled by default for better UX - users can disable in settings
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConnection.id);

        console.log(`✅ Updated Google Calendar connection for user ${state}`);

        // Trigger initial sync to fetch existing Google Calendar meetings (in background, non-blocking)
        try {
          console.log('🔄 Triggering initial Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');
          // Don't await - let it run in background
          calendarSyncService.syncUserCalendar(state, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
            console.log('✅ Initial Google Calendar sync completed:', syncResult);
          }).catch(syncError => {
            console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
          });
        } catch (syncError) {
          console.warn('⚠️  Failed to start background sync:', syncError.message);
          // Don't fail the connection if sync fails
        }
      } else {
        // Create new connection
        const { error: insertError } = await getSupabase()
          .from('calendar_connections')
          .insert({
            user_id: state,
            tenant_id: user.tenant_id,
            provider: 'google',
            provider_account_email: userInfo.email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            is_active: true,
            is_primary: true,
            sync_enabled: true,
            transcription_enabled: true  // Enabled by default for better UX - users can disable in settings
          });

        if (insertError) {
          console.error('❌ Error creating Google connection:', insertError);
          return res.send(`
            <html>
              <body>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'GOOGLE_OAUTH_ERROR',
                      error: 'Failed to save connection'
                    }, '*');
                  }
                  window.close();
                </script>
                <p>Error: Failed to save connection</p>
              </body>
            </html>
          `);
        }

        console.log(`✅ Created new Google Calendar connection for user ${state}`);

        // Trigger initial sync to fetch existing Google Calendar meetings (in background, non-blocking)
        try {
          console.log('🔄 Triggering initial Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');
          // Don't await - let it run in background
          calendarSyncService.syncUserCalendar(state, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
            console.log('✅ Initial Google Calendar sync completed:', syncResult);
          }).catch(syncError => {
            console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
          });
        } catch (syncError) {
          console.warn('⚠️  Failed to start background sync:', syncError.message);
          // Don't fail the connection if sync fails
        }
      }

      // Close popup and notify parent window
      return res.send(`
        <html>
          <head>
            <title>Google Calendar Connected</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_OAUTH_SUCCESS',
                  message: 'Google Calendar connected successfully'
                }, '*');
              }
              window.close();
            </script>
            <p>Google Calendar connected successfully! This window will close automatically.</p>
          </body>
        </html>
      `);
    }

    // ✅ INITIAL LOGIN (no state parameter)
    console.log(`✅ Google OAuth login for: ${userInfo.email}`);

    // Find or create user in DB using Supabase
    const { data: existingUser, error: findError } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', userInfo.email)
      .single();

    // Use UserService to get or create user with Supabase Auth UUID
    const UserService = require('../services/userService');

    // Create a Supabase user object from Google OAuth info
    const supabaseUser = {
      id: userInfo.id,  // This will be replaced with Supabase Auth UUID if available
      email: userInfo.email,
      user_metadata: {
        full_name: userInfo.name
      }
    };

    // Get or create user
    const user = await UserService.getOrCreateUser(supabaseUser);
    let tenantId = user.tenant_id;

    // Ensure user has a tenant (UserService should have created one, but double-check)
    if (!tenantId) {
      tenantId = await UserService.ensureUserHasTenant(user);
    }

    // Create or update calendar connection
    const { data: existingConnection } = await getSupabase()
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true,
          is_primary: true,
          sync_enabled: true,
          transcription_enabled: true,  // Enabled by default for better UX - users can disable in settings
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('❌ Error updating calendar connection:', updateError);
        throw new Error('Failed to update calendar connection');
      }
      console.log(`✅ Updated existing Google Calendar connection`);
    } else {
      // Create new connection
      const { error: insertError } = await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          provider: 'google',
          provider_account_email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true,
          is_primary: true,
          sync_enabled: true,
          transcription_enabled: true  // Enabled by default for better UX - users can disable in settings
        });

      if (insertError) {
        console.error('❌ Error creating calendar connection:', insertError);
        throw new Error('Failed to create calendar connection');
      }
      console.log(`✅ Created new Google Calendar connection`);
    }

    // Trigger initial sync to fetch existing Google Calendar meetings (in background, non-blocking)
    try {
      console.log('🔄 Triggering initial Google Calendar sync in background...');
      const calendarSyncService = require('../services/calendarSync');
      // Don't await - let it run in background
      calendarSyncService.syncUserCalendar(user.id, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
        console.log('✅ Initial Google Calendar sync completed:', syncResult);
      }).catch(syncError => {
        console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
      });
    } catch (syncError) {
      console.warn('⚠️  Failed to start background sync:', syncError.message);
      // Don't fail the connection if sync fails
    }

    // Issue JWT
    const jwtToken = jwt.sign({
      userId: user.id,
      email: user.email
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Redirect to frontend with token in URL
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    if (state) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_OAUTH_ERROR',
                  error: '${err.message}'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: ${err.message}</p>
          </body>
        </html>
      `);
    }
    res.redirect(`${process.env.FRONTEND_URL}/login?error=OAuthFailed`);
  }
});

// Create a new meeting with calendar event
router.post('/meetings', authenticateSupabaseUser, async (req, res) => {
  try {
    const { title, description, date, time, duration } = req.body;

    // Create meeting in database
    const meeting = await prisma.meeting.create({
      data: {
        userId: req.user.id,
        title,
        type: 'scheduled',
        date: new Date(date),
        time,
        status: 'scheduled'
      }
    });

    // Create calendar event
    const calendarEvent = await calendarService.createMeetingEvent(req.user.id, {
      id: meeting.id,
      title,
      description,
      date,
      time,
      duration
    });

    res.json({ meeting, calendarEvent });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Sync Google Calendar meetings to database (NEW - uses calendar_connections table)
router.post('/sync-google', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔄 Starting Google Calendar sync for user ${userId}`);

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get active Google Calendar connection
    const { data: connection, error: connError } = await req.supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return res.status(404).json({ error: 'No active Google Calendar connection found' });
    }

    if (!connection.access_token) {
      return res.status(400).json({ error: 'Google Calendar token not available' });
    }

    // Set up OAuth client with tokens from calendar_connections
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null
    });

    // Fetch events from Google Calendar
    const { google } = require('googleapis');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    console.log(`📅 Fetching Google Calendar events from ${sixMonthsAgo.toISOString()} onwards...`);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: sixMonthsAgo.toISOString(),
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false
    });

    const calendarEvents = response.data.items || [];
    console.log(`📊 Found ${calendarEvents.length} events in Google Calendar`);

    // Get existing meetings from database
    const { data: existingMeetings, error: dbError } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .eq('meeting_source', 'google')
      .gte('starttime', sixMonthsAgo.toISOString());

    if (dbError) {
      console.error('Error fetching existing meetings:', dbError);
      return res.status(500).json({ error: 'Failed to fetch existing meetings' });
    }

    console.log(`💾 Found ${existingMeetings?.length || 0} existing Google meetings in database`);

    // Process sync: add new meetings, update existing ones
    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const event of calendarEvents) {
      try {
        const existing = existingMeetings?.find(m => m.external_id === event.id);

        const meetingData = {
          user_id: userId,
          external_id: event.id,
          title: event.summary || 'Untitled Meeting',
          starttime: event.start?.dateTime || event.start?.date,
          endtime: event.end?.dateTime || event.end?.date,
          attendees: event.attendees ? JSON.stringify(event.attendees) : null,
          meeting_source: 'google',
          is_deleted: false
        };

        if (existing) {
          // Update existing meeting
          const { error: updateError } = await req.supabase
            .from('meetings')
            .update(meetingData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`❌ Failed to update meeting ${event.id}:`, updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Insert new meeting
          const { error: insertError } = await req.supabase
            .from('meetings')
            .insert([meetingData]);

          if (insertError) {
            console.error(`❌ Failed to insert meeting ${event.id}:`, insertError);
            errors++;
          } else {
            added++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing event ${event.id}:`, error);
        errors++;
      }
    }

    // Update last sync time
    await req.supabase
      .from('calendar_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success'
      })
      .eq('id', connection.id);

    console.log(`✅ Google Calendar sync completed: ${added} added, ${updated} updated, ${errors} errors`);

    res.json({
      success: true,
      message: 'Google Calendar synced successfully',
      results: {
        added,
        updated,
        errors,
        total: calendarEvents.length
      }
    });

  } catch (error) {
    console.error('Error syncing Google Calendar:', error);
    res.status(500).json({ error: 'Failed to sync Google Calendar', details: error.message });
  }
});

// Legacy sync endpoint (kept for backwards compatibility)
router.post('/sync', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔄 Starting calendar sync for user ${userId}`);

    const results = await calendarSyncService.syncUserCalendar(userId, {
      timeRange: 'extended', // 6 months
      includeDeleted: true
    });

    console.log(`✅ Calendar sync completed:`, results);
    res.json({
      message: 'Calendar synced successfully',
      results
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);
    res.status(500).json({ error: 'Failed to sync calendar' });
  }
});

// Get all meetings for a user (with client join, all fields for frontend)
router.get('/meetings', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: meetings, error } = await getSupabase()
      .from('meetings')
      .select(`
        id,
        title,
        starttime,
        endtime,
        description,
        location,
        external_id,
        attendees,
        transcript,
        quick_summary,
        detailed_summary,
        email_summary_draft,
        email_template_id,
        last_summarized_at,
        action_points,
        meeting_source,
        client_id,
        recall_bot_id,
        recall_status,
        recall_recording_id,
        skip_transcription_for_meeting,
        meeting_url,
        clients(id, name, email)
      `)
      .eq('user_id', userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false });

    if (error) {
      console.error('Error fetching meetings:', error);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    const processedMeetings = (meetings || []).map(meeting => ({
      ...meeting,
      source: meeting.meeting_source || 'google',
      hasTranscript: !!meeting.transcript,
      hasSummary: !!meeting.quick_summary || !!meeting.detailed_summary,
      hasEmailDraft: !!meeting.email_summary_draft,
    }));

    res.json(processedMeetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// List upcoming meetings
router.get('/meetings/all', authenticateSupabaseUser, async (req, res) => {
  try {
    const meetings = await calendarService.listMeetingsWithRecentPast(req.user.id);
    res.json(meetings);
  } catch (error) {
    console.error('Error listing all meetings:', error);
    res.status(500).json({ error: 'Failed to list all meetings' });
  }
});

// Batch-generate summaries for all meetings with transcripts but no detailed_summary
router.post('/meetings/batch-generate-summaries', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({ error: 'OpenAI service not available' });
    }

    // Find all meetings with transcripts but no detailed_summary
    const { data: meetings, error: fetchError } = await req.supabase
      .from('meetings')
      .select('id, title, transcript, quick_summary, detailed_summary, client_id, clients(id, name, email)')
      .eq('user_id', userId)
      .not('transcript', 'is', null)
      .is('detailed_summary', null)
      .order('starttime', { ascending: false });

    if (fetchError) {
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    if (!meetings || meetings.length === 0) {
      return res.json({ message: 'No meetings need summary generation', processed: 0 });
    }

    // Respond immediately with count, process in background
    res.json({
      message: `Processing ${meetings.length} meetings in background`,
      meetingCount: meetings.length,
      meetingTitles: meetings.map(m => m.title)
    });

    // Process each meeting in background
    const { generateMeetingOutputs } = require('../services/meetingSummaryService');

    setImmediate(async () => {
      let processed = 0;
      let failed = 0;

      for (const meeting of meetings) {
        try {
          console.log(`🤖 [BatchGenerate] Processing ${processed + 1}/${meetings.length}: ${meeting.title}`);

          await generateMeetingOutputs({
            supabase: req.supabase,
            userId,
            meetingId: meeting.id,
            transcript: meeting.transcript,
            meeting
          });

          processed++;
          console.log(`✅ [BatchGenerate] Done: ${meeting.title}`);

          // Small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          failed++;
          console.error(`❌ [BatchGenerate] Failed: ${meeting.title}:`, error.message);
        }
      }

      console.log(`🎉 [BatchGenerate] Complete: ${processed} processed, ${failed} failed out of ${meetings.length}`);
    });

  } catch (error) {
    console.error('Error in batch generate summaries:', error);
    res.status(500).json({ error: 'Failed to start batch generation' });
  }
});

// Start meeting recording
router.post('/meetings/:id/record/start', authenticateSupabaseUser, async (req, res) => {
  try {
    const { id } = req.params;
    const recording = await meetingService.startRecording(id);
    res.json(recording);
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop meeting recording
router.post('/meetings/:id/record/stop', authenticateSupabaseUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { recordingUrl } = req.body;
    await meetingService.stopRecording(id, recordingUrl);

    // Generate transcript and summary
    const transcript = await meetingService.generateTranscript(id);
    const summary = await meetingService.generateSummary(id);
    const actionItems = await meetingService.extractActionItems(id);

    res.json({ transcript, summary, actionItems });
  } catch (error) {
    console.error('Error processing meeting recording:', error);
    res.status(500).json({ error: 'Failed to process recording' });
  }
});



// Get meeting details including transcript and recording if available
router.get('/meetings/:eventId', authenticateSupabaseUser, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const meetingDetails = await calendarService.getMeetingDetails(userId, eventId);

        // If the meeting has a transcript and we need to generate a summary
        if (meetingDetails.hasRecording && meetingDetails.transcript && !meetingDetails.summary) {
            // Get the meeting template preference if any
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { preferences: true }
            });

            const template = user?.preferences?.defaultTemplate || 'standard';

            // Generate summary using OpenAI
            const summary = await openai.generateMeetingSummary(
                meetingDetails.transcript,
                template,
                meetingDetails.metadata
            );

            // Update the meeting record with the summary
            await prisma.meeting.update({
                where: {
                    googleEventId: eventId
                },
                data: {
                    summary
                }
            });

            meetingDetails.summary = summary;
        }

        res.json(meetingDetails);
    } catch (error) {
        console.error('Error fetching meeting details:', error);
        res.status(500).json({ error: 'Failed to fetch meeting details' });
    }
});

// Add manual notes to a meeting
router.post('/meetings/:eventId/notes', authenticateSupabaseUser, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;

        // Update meeting with manual notes
        const meeting = await prisma.meeting.update({
            where: {
                googleEventId: eventId,
                userId
            },
            data: {
                notes,
                // Generate summary if notes are provided
                summary: notes ? await openai.generateMeetingSummary(notes, 'standard') : undefined
            }
        });

        res.json(meeting);
    } catch (error) {
        console.error('Error adding meeting notes:', error);
        res.status(500).json({ error: 'Failed to add meeting notes' });
    }
});

// Upload meeting image/document
router.post('/meetings/:eventId/attachments', authenticateSupabaseUser, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { imageText } = req.body; // Assuming we're receiving OCR'd text from the frontend
        const userId = req.user.id;

        if (!imageText) {
            return res.status(400).json({ error: 'No text content provided' });
        }

        // Update meeting with the extracted text as notes
        const meeting = await prisma.meeting.update({
            where: {
                googleEventId: eventId,
                userId
            },
            data: {
                notes: imageText,
                // Generate summary from the image text
                summary: await openai.generateMeetingSummary(imageText, 'standard')
            }
        });

        res.json(meeting);
    } catch (error) {
        console.error('Error processing meeting attachment:', error);
        res.status(500).json({ error: 'Failed to process meeting attachment' });
  }
});

// Generate email summary for a meeting (AI or template)
router.post('/meetings/:id/generate-summary', authenticateSupabaseUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript, prompt } = req.body;
    if (!transcript || !prompt) {
      return res.status(400).json({ error: 'Transcript and prompt are required.' });
    }
    // Call OpenAI to generate summary
    const summary = await openai.generateMeetingSummary(transcript, undefined, { prompt });
    res.json({ summary });
  } catch (error) {
    console.error('Error generating email summary:', error);
    res.status(500).json({ error: 'Failed to generate email summary.' });
  }
});

// Improved AI summary email route for Advicly
router.post('/generate-summary', async (req, res) => {
  const { transcript, prompt } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    const summary = await openai.generateMeetingSummary(transcript, 'standard', { prompt });
    return res.json({ summary });
  } catch (err) {
    console.error('Error generating summary:', err);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Streaming AI summary endpoint - data-driven, transcript-led generation
router.post('/generate-summary-stream', authenticateSupabaseUser, async (req, res) => {
  const { transcript, meetingId, templateType } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });

  try {
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    const userId = req.user.id;
    const emailPromptEngine = require('../services/emailPromptEngine');

    // Prepare the email generation context, messages, greeting, and sign-off
    const { messages, greeting, signOff, context, sectionConfig } = await emailPromptEngine.prepareEmailGeneration({
      supabase: req.supabase,
      userId,
      meetingId,
      transcript,
      templateType: templateType || 'auto-summary'
    });

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Only send deterministic greeting/sign-off if mode doesn't include them in AI output
    const includeGreetingSignOff = sectionConfig.includeGreetingSignOff || false;

    if (!includeGreetingSignOff) {
      // Send deterministic greeting first
      res.write(`data: ${JSON.stringify({ content: greeting + '\n\n' })}\n\n`);
    }

    // Stream AI-generated content
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.6,
      max_tokens: 3000,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    if (!includeGreetingSignOff) {
      // Send deterministic sign-off after AI content
      res.write(`data: ${JSON.stringify({ content: '\n\n' + signOff })}\n\n`);
    }

    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Error streaming summary:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate summary' })}\n\n`);
    res.end();
  }
});

// Auto-generate summaries for a meeting (uses new prompt engine)
router.post('/meetings/:id/auto-generate-summaries', authenticateSupabaseUser, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { forceRegenerate = false } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Get meeting from database with client information
    // Try by external_id first, then by numeric id (frontend may pass either)
    let meeting;

    const { data: meetingByExternal } = await req.supabase
      .from('meetings')
      .select(`*, clients(id, name, email)`)
      .eq('external_id', meetingId)
      .eq('user_id', userId)
      .single();

    if (meetingByExternal) {
      meeting = meetingByExternal;
    } else {
      // Fallback: try by numeric id
      const { data: meetingById } = await req.supabase
        .from('meetings')
        .select(`*, clients(id, name, email)`)
        .eq('id', meetingId)
        .eq('user_id', userId)
        .single();

      meeting = meetingById;
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Check if quick summary already exists and we're not forcing regeneration
    // Only short-circuit if quick_summary exists (the primary independent output)
    if (!forceRegenerate && meeting.quick_summary) {
      return res.json({
        quickSummary: meeting.quick_summary,
        emailSummary: meeting.email_summary_draft || '',
        actionPoints: meeting.action_points || '',
        templateId: meeting.email_template_id,
        lastSummarizedAt: meeting.last_summarized_at,
        alreadyGenerated: true
      });
    }

    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    // STEP 1: Generate core outputs (quick summary, action items, client summary, pipeline)
    // This ALWAYS runs independently of email generation
    const { generateMeetingOutputs } = require('../services/meetingSummaryService');
    console.log(`🤖 [AutoGenerate] Calling generateMeetingOutputs for meeting ${meeting.id} (transcript: ${meeting.transcript?.length || 0} chars)...`);

    const summaryResults = await generateMeetingOutputs({
      supabase: req.supabase,
      userId,
      meetingId: meeting.id,
      transcript: meeting.transcript,
      meeting
    });

    console.log(`🤖 [AutoGenerate] generateMeetingOutputs returned: quickSummary=${summaryResults.quickSummary ? 'YES' : 'NO'}, actionItems=${summaryResults.actionPointsArray?.length || 0}, errors=${summaryResults.errors?.length || 0}`);

    if (summaryResults.errors.length > 0) {
      console.warn('⚠️ Some summary outputs had errors:', JSON.stringify(summaryResults.errors));
    }

    const { quickSummary, actionPointsArray } = summaryResults;

    const actionPoints = actionPointsArray.length > 0
      ? actionPointsArray.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : '';

    // RESPOND IMMEDIATELY with quick summary + action items
    // Don't block the response waiting for email generation
    res.json({
      quickSummary: quickSummary || null,
      emailSummary: null, // Will be generated async
      actionPoints: actionPoints || null,
      actionItemsCount: actionPointsArray.length,
      templateId: 'auto-template',
      lastSummarizedAt: new Date().toISOString(),
      generated: true,
      clientSummaryUpdated: summaryResults.clientSummaryUpdated,
      pipelineUpdated: summaryResults.pipelineUpdated,
      generationErrors: summaryResults.errors.length > 0 ? summaryResults.errors : undefined
    });

    // STEP 2: Generate email draft ASYNC (after response sent)
    // This runs in background - failure does not affect the user response
    if (process.env.OPENAI_API_KEY) {
      setImmediate(async () => {
        try {
          const emailPromptEngine = require('../services/emailPromptEngine');

          const prepared = await emailPromptEngine.prepareEmailGeneration({
            supabase: req.supabase,
            userId,
            meetingId: meeting.id,
            transcript: meeting.transcript,
            templateType: 'auto-summary'
          });

          const OpenAI = require('openai');
          const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const emailResponse = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: prepared.messages,
            temperature: 0.6,
            max_tokens: 3000
          });

          const emailBody = emailResponse.choices[0]?.message?.content || '';
          let emailSummary;
          if (prepared.sectionConfig.includeGreetingSignOff) {
            emailSummary = emailBody.trim();
          } else {
            emailSummary = `${prepared.greeting}\n\n${emailBody.trim()}\n\n${prepared.signOff}`;
          }

          // Save email draft
          await req.supabase
            .from('meetings')
            .update({
              email_summary_draft: emailSummary,
              email_template_id: 'auto-template',
              updated_at: new Date().toISOString()
            })
            .eq('id', meeting.id)
            .eq('user_id', userId);

          console.log(`✅ [Async] Email draft saved for meeting ${meeting.id}`);
        } catch (emailError) {
          console.error('⚠️ [Async] Email generation failed (non-critical):', emailError.message);
        }
      });
    }

  } catch (error) {
    console.error('Error auto-generating summaries:', error);
    res.status(500).json({ error: 'Failed to generate summaries' });
  }
});

// Delete a meeting and its associated data
router.delete('/meetings/:eventId', authenticateSupabaseUser, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Find the meeting first to check if it exists and belongs to the user
    const meeting = await prisma.meeting.findFirst({
      where: {
        googleEventId: eventId,
        userId
      }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete related records first (due to foreign key constraints)
    await prisma.actionItem.deleteMany({
      where: { meetingId: meeting.id }
    });

    await prisma.recording.deleteMany({
      where: { meetingId: meeting.id }
    });

    // Delete the meeting
    await prisma.meeting.delete({
      where: { id: meeting.id }
    });

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Delete all meetings for a user (cleanup endpoint)
router.delete('/meetings', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { olderThan } = req.query; // Optional: delete meetings older than X days

    let whereClause = { userId };

    if (olderThan) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
      whereClause.startTime = { lt: cutoffDate };
    }

    // Get all meetings to delete
    const meetingsToDelete = await prisma.meeting.findMany({
      where: whereClause,
      select: { id: true }
    });

    const meetingIds = meetingsToDelete.map(m => m.id);

    // Delete related records first
    await prisma.actionItem.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    await prisma.recording.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    // Delete the meetings
    const deletedCount = await prisma.meeting.deleteMany({
      where: whereClause
    });

    res.json({
      message: `Deleted ${deletedCount.count} meetings successfully`,
      deletedCount: deletedCount.count
    });
  } catch (error) {
    console.error('Error deleting meetings:', error);
    res.status(500).json({ error: 'Failed to delete meetings' });
  }
});

// Update meeting summary with new template
router.post('/meetings/:id/update-summary', authenticateSupabaseUser, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { emailSummary, templateId } = req.body;

    // Verify meeting belongs to user
    const { data: meeting, error: fetchError } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update the meeting with new summary and template ID
    const { error: updateError } = await req.supabase
      .from('meetings')
      .update({
        email_summary_draft: emailSummary,
        email_template_id: templateId,
        last_summarized_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating meeting summary:', updateError);
      return res.status(500).json({ error: 'Failed to update summary' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating meeting summary:', error);
    res.status(500).json({ error: 'Failed to update summary' });
  }
});

// ============================================================================
// MANUAL MEETING CREATION ENDPOINTS
// ============================================================================

// Create a manual meeting
router.post('/meetings/manual', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      startTime,
      endTime,
      locationType,
      locationDetails,
      attendees,
      transcript
    } = req.body;

    // Validation
    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    // Generate a unique event ID for manual meetings
    const manualEventId = `manual_${userId}_${Date.now()}`;

    // Prepare meeting data
    const meetingData = {
      userid: userId,
      googleeventid: manualEventId,
      title: title.trim(),
      starttime: new Date(startTime).toISOString(),
      endtime: endTime ? new Date(endTime).toISOString() : null,
      summary: description || null,
      transcript: transcript || null,
      location_type: locationType || 'other',
      location_details: locationDetails || null,
      manual_attendees: attendees || null,
      attendees: attendees ? JSON.stringify([{ displayName: attendees }]) : null,
      meeting_source: 'manual',
      is_manual: true,
      created_by: userId,
      recording_status: 'none',
      created_at: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

    // Insert meeting into database
    const { data: meeting, error: insertError } = await req.supabase
      .from('meetings')
      .insert(meetingData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating manual meeting:', insertError);
      return res.status(500).json({ error: 'Failed to create meeting' });
    }

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting: {
        ...meeting,
        id: meeting.googleeventid, // For frontend compatibility
        startTime: meeting.starttime,
        googleEventId: meeting.googleeventid
      }
    });

  } catch (error) {
    console.error('Error in manual meeting creation:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Update a manual meeting
router.put('/meetings/manual/:meetingId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const {
      title,
      description,
      startTime,
      endTime,
      locationType,
      locationDetails,
      attendees,
      transcript
    } = req.body;

    // Verify meeting exists and is manual
    const { data: existingMeeting, error: fetchError } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .eq('is_manual', true)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Manual meeting not found' });
    }

    // Prepare update data
    const updateData = {
      title: title?.trim() || existingMeeting.title,
      summary: description !== undefined ? description : existingMeeting.summary,
      starttime: startTime ? new Date(startTime).toISOString() : existingMeeting.starttime,
      endtime: endTime ? new Date(endTime).toISOString() : existingMeeting.endtime,
      location_type: locationType || existingMeeting.location_type,
      location_details: locationDetails !== undefined ? locationDetails : existingMeeting.location_details,
      manual_attendees: attendees !== undefined ? attendees : existingMeeting.manual_attendees,
      attendees: attendees ? JSON.stringify([{ displayName: attendees }]) : existingMeeting.attendees,
      transcript: transcript !== undefined ? transcript : existingMeeting.transcript,
      updatedat: new Date().toISOString()
    };

    // Update meeting
    const { data: updatedMeeting, error: updateError } = await req.supabase
      .from('meetings')
      .update(updateData)
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating manual meeting:', updateError);
      return res.status(500).json({ error: 'Failed to update meeting' });
    }

    res.json({
      message: 'Meeting updated successfully',
      meeting: {
        ...updatedMeeting,
        id: updatedMeeting.googleeventid,
        startTime: updatedMeeting.starttime,
        googleEventId: updatedMeeting.googleeventid
      }
    });

  } catch (error) {
    console.error('Error updating manual meeting:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// Delete a manual meeting
router.delete('/meetings/manual/:meetingId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;

    // Verify meeting exists and is manual
    const { data: existingMeeting, error: fetchError } = await req.supabase
      .from('meetings')
      .select('id')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .eq('is_manual', true)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Manual meeting not found' });
    }

    // Delete meeting (this will cascade delete documents due to foreign key)
    const { error: deleteError } = await req.supabase
      .from('meetings')
      .delete()
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (deleteError) {
      console.error('Error deleting manual meeting:', deleteError);
      return res.status(500).json({ error: 'Failed to delete meeting' });
    }

    res.json({ message: 'Meeting deleted successfully' });

  } catch (error) {
    console.error('Error deleting manual meeting:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Update meeting transcript (for both manual and Google meetings)
// IMPORTANT: This endpoint is for MANUAL transcript uploads only
// The PRIMARY path is Recall.ai webhook which auto-generates summaries
router.post('/meetings/:meetingId/transcript', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { transcript } = req.body;

    if (transcript === undefined) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    console.log(`📝 Manual transcript upload for meeting ${meetingId} by user ${userId}`);

    // Try to find meeting by numeric ID first (primary), then by external_id
    let existingMeeting = null;
    let fetchError = null;

    // First try: numeric ID (works for all meeting types)
    const { data: meetingById, error: errorById } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('id', parseInt(meetingId))
      .eq('user_id', userId)
      .single();

    if (!errorById && meetingById) {
      existingMeeting = meetingById;
      console.log(`✅ Found meeting by numeric ID: ${meetingId}`);
    } else {
      // Second try: external_id (for Google Calendar meetings)
      const { data: meetingByExtId, error: errorByExtId } = await req.supabase
        .from('meetings')
        .select('*')
        .eq('external_id', meetingId)
        .eq('user_id', userId)
        .single();

      if (!errorByExtId && meetingByExtId) {
        existingMeeting = meetingByExtId;
        console.log(`✅ Found meeting by external_id: ${meetingId}`);
      } else {
        fetchError = errorByExtId || errorById;
      }
    }

    if (fetchError || !existingMeeting) {
      console.error(`❌ Meeting not found for ID ${meetingId}:`, fetchError);
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update transcript
    const { data: updatedMeeting, error: updateError } = await req.supabase
      .from('meetings')
      .update({
        transcript: transcript,
        transcript_source: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMeeting.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating meeting transcript:', updateError);
      return res.status(500).json({ error: 'Failed to update transcript' });
    }

    console.log(`✅ Transcript updated for meeting ${existingMeeting.id}`);

    // ========================================
    // AUTO-GENERATE SUMMARIES AND ACTION ITEMS
    // This makes manual upload work identically to Recall.ai webhook
    // ========================================

    if (transcript && transcript.trim()) {
      console.log(`🤖 Auto-generating outputs for manually uploaded transcript (meeting ${existingMeeting.id}, transcript length: ${transcript.length} chars)`);

      try {
        // STEP 1: Generate core outputs (quick summary, action items, client summary, pipeline)
        // This ALWAYS runs independently of email generation
        const { generateMeetingOutputs } = require('../services/meetingSummaryService');
        console.log(`🤖 [TranscriptUpload] Calling generateMeetingOutputs for meeting ${existingMeeting.id}...`);

        const summaryResults = await generateMeetingOutputs({
          supabase: req.supabase,
          userId,
          meetingId: existingMeeting.id,
          transcript
          // NOTE: Do NOT pass meeting here - let the service re-fetch with clients join
          // This matches the Recall webhook path and ensures client name is available
        });

        console.log(`🤖 [TranscriptUpload] generateMeetingOutputs returned: quickSummary=${summaryResults.quickSummary ? 'YES' : 'NO'}, detailedSummary=${summaryResults.detailedSummary ? 'YES' : 'NO'}, actionItems=${summaryResults.actionPointsArray?.length || 0}, errors=${summaryResults.errors?.length || 0}`);

        if (summaryResults.errors.length > 0) {
          console.warn('⚠️ Some summary outputs had errors:', JSON.stringify(summaryResults.errors));
        }

        const { quickSummary, actionPointsArray } = summaryResults;

        const actionPoints = actionPointsArray.length > 0
          ? actionPointsArray.map((item, i) => `${i + 1}. ${item}`).join('\n')
          : '';

        // RESPOND IMMEDIATELY with quick summary + action items
        // Don't block the response waiting for email generation
        res.json({
          message: 'Transcript uploaded and summaries generated successfully',
          meeting: {
            ...updatedMeeting,
            id: updatedMeeting.id,
            startTime: updatedMeeting.starttime,
            googleEventId: updatedMeeting.external_id
          },
          summaries: {
            quickSummary: quickSummary || null,
            detailedSummary: summaryResults.detailedSummary || null,
            emailSummary: null, // Will be generated async
            actionPoints: actionPoints || null
          },
          actionItemsCount: actionPointsArray.length,
          autoGenerated: true,
          clientSummaryUpdated: summaryResults.clientSummaryUpdated,
          pipelineUpdated: summaryResults.pipelineUpdated,
          generationErrors: summaryResults.errors.length > 0 ? summaryResults.errors : undefined
        });

        // STEP 2: Generate email draft ASYNC (after response sent)
        // This runs in background - failure does not affect the user response
        if (process.env.OPENAI_API_KEY) {
          setImmediate(async () => {
            try {
              const emailPromptEngine = require('../services/emailPromptEngine');
              const OpenAILib = require('openai');
              const openaiClient = new OpenAILib({ apiKey: process.env.OPENAI_API_KEY });

              const prepared = await emailPromptEngine.prepareEmailGeneration({
                supabase: req.supabase,
                userId,
                meetingId: existingMeeting.id,
                transcript,
                templateType: 'auto-summary'
              });

              const emailResponse = await openaiClient.chat.completions.create({
                model: "gpt-4o",
                messages: prepared.messages,
                temperature: 0.6,
                max_tokens: 3000
              });

              const emailBody = emailResponse.choices[0]?.message?.content || '';
              let emailSummary;
              if (prepared.sectionConfig.includeGreetingSignOff) {
                emailSummary = emailBody.trim();
              } else {
                emailSummary = `${prepared.greeting}\n\n${emailBody.trim()}\n\n${prepared.signOff}`;
              }

              // Save email draft
              await req.supabase
                .from('meetings')
                .update({
                  email_summary_draft: emailSummary,
                  email_template_id: 'auto-template',
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingMeeting.id);

              console.log(`✅ [Async] Email draft saved for meeting ${existingMeeting.id}`);
            } catch (emailError) {
              console.error('⚠️ [Async] Email generation failed (non-critical):', emailError.message);
            }
          });
        }

        return; // Response already sent above

      } catch (aiError) {
        console.error('❌ Error generating outputs for manual transcript:', aiError.message, aiError.stack);
        // Return success for transcript upload with error info for debugging
        return res.json({
          message: 'Transcript uploaded but summary generation failed',
          meeting: {
            ...updatedMeeting,
            id: updatedMeeting.id,
            startTime: updatedMeeting.starttime,
            googleEventId: updatedMeeting.external_id
          },
          summaries: null,
          generationError: aiError.message
        });
      }
    }

    // Fallback response (if AI generation fails or no transcript)
    res.json({
      message: 'Transcript updated successfully',
      meeting: {
        ...updatedMeeting,
        id: updatedMeeting.id,
        startTime: updatedMeeting.starttime,
        googleEventId: updatedMeeting.external_id
      }
    });

  } catch (error) {
    console.error('❌ Error updating meeting transcript:', error);
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

// Delete meeting transcript
// Removes transcript and all associated summaries/action items
router.delete('/meetings/:meetingId/transcript', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;

    console.log(`🗑️  Deleting transcript for meeting ${meetingId} by user ${userId}`);

    // Try to find meeting by numeric ID first (primary), then by external_id
    let existingMeeting = null;
    let fetchError = null;

    // First try: numeric ID (works for all meeting types)
    const { data: meetingById, error: errorById } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('id', parseInt(meetingId))
      .eq('user_id', userId)
      .single();

    if (!errorById && meetingById) {
      existingMeeting = meetingById;
      console.log(`✅ Found meeting by numeric ID: ${meetingId}`);
    } else {
      // Second try: external_id (for Google Calendar meetings)
      const { data: meetingByExtId, error: errorByExtId } = await req.supabase
        .from('meetings')
        .select('*')
        .eq('external_id', meetingId)
        .eq('user_id', userId)
        .single();

      if (!errorByExtId && meetingByExtId) {
        existingMeeting = meetingByExtId;
        console.log(`✅ Found meeting by external_id: ${meetingId}`);
      } else {
        fetchError = errorByExtId || errorById;
      }
    }

    if (fetchError || !existingMeeting) {
      console.error(`❌ Meeting not found for ID ${meetingId}:`, fetchError);
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete transcript and all related summaries
    const { error: updateError } = await req.supabase
      .from('meetings')
      .update({
        transcript: null,
        quick_summary: null,
        detailed_summary: null,
        email_summary_draft: null,
        action_points: null,
        transcript_source: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMeeting.id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error deleting transcript:', updateError);
      return res.status(500).json({ error: 'Failed to delete transcript' });
    }

    console.log(`✅ Transcript deleted for meeting ${existingMeeting.id}`);

    res.json({
      message: 'Transcript deleted successfully',
      meeting: {
        id: existingMeeting.id,
        transcript: null,
        quick_summary: null,
        detailed_summary: null,
        email_summary_draft: null,
        action_points: null
      }
    });

  } catch (error) {
    console.error('❌ Error deleting transcript:', error);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});

// ============================================================================
// ANNUAL REVIEW ENDPOINTS
// ============================================================================

// Detect key review fields from a transcript (for smarter Review wizard)
router.post('/meetings/:id/detect-review-fields', authenticateSupabaseUser, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required.' });
    }

    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({ error: 'OpenAI service is not available.' });
    }

    const systemPrompt = 'You are a helpful assistant that analyzes UK retail financial advice review meeting transcripts and extracts key client review data. Always respond with valid JSON only.';

    const userPrompt = `You will be given a full financial review meeting transcript.
Your task is to extract key fields that are useful for a client review letter wizard.

Return a JSON object with a single property "fields" which is an array.
Each item in fields must have the shape:
{
  "key": string,           // machine key, e.g. "client_name", "retirement_age"
  "label": string,         // human label, e.g. "Client name"
  "detected_value": any,   // value inferred from transcript if clear, otherwise null
  "confidence": string,    // "high", "medium" or "low"
  "should_ask_user": boolean, // true if the wizard should explicitly ask the adviser to confirm/fill this
  "question_text": string  // concise question to show the adviser
}

Focus on fields such as:
- client_name
- meeting_date
- retirement_age
- health_status
- personal_circumstances
- income_expenditure
- assets_liabilities
- emergency_fund
- tax_status
- capacity_for_loss
- attitude_to_risk
- investment_knowledge_level
- current_investments (can be a short text summary)
- protection_notes
- estate_planning_notes
- cashflow_modelling_notes
- follow_up_actions (a short bullet-style text)
- next_review_timing

Only set should_ask_user to true when the information is missing, unclear, or low confidence.

Transcript:
${transcript}`;

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const aiResponse = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch (err) {
      console.error('Error parsing detect-review-fields response:', err, aiResponse);
      return res.status(500).json({ error: 'Failed to parse AI response.' });
    }

    if (!parsed || !Array.isArray(parsed.fields)) {
      return res.status(500).json({ error: 'Invalid AI response format.' });
    }

    return res.json({ fields: parsed.fields });
  } catch (error) {
    console.error('Error detecting review fields:', error);
    res.status(500).json({ error: 'Failed to detect review fields.' });
  }
});

// Generate final Review email using transcript + confirmed reviewData
router.post('/meetings/:id/generate-review-email', authenticateSupabaseUser, async (req, res) => {
  try {
    const { transcript, reviewData } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required.' });
    }

    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({ error: 'OpenAI service is not available.' });
    }

    const safeReviewData = reviewData || {};

    // Reuse the template content from the frontend definition
    const reviewTemplatePrompt = `You are Advicly's Review Meeting Assistant.

You are given two inputs:
1) A full meeting transcript as plain text.
2) A JSON object called reviewData that contains CONFIRMED details about the client and this review meeting.

reviewData is the primary source of truth. If a field exists in reviewData and is non-empty, you MUST treat it as accurate and up to date, even if the transcript is ambiguous or incomplete.
Only when a field is missing or null in reviewData may you infer or phrase things more generically from the transcript.

The two inputs will be injected like this:
- TRANSCRIPT:
${transcript}

- REVIEW DATA (JSON):
${JSON.stringify(safeReviewData, null, 2)}

---

YOUR TASK

Using BOTH the transcript and reviewData, write a single, finished client email that:
- Is clear, professional, and UK retail financial advice compliant.
- Contains NO placeholders like [X]%, [Insert Amount], [TO CONFIRM], or similar.
- Contains NO questions to the client asking for missing data.
- Does NOT include any markdown formatting (no **bold**, no headings, no tables).
- Is ready to send exactly as written.

If important information is missing from BOTH the transcript and reviewData (for example, an exact retirement age or plan number), then:
- Do NOT invent numbers or facts.
- Instead, use neutral wording such as "This will be confirmed separately" or "We will discuss this in more detail at our next review", so the email still reads complete and professional.

---

EMAIL STRUCTURE (PLAIN TEXT ONLY)

Follow this structure in free-flowing paragraphs and simple lists where helpful. Do NOT include headings or markdown symbols in the final output.

1) Greeting and Introduction
- Address the client by name if available in reviewData.client_name; otherwise use a neutral greeting like "Dear Client".
- Thank them for their time and explain that this is a summary of their recent review meeting.

2) Your Circumstances
Based primarily on reviewData and supported by the transcript, briefly describe:
- Health status
- Personal circumstances (employment, family, home situation)
- Income and expenditure (including any expected changes or short-term income needs)
- Assets and liabilities (only at a high level, no unnecessary detail)
- Emergency fund position
- Tax status (high-level, e.g. basic rate taxpayer, higher rate, etc., if known)
- Capacity for loss
- Attitude to risk

Keep the tone factual and reassuring. If some of these points are not clearly covered in either the transcript or reviewData, omit them or describe them in neutral terms without inventing specifics.

3) Your Goals and Objectives
Summarise the client’s main goals, using reviewData where available:
- Retirement timing and lifestyle goals (e.g. desired retirement age, income targets in retirement)
- Capital growth or income objectives
- Any other specific goals mentioned (e.g. paying off mortgage, helping children, estate planning, etc.)

If cashflow modelling has been discussed and captured in reviewData (for example, required rate of return or additional contributions), explain this in clear, client-friendly language without including raw placeholder-style figures. Where exact figures are available in reviewData, you may include them. Where they are not, explain the conclusion in words (for example, that the current plan appears on track, or that additional saving may be required).

4) Your Current Investments
Provide a concise narrative summary of the client’s existing plans based on reviewData.current_investments and/or the transcript, such as:
- Types of plans held (e.g. pensions, ISAs, general investment accounts)
- Overall value range (if known) and any regular contributions
- How the current investments align with the agreed risk profile and objectives
- Any notable changes since the last review (e.g. fund switches, top-ups, transfers)

Do NOT use a markdown table. Instead, describe holdings in sentences or a simple bullet-style list if that reads more clearly.

5) Investment Knowledge & Experience, Capacity for Loss, and Risk Profile
Using reviewData.investment_knowledge_level, reviewData.capacity_for_loss and reviewData.attitude_to_risk (plus the transcript where helpful), clearly state:
- The client’s level of investment knowledge and experience, with a short justification.
- Their capacity for loss (low / moderate / high) with reasons.
- Their agreed attitude to risk (e.g. cautious, balanced, adventurous) and how the current portfolio aligns with this.

If any of these fields are missing in reviewData and not clearly stated in the transcript, describe them in neutral language (for example, "your current portfolio is invested in a way that aims to balance growth with an appropriate level of risk for your circumstances").

6) Protection, Wills and Power of Attorney, and Estate Planning
If reviewData.protection_notes, reviewData.estate_planning_notes or related information is available, summarise:
- The client’s current protection position (e.g. life cover, critical illness, income protection) and whether it appears adequate.
- Any discussion around wills, powers of attorney, and inheritance tax planning.

If these topics were not discussed or are unclear, either omit them or write one short paragraph noting that this will be reviewed in future meetings, without inventing specific recommendations.

7) Agreed Actions and Next Steps
Based on reviewData.follow_up_actions (if provided) and the transcript, list the concrete next steps that were agreed. Present them as a short, numbered or bulleted list in plain text. For each action, mention:
- What will be done
- Who is responsible (you, the client, or a third party)
- Any relevant timescales if they are clearly known

If there are no clear follow-up actions, include a single line noting that no immediate changes are required but that the plan will continue to be reviewed regularly.

8) Cashflow Modelling and Ongoing Reviews
If cashflow modelling was discussed (and this is reflected in reviewData or the transcript), briefly explain:
- The purpose of the modelling (e.g. to assess whether retirement goals remain achievable)
- The high-level conclusion (on track / may need further contributions / further review required)

Then confirm that you will continue to review their position regularly, and, if reviewData.next_review_timing is available, refer to the expected timing of the next review.

9) Closing
End with a professional closing paragraph that:
- Invites the client to ask questions or request clarification at any time.
- Reassures them that you will keep their plan under regular review.
- Signs off with your name and role if this is evident in the transcript; otherwise use a generic professional sign-off such as "Best regards" followed by your name.

---

OUTPUT FORMAT

Your entire response must be a SINGLE, continuous plain text email body, with normal paragraph breaks and simple numbered or bulleted lists where appropriate.

Do NOT include:
- Any headings or markdown syntax (no #, no **, no tables).
- Any meta-commentary about what you are doing.
- Any placeholders or instructions to the adviser.

The email you output must be ready to send to the client exactly as written.`;

    // Determine if user has paid subscription for potential premium polish
    let isPaid = false;
    try {
      const { data: subscription } = await getSupabase()
        .from('subscriptions')
        .select('*')
        .eq('user_id', req.user.id)
        .single();

      isPaid = !!(subscription &&
        (subscription.status === 'active' || subscription.status === 'trialing') &&
        subscription.plan !== 'free');
    } catch (subError) {
      console.warn('⚠️  Could not determine subscription status for premium polish:', subError.message);
    }

    // Base review email generation using gpt-4o-mini
    let summary = await openai.generateMeetingSummary(transcript, undefined, { prompt: reviewTemplatePrompt });

    // Apply GPT-4 polish to the review email for all users
    if (summary) {
      try {
        const polishPrompt = 'Please refine this client review email to improve clarity, tone, and professionalism without changing the factual content or adding any placeholders. Keep it in plain text with no markdown.';
        summary = await openai.adjustMeetingSummary(summary, polishPrompt);
      } catch (polishError) {
        console.warn('⚠️  Review email polish failed, falling back to base summary:', polishError.message);
      }
    }

    return res.json({ summary });
  } catch (error) {
    console.error('Error generating review email:', error);
    res.status(500).json({ error: 'Failed to generate review email.' });
  }
});



// ============================================================================
// FILE UPLOAD ENDPOINTS
// ============================================================================

// Upload files to a meeting
// UPDATED: Now uses unified client_documents system
router.post('/meetings/:meetingId/documents', authenticateSupabaseUser, clientDocumentsService.upload.array('files', 10), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const files = req.files;

    console.log(`📤 Meeting document upload: meeting=${meetingId}, user=${userId}, files=${files?.length || 0}`);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify meeting exists and user has access
    const { data: meeting, error: meetingError } = await req.supabase
      .from('meetings')
      .select('id, title, client_id')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.client_id) {
      return res.status(400).json({
        error: 'Meeting is not linked to a client yet. Please assign a client before uploading documents.'
      });
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each file using unified client_documents system
    for (const file of files) {
      try {
        console.log(`  Processing file: ${file.originalname}`);

        // Generate unique filename
        const fileName = clientDocumentsService.generateFileName(file.originalname, meeting.client_id);

        // Upload to unified client-documents storage
        const storageResult = await clientDocumentsService.uploadToStorage(file, fileName, userId);

        // Save metadata to unified client_documents table
        const fileData = {
          user_id: userId,
          meeting_id: parseInt(meetingId),
          client_id: meeting.client_id, // Link to client (already validated above)
          file_name: fileName,
          file_size: file.size,
          file_type: file.mimetype,
          file_url: storageResult.storagePath,
          uploaded_by: userId,
          upload_source: 'meetings_page', // Track source for AI context
          is_deleted: false,
          uploaded_at: new Date().toISOString()
        };

        const savedFile = await clientDocumentsService.saveFileMetadata(fileData);

        // Add download URL
        savedFile.download_url = await clientDocumentsService.getFileDownloadUrl(storageResult.storagePath);

        uploadedFiles.push(savedFile);
        console.log(`  ✅ Uploaded: ${file.originalname}`);
      } catch (fileError) {
        console.error(`  ❌ Error uploading file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    console.log(`✅ Upload complete: ${uploadedFiles.length} files, ${errors.length} errors`);

    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get files for a meeting
// UPDATED: Now uses unified client_documents system
router.get('/meetings/:meetingId/documents', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    console.log(`📄 Fetching documents for meeting ${meetingId}`);

    // Verify meeting access
    const { data: meeting, error: meetingError } = await req.supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Use unified client_documents system
    const files = await clientDocumentsService.getMeetingDocuments(meetingId, userId);

    console.log(`✅ Found ${files.length} documents for meeting ${meetingId}`);

    res.json({
      files,
      count: files.length
    });

  } catch (error) {
    console.error('Error fetching meeting files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Delete a file
// UPDATED: Now uses unified client_documents system
router.delete('/meetings/:meetingId/documents/:fileId', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId, fileId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️  Deleting document ${fileId} from meeting ${meetingId}`);

    // Verify meeting access
    const { data: meeting, error: meetingError } = await req.supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Use unified client_documents system
    await clientDocumentsService.deleteFile(fileId, userId);

    console.log(`✅ Document ${fileId} deleted successfully`);

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// =====================================================
// GOOGLE CALENDAR WEBHOOK ENDPOINTS
// =====================================================

/**
 * Setup Google Calendar webhook for a user
 * This registers a push notification channel with Google
 */
router.post('/webhook/setup', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const webhookService = new GoogleCalendarWebhookService();

    const watchData = await webhookService.setupCalendarWatch(userId);

    res.json({
      success: true,
      message: 'Google Calendar webhook set up successfully',
      watch: {
        channelId: watchData.id,
        resourceId: watchData.resourceId,
        expiration: new Date(parseInt(watchData.expiration))
      }
    });
  } catch (error) {
    console.error('Error setting up calendar webhook:', error);
    res.status(500).json({
      error: 'Failed to set up calendar webhook',
      details: error.message
    });
  }
});

/**
 * Stop Google Calendar webhook for a user
 */
router.post('/webhook/stop', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const webhookService = new GoogleCalendarWebhookService();

    await webhookService.stopCalendarWatch(userId);

    res.json({
      success: true,
      message: 'Google Calendar webhook stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping calendar webhook:', error);
    res.status(500).json({
      error: 'Failed to stop calendar webhook',
      details: error.message
    });
  }
});

/**
 * Receive Google Calendar webhook notifications
 * This endpoint is called by Google when calendar events change
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📥 Received Google Calendar webhook notification');

    const webhookService = new GoogleCalendarWebhookService();

    // Extract channel info from headers
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];

    if (!channelId) {
      console.warn('⚠️  No channel ID in webhook headers');
      return res.status(400).json({ error: 'Missing channel ID' });
    }

    // Get Supabase client
    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available');
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const supabaseClient = getSupabase();

    // Look up the user for this channel
    const { data: channel, error: channelError } = await supabaseClient
      .from('calendar_watch_channels')
      .select('user_id')
      .eq('channel_id', channelId)
      .single();

    if (channelError || !channel) {
      console.warn('⚠️  Unknown channel ID:', channelId);
      return res.status(404).json({ error: 'Unknown channel' });
    }

    // Process the webhook
    const result = await webhookService.processWebhookNotification(req.headers, channel.user_id);

    // Google expects a 200 response quickly
    res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('❌ Error processing Google Calendar webhook:', error);
    // Still return 200 to Google to avoid retries
    res.status(200).json({ success: false, error: error.message });
  }
});

// =====================================================
// MICROSOFT CALENDAR WEBHOOK ENDPOINTS
// =====================================================

const MicrosoftCalendarService = require('../services/microsoftCalendar');

/**
 * Setup Microsoft Calendar webhook for a user
 * This registers a subscription with Microsoft Graph API
 */
router.post('/microsoft/webhook/setup', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const microsoftService = new MicrosoftCalendarService();

    const subscription = await microsoftService.setupCalendarWatch(userId);

    res.json({
      success: true,
      message: 'Microsoft Calendar webhook set up successfully',
      subscription: {
        id: subscription.id,
        expirationDateTime: subscription.expirationDateTime
      }
    });
  } catch (error) {
    console.error('Error setting up Microsoft Calendar webhook:', error);
    res.status(500).json({
      error: 'Failed to set up Microsoft Calendar webhook',
      details: error.message
    });
  }
});

/**
 * Stop Microsoft Calendar webhook for a user
 */
router.post('/microsoft/webhook/stop', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const microsoftService = new MicrosoftCalendarService();

    await microsoftService.stopCalendarWatch(userId);

    res.json({
      success: true,
      message: 'Microsoft Calendar webhook stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping Microsoft Calendar webhook:', error);
    res.status(500).json({
      error: 'Failed to stop Microsoft Calendar webhook',
      details: error.message
    });
  }
});

/**
 * Receive Microsoft Calendar webhook notifications
 * This endpoint is called by Microsoft Graph when calendar events change
 */
router.post('/microsoft/webhook', express.json(), async (req, res) => {
  try {
    console.log('📥 Received Microsoft Calendar webhook notification');

    // Microsoft sends validation token on subscription creation
    const validationToken = req.query.validationToken;
    if (validationToken) {
      console.log('✅ Responding to Microsoft webhook validation');
      return res.status(200).send(validationToken);
    }

    // Process webhook notification
    const notifications = req.body.value;
    if (!notifications || notifications.length === 0) {
      console.warn('⚠️  No notifications in webhook payload');
      return res.status(200).json({ success: true });
    }

    console.log(`📬 Processing ${notifications.length} Microsoft Calendar notification(s)`);

    // Process each notification
    for (const notification of notifications) {
      try {
        const { subscriptionId, clientState, resource } = notification;

        // Verify client state matches what we stored
        const { data: connection } = await getSupabase()
          .from('calendar_connections')
          .select('user_id, microsoft_client_state')
          .eq('microsoft_subscription_id', subscriptionId)
          .single();

        if (!connection) {
          console.warn('⚠️  Unknown subscription ID:', subscriptionId);
          continue;
        }

        if (connection.microsoft_client_state !== clientState) {
          console.warn('⚠️  Client state mismatch - possible security issue');
          continue;
        }

        // Trigger calendar sync for this user using CalendarSyncService
        console.log(`🔄 Triggering Microsoft Calendar sync for user ${connection.user_id}...`);
        const calendarSyncService = require('../services/calendarSync');

        await calendarSyncService.syncUserCalendar(connection.user_id, {
          timeRange: 'extended',
          includeDeleted: true
        });

        console.log(`✅ Synced Microsoft Calendar for user ${connection.user_id}`);
      } catch (notificationError) {
        console.error('❌ Error processing notification:', notificationError);
      }
    }

    // Microsoft expects a 202 response
    res.status(202).json({ success: true });

  } catch (error) {
    console.error('❌ Error processing Microsoft Calendar webhook:', error);
    // Still return 202 to Microsoft to avoid retries
    res.status(202).json({ success: false, error: error.message });
  }
});

// Link a meeting to a client and auto-link other meetings with the same email
router.post('/meetings/:meetingId/link-client', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const { clientId, clientEmail, clientName } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Validate input
    if (!clientId && !clientEmail) {
      return res.status(400).json({ error: 'Either clientId or clientEmail is required' });
    }

    console.log(`🔗 Linking meeting ${meetingId} to client ${clientId || clientEmail}`);

    // Get the meeting to find attendee email
    const { data: meeting, error: meetingError } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('id', parseInt(meetingId))
      .eq('user_id', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // If clientId is provided, use it directly
    let finalClientId = clientId;

    // If only clientEmail is provided, find or create the client
    if (!finalClientId && clientEmail) {
      // Check if client exists
      const { data: existingClient } = await req.supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .eq('email', clientEmail)
        .single();

      if (existingClient) {
        finalClientId = existingClient.id;
      } else {
        // Create new client
        // Note: name is optional (email-first architecture)
        const { data: newClient, error: createError } = await req.supabase
          .from('clients')
          .insert({
            user_id: userId,
            email: clientEmail,
            name: clientName || null,
            pipeline_stage: 'need_to_book_meeting',
            priority_level: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating client:', createError);
          return res.status(500).json({ error: 'Failed to create client' });
        }

        finalClientId = newClient.id;
        console.log(`✅ Created new client: ${newClient.email}`);
      }
    }

    if (!finalClientId) {
      return res.status(400).json({ error: 'Could not determine client ID' });
    }

    // Link the meeting to the client
    const { error: updateError } = await req.supabase
      .from('meetings')
      .update({ client_id: finalClientId })
      .eq('id', meeting.id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error linking meeting to client:', updateError);
      return res.status(500).json({ error: 'Failed to link meeting to client' });
    }

    console.log(`✅ Linked meeting ${meeting.id} to client ${finalClientId}`);

    // Now find all other meetings with the same attendee email and link them too
    let linkedCount = 1; // Count the current meeting
    let attendeeEmail = null;

    // Extract attendee email from meeting attendees
    if (meeting.attendees) {
      try {
        const attendees = JSON.parse(meeting.attendees);
        if (Array.isArray(attendees) && attendees.length > 0) {
          // Find the first non-advisor attendee
          const clientAttendee = attendees.find(a =>
            a.email &&
            a.email !== userId &&
            !a.email.includes('noreply') &&
            !a.email.includes('calendar') &&
            !a.email.includes('google')
          );
          if (clientAttendee) {
            attendeeEmail = clientAttendee.email;
          }
        }
      } catch (e) {
        console.log('Could not parse attendees:', e.message);
      }
    }

    // If we found an attendee email, link all other meetings with that email
    if (attendeeEmail) {
      console.log(`🔍 Looking for other meetings with attendee: ${attendeeEmail}`);

      // Get all meetings for this user
      const { data: allMeetings, error: allMeetingsError } = await req.supabase
        .from('meetings')
        .select('id, attendees')
        .eq('user_id', userId)
        .is('client_id', null); // Only unlinked meetings

      if (!allMeetingsError && allMeetings) {
        for (const m of allMeetings) {
          try {
            const attendees = JSON.parse(m.attendees || '[]');
            const hasAttendee = attendees.some(a => a.email === attendeeEmail);

            if (hasAttendee && m.id !== meeting.id) {
              // Link this meeting too
              await req.supabase
                .from('meetings')
                .update({ client_id: finalClientId })
                .eq('id', m.id);

              linkedCount++;
              console.log(`✅ Auto-linked meeting ${m.id}`);
            }
          } catch (e) {
            // Skip if we can't parse attendees
          }
        }
      }
    }

    console.log(`✅ Successfully linked ${linkedCount} meeting(s) to client`);

    res.json({
      success: true,
      message: `Linked ${linkedCount} meeting(s) to client`,
      clientId: finalClientId,
      linkedCount
    });
  } catch (error) {
    console.error('Error linking meeting to client:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Toggle Recall bot for a specific meeting
router.patch('/meetings/:meetingId/toggle-bot', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { skip_transcription_for_meeting } = req.body;

    if (typeof skip_transcription_for_meeting !== 'boolean') {
      return res.status(400).json({
        error: 'skip_transcription_for_meeting must be a boolean'
      });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    // Verify the meeting belongs to this user
    const { data: meeting, error: fetchError } = await req.supabase
      .from('meetings')
      .select('id, user_id')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({
        error: 'Meeting not found'
      });
    }

    // Update skip_transcription_for_meeting
    const { data, error } = await req.supabase
      .from('meetings')
      .update({
        skip_transcription_for_meeting,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error toggling bot:', error);
      return res.status(500).json({
        error: 'Failed to toggle bot'
      });
    }

    res.json({
      success: true,
      message: skip_transcription_for_meeting ? 'Bot disabled for this meeting' : 'Bot enabled for this meeting',
      meeting: data
    });
  } catch (error) {
    console.error('Error toggling bot:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Debug route to confirm calendar.js is loaded
router.get('/debug-alive', (req, res) => {
  res.json({ status: 'calendar routes alive' });
});

module.exports = router;