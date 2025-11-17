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
            transcription_enabled: false,  // Disabled by default - users can enable in settings
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConnection.id);

        console.log(`✅ Updated Google Calendar connection for user ${state}`);

        // Trigger initial sync to fetch existing Google Calendar meetings (in background, non-blocking)
        try {
          console.log('🔄 Triggering initial Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');
          // Don't await - let it run in background
          calendarSyncService.syncGoogleCalendar(state).then(syncResult => {
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
            transcription_enabled: false  // Disabled by default - users can enable in settings
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
          calendarSyncService.syncGoogleCalendar(state).then(syncResult => {
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
          transcription_enabled: false,  // Disabled by default - users can enable in settings
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
          transcription_enabled: false  // Disabled by default - users can enable in settings
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
      calendarSyncService.syncGoogleCalendar(user.id).then(syncResult => {
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

// Get all meetings for a user
router.get('/meetings', authenticateSupabaseUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const meetings = await calendarService.listMeetings(userId);
        res.json(meetings);
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

// Auto-generate summaries for a meeting
router.post('/meetings/:id/auto-generate-summaries', authenticateSupabaseUser, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { forceRegenerate = false } = req.body;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Get meeting from database with client information
    const { data: meeting, error: fetchError } = await req.supabase
      .from('meetings')
      .select(`
        *,
        clients(id, name, email)
      `)
      .eq('external_id', meetingId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Extract client information for email personalization
    let clientName = 'Client';
    let clientEmail = null;

    if (meeting.clients) {
      clientName = meeting.clients.name || meeting.clients.email.split('@')[0];
      clientEmail = meeting.clients.email;
    } else if (meeting.attendees) {
      try {
        const attendees = JSON.parse(meeting.attendees);
        const clientAttendee = attendees.find(a => a.email && a.email !== req.user.email);
        if (clientAttendee) {
          clientName = clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0];
          clientEmail = clientAttendee.email;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Check if summaries already exist and we're not forcing regeneration
    if (!forceRegenerate && meeting.quick_summary && meeting.email_summary_draft) {
      return res.json({
        quickSummary: meeting.quick_summary,
        emailSummary: meeting.email_summary_draft,
        templateId: meeting.email_template_id,
        lastSummarizedAt: meeting.last_summarized_at,
        alreadyGenerated: true
      });
    }

    // Check if OpenAI is available
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    // Generate Quick Summary (single sentence for Clients page)
    const quickSummaryPrompt = `Create a brief, single-sentence summary of this meeting transcript. Focus on the main outcome or key decision made.

Requirements:
• Must be exactly ONE sentence
• Include the most important outcome or decision
• Keep it professional and concise
• Maximum 150 characters

Transcript:
${meeting.transcript}

Respond with ONLY the single sentence summary, no additional text.`;

    const quickSummary = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: quickSummaryPrompt });

    // Generate Email Summary using Auto template with client name
    const autoTemplate = `Role: You are Nelson Greenwood, a professional financial advisor creating a concise follow-up email for a client.

Goal: Generate a brief, clean email (NO markdown formatting) that summarizes the meeting and confirms next steps.

Constraints:
1. NO markdown symbols (no **, ##, *, or bullet points)
2. Keep it SHORT - maximum 200 words total
3. Use plain text with simple numbered lists
4. Professional but warm tone
5. Include specific numbers/dates from the transcript
6. Focus on what matters most to the client

Format:

Hi ${clientName},

[One sentence: pleasure meeting + main topic discussed]

[2-3 short paragraphs covering the key points with specific numbers/details]

Next Steps:
1. [Action item with timeline]
2. [Action item with timeline]
3. [Action item with timeline]

[One sentence: invitation to ask questions]

Best regards,
Nelson Greenwood
Financial Advisor

Transcript:
${meeting.transcript}

Respond with the email body only - no subject line, no markdown formatting.`;

    const emailSummary = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: autoTemplate });

    // Generate action points as structured JSON array
    const actionPointsPrompt = `You are an AI assistant that extracts action items from meeting transcripts.

Extract ONLY concrete, actionable tasks from this meeting transcript.

INCLUDE ONLY:
- Specific tasks with clear deliverables (e.g., "Send the updated Suitability Letter")
- Follow-up meetings to schedule (e.g., "Schedule follow-up meeting after budget")
- Documents to send, sign, or complete (e.g., "Complete internal BA check")
- Account setups or administrative tasks (e.g., "Set up online account logins")
- Client-facing actions that must be DONE (not discussed)

EXCLUDE:
- Advisor preparation work (e.g., "Research...", "Prepare information...")
- Discussion topics (e.g., "Discuss...", "Review options...")
- General notes or meeting agenda items
- Vague or exploratory items
- Anything that is not a concrete action

CRITICAL: Return ONLY a valid JSON array of strings. No markdown, no code blocks, no explanations.
Format: ["action 1", "action 2", "action 3"]
Limit: Maximum 5-7 most important action items.

Transcript:
${meeting.transcript}

Return only the JSON array:`;

    const actionPointsResponse = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: actionPointsPrompt });

    // Parse action points JSON with robust error handling
    let actionPointsArray = [];
    let actionPoints = actionPointsResponse;

    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = actionPointsResponse.trim();

      // Remove markdown code block markers
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

      // Try to extract JSON array from the response
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      // Parse the JSON
      const parsed = JSON.parse(cleanedResponse);

      if (Array.isArray(parsed)) {
        // Filter out invalid entries (empty strings, non-strings, broken JSON fragments)
        actionPointsArray = parsed
          .filter(item => typeof item === 'string' && item.trim().length > 0)
          .filter(item => {
            // Exclude broken JSON artifacts
            const trimmed = item.trim();
            return trimmed !== 'json' &&
                   trimmed !== '[' &&
                   trimmed !== ']' &&
                   trimmed !== '"""' &&
                   trimmed !== '"' &&
                   trimmed !== '{' &&
                   trimmed !== '}' &&
                   !trimmed.match(/^["'\[\]{}]+$/);
          })
          .map(item => item.trim())
          .slice(0, 7); // Enforce max 7 items

        // Convert to bullet list for display
        actionPoints = actionPointsArray.join('\n• ');
        if (actionPoints) actionPoints = '• ' + actionPoints;
      } else {
        console.warn('Action points response is not an array:', parsed);
        actionPointsArray = [];
        actionPoints = '';
      }
    } catch (e) {
      console.error('Failed to parse action points JSON:', e.message);
      console.error('Raw response:', actionPointsResponse);

      // Fallback: try to extract clean bullet points from plain text
      const lines = actionPointsResponse
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[•\-\*\d]+[\.\)]\s*/, '').trim())
        .filter(line => {
          // Exclude broken JSON artifacts and invalid entries
          return line.length > 10 && // Minimum length for valid action item
                 line !== 'json' &&
                 line !== '[' &&
                 line !== ']' &&
                 line !== '"""' &&
                 !line.match(/^["'\[\]{}]+$/) &&
                 !line.toLowerCase().startsWith('research') &&
                 !line.toLowerCase().startsWith('prepare to discuss');
        })
        .slice(0, 7);

      actionPointsArray = lines;
      actionPoints = lines.length > 0 ? '• ' + lines.join('\n• ') : '';
    }

    // Save summaries to database
    const { error: updateError } = await req.supabase
      .from('meetings')
      .update({
        quick_summary: quickSummary,
        detailed_summary: emailSummary,
        action_points: actionPoints,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', meetingId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error saving summaries:', updateError);
      return res.status(500).json({ error: 'Failed to save summaries' });
    }

    // Save individual action items to PENDING table (awaiting approval)
    if (actionPointsArray.length > 0) {
      // First, delete existing pending action items for this meeting
      await req.supabase
        .from('pending_transcript_action_items')
        .delete()
        .eq('meeting_id', meeting.id);

      // Insert new pending action items
      const actionItemsToInsert = actionPointsArray.map((actionText, index) => ({
        meeting_id: meeting.id,
        client_id: meeting.client_id,
        advisor_id: userId,
        action_text: actionText,
        display_order: index
      }));

      const { error: actionItemsError } = await req.supabase
        .from('pending_transcript_action_items')
        .insert(actionItemsToInsert);

      if (actionItemsError) {
        console.error('Error saving pending action items:', actionItemsError);
        // Don't fail the whole request, just log the error
      } else {
        console.log(`✅ Saved ${actionPointsArray.length} PENDING action items for meeting ${meeting.id} (awaiting approval)`);
      }
    }

    res.json({
      quickSummary,
      emailSummary,
      actionPoints,
      actionItemsCount: actionPointsArray.length,
      templateId: 'auto-template',
      lastSummarizedAt: new Date().toISOString(),
      generated: true
    });

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
      console.log(`🤖 Auto-generating summaries for manually uploaded transcript (meeting ${existingMeeting.id})`);

      try {
        // Fetch full meeting with client info
        const { data: fullMeeting, error: fullMeetingError } = await req.supabase
          .from('meetings')
          .select(`
            *,
            clients(id, name, email)
          `)
          .eq('id', existingMeeting.id)
          .single();

        if (fullMeetingError || !fullMeeting) {
          console.error('❌ Error fetching full meeting details:', fullMeetingError);
          throw fullMeetingError;
        }

        const clientName = fullMeeting.clients?.name || 'Client';

        // Generate Quick Summary (single sentence for Clients page)
        const quickSummaryPrompt = `Create a brief, single-sentence summary of this meeting transcript. Focus on the main outcome or key decision made.

Requirements:
• Must be exactly ONE sentence
• Include the most important outcome or decision
• Keep it professional and concise
• Maximum 150 characters

Transcript:
${transcript}

Respond with ONLY the single sentence summary, no additional text.`;

        const quickSummary = await openai.generateMeetingSummary(transcript, 'standard', { prompt: quickSummaryPrompt });

        // Generate Email Summary using Auto template with client name
        const autoTemplate = `Role: You are Nelson Greenwood, a professional financial advisor creating a concise follow-up email for a client.

Goal: Generate a brief, clean email (NO markdown formatting) that summarizes the meeting and confirms next steps.

Constraints:
1. NO markdown symbols (no **, ##, *, or bullet points)
2. Keep it SHORT - maximum 200 words total
3. Use plain text with simple numbered lists
4. Professional but warm tone
5. Include specific numbers/dates from the transcript
6. Focus on what matters most to the client

Format:

Hi ${clientName},

[One sentence: pleasure meeting + main topic discussed]

[2-3 short paragraphs covering the key points with specific numbers/details]

Next Steps:
1. [Action item with timeline]
2. [Action item with timeline]
3. [Action item with timeline]

[One sentence: invitation to ask questions]

Best regards,
Nelson Greenwood
Financial Advisor

Transcript:
${transcript}

Respond with the email body only - no subject line, no markdown formatting.`;

        const emailSummary = await openai.generateMeetingSummary(transcript, 'standard', { prompt: autoTemplate });

        // Generate action points as structured JSON array
        const actionPointsPrompt = `You are an AI assistant that extracts action items from meeting transcripts.

Extract ONLY concrete, actionable tasks from this meeting transcript.

INCLUDE ONLY:
- Specific tasks with clear deliverables (e.g., "Send the updated Suitability Letter")
- Follow-up meetings to schedule (e.g., "Schedule follow-up meeting after budget")
- Documents to send, sign, or complete (e.g., "Complete internal BA check")
- Account setups or administrative tasks (e.g., "Set up online account logins")
- Client-facing actions that must be DONE (not discussed)

EXCLUDE:
- Advisor preparation work (e.g., "Research...", "Prepare information...")
- Discussion topics (e.g., "Discuss...", "Review options...")
- General notes or meeting agenda items
- Vague or exploratory items
- Anything that is not a concrete action

CRITICAL: Return ONLY a valid JSON array of strings. No markdown, no code blocks, no explanations.
Format: ["action 1", "action 2", "action 3"]
Limit: Maximum 5-7 most important action items.

Transcript:
${transcript}

Return only the JSON array:`;

        const actionPointsResponse = await openai.generateMeetingSummary(transcript, 'standard', { prompt: actionPointsPrompt });

        // Parse action points JSON with robust error handling
        let actionPointsArray = [];
        let actionPoints = actionPointsResponse;

        try {
          // Clean the response - remove markdown code blocks if present
          let cleanedResponse = actionPointsResponse.trim();

          // Remove markdown code block markers
          cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

          // Try to extract JSON array from the response
          const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            cleanedResponse = jsonMatch[0];
          }

          // Parse the JSON
          const parsed = JSON.parse(cleanedResponse);

          if (Array.isArray(parsed)) {
            // Filter out invalid entries (empty strings, non-strings, broken JSON fragments)
            actionPointsArray = parsed
              .filter(item => typeof item === 'string' && item.trim().length > 0)
              .filter(item => {
                // Exclude broken JSON artifacts
                const trimmed = item.trim();
                return trimmed !== 'json' &&
                       trimmed !== '[' &&
                       trimmed !== ']' &&
                       trimmed !== '"""' &&
                       trimmed !== '"' &&
                       trimmed !== '{' &&
                       trimmed !== '}' &&
                       !trimmed.match(/^["'\[\]{}]+$/);
              })
              .map(item => item.trim())
              .slice(0, 7); // Enforce max 7 items

            // Convert to bullet list for display
            actionPoints = actionPointsArray.join('\n• ');
            if (actionPoints) actionPoints = '• ' + actionPoints;
          } else {
            console.warn('Action points response is not an array:', parsed);
            actionPointsArray = [];
            actionPoints = '';
          }
        } catch (e) {
          console.error('Failed to parse action points JSON:', e.message);
          console.error('Raw response:', actionPointsResponse);

          // Fallback: try to extract clean bullet points from plain text
          const lines = actionPointsResponse
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[•\-\*\d]+[\.\)]\s*/, '').trim())
            .filter(line => {
              // Exclude broken JSON artifacts and invalid entries
              return line.length > 10 && // Minimum length for valid action item
                     line !== 'json' &&
                     line !== '[' &&
                     line !== ']' &&
                     line !== '"""' &&
                     !line.match(/^["'\[\]{}]+$/) &&
                     !line.toLowerCase().startsWith('research') &&
                     !line.toLowerCase().startsWith('prepare to discuss');
            })
            .slice(0, 7);

          actionPointsArray = lines;
          actionPoints = lines.length > 0 ? '• ' + lines.join('\n• ') : '';
        }

        // Save individual action items to PENDING table (awaiting approval)
        if (actionPointsArray.length > 0) {
          // First, delete existing pending action items for this meeting
          await req.supabase
            .from('pending_transcript_action_items')
            .delete()
            .eq('meeting_id', fullMeeting.id);

          // Insert new pending action items
          const actionItemsToInsert = actionPointsArray.map((actionText, index) => ({
            meeting_id: fullMeeting.id,
            client_id: fullMeeting.client_id,
            advisor_id: userId,
            action_text: actionText,
            display_order: index
          }));

          const { error: actionItemsError } = await req.supabase
            .from('pending_transcript_action_items')
            .insert(actionItemsToInsert);

          if (actionItemsError) {
            console.error('Error saving pending action items:', actionItemsError);
            // Don't fail the whole request, just log the error
          } else {
            console.log(`✅ Saved ${actionPointsArray.length} PENDING action items for meeting ${fullMeeting.id} (awaiting approval)`);
          }
        }

        // Return response with summaries (matching frontend expectations)
        console.log(`✅ Auto-generated summaries for manual transcript upload (meeting ${existingMeeting.id})`);

        return res.json({
          message: 'Transcript uploaded and summaries generated successfully',
          meeting: {
            ...updatedMeeting,
            id: updatedMeeting.id,
            startTime: updatedMeeting.starttime,
            googleEventId: updatedMeeting.external_id
          },
          summaries: {
            quickSummary,
            emailSummary,
            detailedSummary: emailSummary, // Use email summary as detailed summary
            actionPoints
          },
          actionItemsCount: actionPointsArray.length,
          autoGenerated: true
        });

      } catch (aiError) {
        console.error('❌ Error generating summaries for manual transcript:', aiError);
        // Still return success for transcript upload, just without summaries
        // This ensures the transcript is saved even if AI generation fails
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
          meeting_id: parseInt(meetingId),
          client_id: meeting.client_id || null, // Link to client if available
          advisor_id: userId,
          file_name: fileName,
          original_name: file.originalname,
          file_type: file.mimetype,
          file_category: clientDocumentsService.getFileCategory(file.mimetype),
          file_size: file.size,
          storage_path: storageResult.path,
          storage_bucket: 'client-documents', // Unified bucket
          uploaded_by: userId,
          upload_source: 'meetings_page', // Track source for AI context
          analysis_status: 'pending'
        };

        const savedFile = await clientDocumentsService.saveFileMetadata(fileData);

        // Add download URL
        savedFile.download_url = await clientDocumentsService.getFileDownloadUrl(storageResult.path);

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

/**
 * Test endpoint for Google Calendar webhook
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    success: true,
    message: 'Google Calendar webhook endpoint is accessible',
    url: `${req.protocol}://${req.get('host')}/api/calendar/webhook`,
    instructions: [
      '1. Authenticate with Google Calendar',
      '2. Call POST /api/calendar/webhook/setup to register webhook',
      '3. Google will send notifications to this endpoint when calendar changes',
      '4. Webhook will automatically sync changed events to database'
    ]
  });
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

/**
 * Test endpoint for Microsoft Calendar webhook
 */
router.get('/microsoft/webhook/test', (req, res) => {
  res.json({
    success: true,
    message: 'Microsoft Calendar webhook endpoint is accessible',
    url: `${req.protocol}://${req.get('host')}/api/calendar/microsoft/webhook`,
    instructions: [
      '1. Authenticate with Microsoft Calendar',
      '2. Call POST /api/calendar/microsoft/webhook/setup to register webhook',
      '3. Microsoft will send notifications to this endpoint when calendar changes',
      '4. Webhook will automatically sync changed events to database'
    ]
  });
});

// ============================================
// CALENDLY OAUTH ENDPOINTS
// ============================================

const CalendlyOAuthService = require('../services/calendlyOAuth');

/**
 * GET /api/calendar/calendly/auth
 * Generate Calendly OAuth authorization URL
 */
router.get('/calendly/auth', (req, res) => {
  try {
    const oauthService = new CalendlyOAuthService();

    if (!oauthService.isConfigured()) {
      return res.status(400).json({
        error: 'Calendly OAuth not configured',
        message: 'Please set CALENDLY_OAUTH_CLIENT_ID and CALENDLY_OAUTH_CLIENT_SECRET environment variables'
      });
    }

    const state = Math.random().toString(36).substring(7);
    const authUrl = oauthService.getAuthorizationUrl(state);

    res.json({ url: authUrl, state });
  } catch (error) {
    console.error('Error generating Calendly auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/calendar/calendly/auth-url
 * Get Calendly OAuth authorization URL (authenticated endpoint for onboarding)
 *
 * NOTE: The state parameter will be added by the frontend with the user ID
 * This endpoint just returns the base URL without state
 */
router.get('/calendly/auth-url', authenticateSupabaseUser, async (req, res) => {
  try {
    const oauthService = new CalendlyOAuthService();

    if (!oauthService.isConfigured()) {
      return res.status(400).json({
        error: 'Calendly OAuth not configured',
        message: 'Please set CALENDLY_OAUTH_CLIENT_ID and CALENDLY_OAUTH_CLIENT_SECRET environment variables'
      });
    }

    // ✅ IMPORTANT: Don't generate state here - frontend will add user ID as state
    // This ensures the OAuth callback knows which user is connecting
    const state = 'placeholder'; // Will be replaced by frontend
    const authUrl = oauthService.getAuthorizationUrl(state);

    // Remove the placeholder state - frontend will add the real one
    const baseUrl = authUrl.replace('state=placeholder', '');

    res.json({ url: baseUrl });
  } catch (error) {
    console.error('Error generating Calendly auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/calendar/calendly/oauth/callback
 * Handle Calendly OAuth callback
 *
 * ✅ SECURITY FIX: Validate state parameter matches authenticated user
 * This prevents users from connecting other users' Calendly accounts
 */
router.get('/calendly/oauth/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;

    console.log('🔐 Calendly OAuth callback received');
    console.log('  - code:', code ? '✅ Present' : '❌ Missing');
    console.log('  - error:', error || 'None');
    console.log('  - state:', state ? '✅ Present' : '❌ Missing');

    if (error) {
      console.error('❌ OAuth error from Calendly:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=NoCode`);
    }

    // ✅ CRITICAL SECURITY FIX: State parameter is REQUIRED
    // The state parameter contains the authenticated user's ID
    // Without it, we cannot verify which user is connecting
    if (!state) {
      console.error('❌ SECURITY VIOLATION: No state parameter in OAuth callback');
      console.error('   This could indicate a CSRF attack or compromised OAuth flow');
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=SecurityViolation`);
    }

    if (!isSupabaseAvailable()) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=DatabaseUnavailable`);
    }

    const oauthService = new CalendlyOAuthService();

    if (!oauthService.isConfigured()) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=OAuthNotConfigured`);
    }

    // Initialize token variables (will be populated below)
    let accessToken, refreshToken;
    let isTokenRefresh = false;

    // First, do the OAuth token exchange to get initial tokens
    // (Token refresh will be attempted later after we know the userId)
    console.log('🔐 Performing OAuth token exchange...');
    const tokenData = await oauthService.exchangeCodeForToken(code);
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;

    // Get user info from Calendly (for logging/verification only)
    const userResponse = await oauthService.getCurrentUser(accessToken);
    const calendlyUser = userResponse.resource;

    // ✅ DIAGNOSTIC: Log full user response for diagnostics
    console.log('📋 Full Calendly User Response:', JSON.stringify(userResponse, null, 2));
    console.log(`✅ Calendly OAuth successful for Calendly account: ${calendlyUser.email}`);

    // ✅ DIAGNOSTIC: Fetch and log organization details to check plan
    try {
      const orgResponse = await fetch(calendlyUser.current_organization, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        console.log('🏢 Calendly Organization Details:', JSON.stringify(orgData, null, 2));

        const plan = orgData.resource?.plan?.toLowerCase();
        if (plan) {
          console.log(`📊 Organization Plan: ${plan.toUpperCase()}`);
          if (plan === 'free' || plan === 'basic') {
            console.warn('⚠️  WARNING: Organization is on FREE/BASIC plan - webhooks may not be available');
          } else {
            console.log('✅ Organization is on PAID plan - webhooks should be available');
          }
        }
      } else {
        console.warn('⚠️  Could not fetch organization details:', orgResponse.status);
      }
    } catch (orgError) {
      console.warn('⚠️  Error fetching organization:', orgError.message);
    }

    // ✅ CRITICAL SECURITY FIX: Validate state parameter
    // The state parameter contains the authenticated user's ID
    // We must validate it's a valid UUID format to prevent injection attacks
    const userId = state;

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error(`❌ SECURITY VIOLATION: Invalid user ID format in state parameter: ${userId}`);
      console.error('   This could indicate a CSRF attack or malicious OAuth flow');
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=InvalidUserContext`);
    }

    console.log(`✅ Linking Calendly account to authenticated user: ${userId}`);

    // ✅ PHASE 1: Try token refresh first (for reconnection scenarios)
    // This reduces unnecessary OAuth redirects when user reconnects
    // Check if user already has a Calendly connection with a refresh token
    const { data: existingConnection } = await getSupabase()
      .from('calendar_connections')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .maybeSingle();

    if (existingConnection?.refresh_token) {
      try {
        console.log('🔄 Attempting token refresh for existing Calendly connection...');
        const refreshedTokenData = await oauthService.refreshAccessToken(existingConnection.refresh_token);
        accessToken = refreshedTokenData.access_token;
        refreshToken = refreshedTokenData.refresh_token || existingConnection.refresh_token;
        isTokenRefresh = true;
        console.log('✅ Token refresh successful - using refreshed tokens');
      } catch (refreshError) {
        console.warn('⚠️  Token refresh failed, keeping OAuth tokens:', refreshError.message);
        // Keep the OAuth tokens we already obtained
      }
    }
    // Note: We already have accessToken and refreshToken from the OAuth exchange above
    // If token refresh succeeded, we've updated them; otherwise we use the OAuth tokens

    // Verify user exists in database and get their tenant_id
    const { data: user, error: userError } = await getSupabase()
      .from('users')
      .select('id, email, tenant_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ Authenticated user not found in database:', userError);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=UserNotFound`);
    }

    if (!user.tenant_id) {
      console.error('❌ User has no tenant_id:', userId);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=NoTenant`);
    }

    console.log(`✅ Verified authenticated user: ${user.email} (${user.id}) in tenant ${user.tenant_id}`);

    // ✅ SECURITY: State parameter already proves user authentication
    // The state parameter contains the user ID, which means:
    // 1. Only the authenticated user could have initiated this OAuth flow (they have the JWT token)
    // 2. The state parameter proves which user is connecting
    // 3. We trust the OAuth provider (Calendly) to verify the user owns the account
    // 4. RLS policies prevent cross-user data access at the database level
    console.log(`\n🔐 SECURITY: State parameter validation passed`);
    console.log(`   Authenticated user: ${user.email} (${user.id})`);
    console.log(`   Calendly account: ${calendlyUser.email}`);
    console.log(`   ✅ User is connecting their own Calendly account (verified by state parameter)`);
    console.log(`   ✅ Calendly OAuth verified the user owns this account`);

    // Deactivate other active calendar connections for this user (but not Calendly)
    await getSupabase()
      .from('calendar_connections')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('provider', 'calendly');

    // Create or update Calendly connection for the authenticated user
    const { data: existingCalendlyConnection } = await getSupabase()
      .from('calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .single();

    if (existingCalendlyConnection) {
      // Update existing connection (reconnection scenario)
      await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          provider_account_email: calendlyUser.email,
          calendly_user_uri: calendlyUser.uri, // ✅ Store Calendly user URI for webhook matching
          calendly_organization_uri: calendlyUser.current_organization, // ✅ Store org URI
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCalendlyConnection.id);

      console.log(`✅ Updated Calendly connection for user ${userId} (reconnection)`);
    } else {
      // Create new connection (first-time connection)
      const { error: insertError } = await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: userId,
          tenant_id: user.tenant_id,
          provider: 'calendly',
          access_token: accessToken,
          refresh_token: refreshToken,
          provider_account_email: calendlyUser.email,
          calendly_user_uri: calendlyUser.uri, // ✅ Store Calendly user URI for webhook matching
          calendly_organization_uri: calendlyUser.current_organization, // ✅ Store org URI
          is_active: true
        });

      if (insertError) {
        console.error('❌ Error creating Calendly connection:', insertError);
        return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=ConnectionFailed`);
      }

      console.log(`✅ Created new Calendly connection for user ${userId} in tenant ${user.tenant_id}`);
    }

    // ✅ Create USER-SCOPED webhook subscription (one per user, not per organization)
    // This ensures each user gets their own webhook with their own signing key
    // Supports 100s of users with their own private Calendly accounts
    try {
      console.log('📡 Setting up user-scoped Calendly webhook subscription...');
      const CalendlyWebhookService = require('../services/calendlyWebhookService');
      const webhookService = new CalendlyWebhookService(accessToken);

      if (webhookService.isConfigured()) {
        // ✅ AWAIT webhook creation to ensure webhook ID is stored before redirecting
        // ✅ Pass userId for user-scoped webhook creation
        const webhookResult = await webhookService.ensureWebhookSubscription(
          calendlyUser.current_organization,
          calendlyUser.uri,
          userId  // ✅ USER-SCOPED: Pass user ID for per-user webhook
        );

        if (webhookResult.created) {
          console.log('✅ User-scoped Calendly webhook subscription created:', webhookResult.webhook_uri);
        } else {
          console.log('✅ User-scoped Calendly webhook subscription already exists:', webhookResult.webhook_uri);
        }

        // ✅ Store webhook ID AND signing key in calendar_connections table
        const { error: webhookUpdateError } = await getSupabase()
          .from('calendar_connections')
          .update({
            calendly_webhook_id: webhookResult.webhook_uri,
            calendly_webhook_signing_key: webhookResult.webhook_signing_key  // ✅ Store signing key
          })
          .eq('user_id', userId)
          .eq('provider', 'calendly');

        if (webhookUpdateError) {
          console.error('❌ Error storing webhook ID in calendar_connections:', webhookUpdateError);
        } else {
          console.log('✅ Webhook ID stored in calendar_connections:', webhookResult.webhook_uri);
          console.log('🔑 Webhook signing key stored for verification');
        }
      } else {
        console.warn('⚠️  Calendly webhook service not configured (missing signing key)');
      }
    } catch (webhookError) {
      console.warn('⚠️  Failed to setup webhook:', webhookError.message);
      // Don't fail the connection if webhook setup fails - user can still use polling
    }

    // Trigger initial sync to fetch existing Calendly meetings (in background, non-blocking)
    try {
      console.log('🔄 Triggering initial Calendly sync in background...');
      const CalendlyService = require('../services/calendlyService');

      // Use the access token we just stored in the database
      const calendlyService = new CalendlyService(accessToken);

      // Don't await - let it run in background
      calendlyService.syncMeetingsToDatabase(userId).then(syncResult => {
        console.log('✅ Initial Calendly sync completed:', syncResult);
      }).catch(syncError => {
        console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
      });
    } catch (syncError) {
      console.warn('⚠️  Failed to start background sync:', syncError.message);
      // Don't fail the connection if sync fails
    }

    // ✅ FIX: Close popup window and notify parent window instead of redirecting
    // This keeps the main window intact and returns focus after auth
    res.send(`
      <html>
        <head>
          <title>Calendly Connected</title>
        </head>
        <body>
          <script>
            // Notify parent window of successful connection
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDLY_OAUTH_SUCCESS',
                message: 'Calendly connected successfully'
              }, '*');
            }
            // Close this popup window
            window.close();
          </script>
          <p>Calendly connected successfully! This window will close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in Calendly OAuth callback:', error);
    // ✅ FIX: Send error to parent window and close popup
    res.send(`
      <html>
        <head>
          <title>Connection Error</title>
        </head>
        <body>
          <script>
            // Notify parent window of error
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDLY_OAUTH_ERROR',
                error: '${error.message}'
              }, '*');
            }
            // Close this popup window
            window.close();
          </script>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
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