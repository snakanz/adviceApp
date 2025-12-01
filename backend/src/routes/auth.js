const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Get Google OAuth URL
router.get('/google', (req, res) => {
  const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

    res.json({ url });
});

// Check Google Calendar connection status
router.get('/google/status', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    const userId = req.user.id;

    // Check if user has Google Calendar connection in new calendar_connections table
    const { data: calendarConnection, error } = await req.supabase
      .from('calendar_connections')
      .select('access_token, refresh_token, token_expires_at, provider, is_active')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Google Calendar status:', error);
      return res.status(500).json({
        connected: false,
        error: 'Failed to check status'
      });
    }

    if (!calendarConnection) {
      return res.json({
        connected: false,
        message: 'Google Calendar not connected'
      });
    }

    // Check if token is expired (if token_expires_at is set)
    let isExpired = false;
    if (calendarConnection.token_expires_at) {
      const expiresAt = new Date(calendarConnection.token_expires_at);
      const now = new Date();
      isExpired = expiresAt <= now;
    }

    return res.json({
      connected: calendarConnection.is_active && !isExpired,
      user: req.user.email,
      expiresAt: calendarConnection.token_expires_at,
      expired: isExpired,
      message: isExpired ? 'Google Calendar token expired' : 'Google Calendar connected'
    });

  } catch (error) {
    console.error('Error in /auth/google/status:', error);
    return res.status(500).json({
      connected: false,
      error: 'Failed to check Google Calendar status'
    });
  }
});

/**
 * POST /api/auth/verify-webhooks
 * Verify and re-engage calendar webhooks on user login
 * Called by frontend when user logs in to ensure webhooks are active
 */
router.post('/verify-webhooks', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔍 Verifying webhooks for user ${userId} on login...`);

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    const webhookResults = {
      google: { status: 'not_connected' },
      microsoft: { status: 'not_connected' },
      calendly: { status: 'not_connected' }
    };

    // Check Google Calendar webhook
    try {
      const { data: googleConnection } = await req.supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('is_active', true)
        .single();

      if (googleConnection) {
        console.log(`✅ Google Calendar is active for user ${userId}`);
        webhookResults.google = {
          status: 'active',
          sync_method: 'webhook',
          message: 'Google Calendar webhook is active'
        };
      }
    } catch (err) {
      console.log(`ℹ️ Google Calendar not connected for user ${userId}`);
    }

    // Check Microsoft Calendar webhook and renew if needed
    try {
      const { data: microsoftConnection } = await req.supabase
        .from('calendar_connections')
        .select('microsoft_subscription_id, microsoft_subscription_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'microsoft')
        .eq('is_active', true)
        .single();

      if (microsoftConnection && microsoftConnection.microsoft_subscription_id) {
        console.log(`✅ Microsoft Calendar is active for user ${userId}`);

        const expiresAt = new Date(microsoftConnection.microsoft_subscription_expires_at);
        const now = new Date();
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

        // Renew if expiring within 24 hours or already expired
        if (hoursUntilExpiry < 24) {
          console.log(`🔄 Microsoft webhook expiring soon (${hoursUntilExpiry.toFixed(1)}h), renewing...`);

          try {
            const MicrosoftCalendarService = require('../services/microsoftCalendar');
            const microsoftService = new MicrosoftCalendarService();
            await microsoftService.renewCalendarWatch(userId);
            console.log('✅ Microsoft webhook renewed on login');

            webhookResults.microsoft = {
              status: 'active',
              sync_method: 'webhook',
              message: 'Microsoft Calendar webhook renewed',
              expires_in_hours: 72 // Renewed for 3 days
            };
          } catch (renewError) {
            console.error('❌ Failed to renew Microsoft webhook:', renewError.message);
            webhookResults.microsoft = {
              status: 'error',
              sync_method: 'webhook',
              message: 'Failed to renew webhook',
              error: renewError.message
            };
          }
        } else {
          webhookResults.microsoft = {
            status: 'active',
            sync_method: 'webhook',
            message: 'Microsoft Calendar webhook is active',
            expires_in_hours: hoursUntilExpiry.toFixed(1)
          };
        }
      }
    } catch (err) {
      console.log(`ℹ️ Microsoft Calendar not connected for user ${userId}`);
    }

    // Check Calendly webhook
    try {
      const CalendlyWebhookManager = require('../services/calendlyWebhookManager');
      const webhookManager = new CalendlyWebhookManager();

      const { data: calendlyConnection } = await req.supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      if (calendlyConnection) {
        console.log(`🔍 Calendly is connected for user ${userId}, verifying webhook...`);

        const webhookStatus = await webhookManager.getWebhookStatus(userId);
        webhookResults.calendly = webhookStatus;

        if (webhookStatus.webhook_active) {
          console.log(`✅ Calendly webhook verified active for user ${userId}`);
        } else {
          console.warn(`⚠️ Calendly webhook not active for user ${userId} - will use polling`);
        }
      }
    } catch (err) {
      console.log(`ℹ️ Calendly not connected for user ${userId}`);
    }

    res.json({
      success: true,
      user_id: userId,
      webhooks: webhookResults,
      message: 'Webhook verification completed'
    });

  } catch (error) {
    console.error('Error verifying webhooks:', error);
    res.status(500).json({
      error: 'Failed to verify webhooks',
      details: error.message
    });
  }
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log('📅 /api/auth/google/callback called');
    console.log('  - code:', code ? '✅ Present' : '❌ Missing');

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=database_unavailable`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=missing_code`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    console.log('📅 Google OAuth callback - User:', userInfo.data.email);
    console.log('📅 Google tokens received - Access token:', tokens.access_token ? 'yes' : 'no', 'Refresh token:', tokens.refresh_token ? 'yes' : 'no');

    // Find or create user
    const { data: existingUser, error: findError } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', userInfo.data.email)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error finding user:', findError);
      throw new Error('Database error while finding user');
    }

    // Use UserService to get or create user with Supabase Auth UUID
    const UserService = require('../services/userService');

    // Create a Supabase user object from Google OAuth info
    const supabaseUser = {
      id: userInfo.data.id,  // This will be replaced with Supabase Auth UUID if available
      email: userInfo.data.email,
      user_metadata: {
        full_name: userInfo.data.name
      }
    };

    // Get or create user
    const user = await UserService.getOrCreateUser(supabaseUser);
    let tenantId = user.tenant_id;

    // Ensure user has a tenant (UserService should have created one, but double-check)
    if (!tenantId) {
      tenantId = await UserService.ensureUserHasTenant(user);
    }

    console.log(`✅ Created default tenant ${tenantId} for user ${user.id}`);

    // Store Google tokens in calendar_connections table
    console.log('💾 Storing Google Calendar tokens in calendar_connections...');

    // Check if calendar connection already exists for this specific email
    const { data: existingConnection } = await getSupabase()
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('provider_account_email', userInfo.data.email)
      .single();

    if (existingConnection) {
      console.log('✅ Updating existing Google Calendar connection...');

      // Update existing connection
      const { error: updateError } = await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating calendar connection:', updateError);
      } else {
        console.log('✅ Google Calendar connection updated successfully');
        // Trigger sync and webhook setup in background (non-blocking)
        try {
          console.log('🔄 Triggering Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');
          calendarSyncService.syncUserCalendar(user.id, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
            console.log('✅ Google Calendar sync completed:', syncResult);
          }).catch(syncError => {
            console.warn('⚠️  Google Calendar sync failed (non-fatal):', syncError.message);
          });
        } catch (syncError) {
          console.warn('⚠️  Failed to start background sync:', syncError.message);
        }
        // Set up webhook for real-time updates (non-blocking)
        try {
          console.log('📡 Setting up Google Calendar webhook in background...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();
          webhookService.setupCalendarWatch(user.id).then(watchData => {
            console.log('✅ Google Calendar webhook established:', watchData?.id);
          }).catch(webhookError => {
            console.warn('⚠️  Webhook setup failed (non-fatal):', webhookError.message);
          });
        } catch (webhookError) {
          console.warn('⚠️  Failed to start webhook setup:', webhookError.message);
        }
      }
    } else {
      console.log('✅ Creating new Google Calendar connection...');

      // Deactivate all other active connections for this user (single active connection per user)
      console.log('🔄 Deactivating other active calendar connections...');
      const { error: deactivateError } = await getSupabase()
        .from('calendar_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (deactivateError) {
        console.warn('Warning: Could not deactivate other connections:', deactivateError);
      } else {
        console.log('✅ Other connections deactivated');
      }

      // Create new calendar connection
      const { error: createError } = await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          provider: 'google',
          provider_account_email: userInfo.data.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true,
          is_primary: true,
          sync_enabled: true,
          transcription_enabled: false // Disabled by default - user must opt-in
        });

      if (createError) {
        console.error('Error creating calendar connection:', createError);
      } else {
        console.log('✅ Google Calendar connection created successfully');
        // Trigger initial sync in background (non-blocking)
        try {
          console.log('🔄 Triggering initial Google Calendar sync in background...');
          const calendarSyncService = require('../services/calendarSync');
          calendarSyncService.syncUserCalendar(user.id, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
            console.log('✅ Initial Google Calendar sync completed:', syncResult);
          }).catch(syncError => {
            console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
          });
        } catch (syncError) {
          console.warn('⚠️  Failed to start background sync:', syncError.message);
        }
        // Set up webhook for real-time updates (non-blocking)
        try {
          console.log('📡 Setting up Google Calendar webhook in background...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();
          webhookService.setupCalendarWatch(user.id).then(watchData => {
            console.log('✅ Google Calendar webhook established:', watchData?.id);
          }).catch(webhookError => {
            console.warn('⚠️  Webhook setup failed (non-fatal):', webhookError.message);
          });
        } catch (webhookError) {
          console.warn('⚠️  Failed to start webhook setup:', webhookError.message);
        }
      }
    }

    // Generate JWT and redirect to frontend
    console.log('✅ Redirect mode - Generating JWT and redirecting to /auth/callback');
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// ============================================================================
// MICROSOFT CALENDAR OAUTH
// ============================================================================

// Get Microsoft OAuth URL
// Test endpoint to verify Microsoft callback route is accessible
router.get('/microsoft/callback/test', (req, res) => {
  console.log('🧪 Microsoft callback test endpoint hit');
  res.json({
    success: true,
    message: 'Microsoft callback route is accessible',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify Microsoft OAuth configuration
router.get('/microsoft/test-config', (req, res) => {
  try {
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    const isConfigured = microsoftService.isConfigured();

    res.json({
      success: true,
      configured: isConfigured,
      clientId: microsoftService.clientId ? '✅ Set' : '❌ Missing',
      clientSecret: microsoftService.clientSecret ? '✅ Set' : '❌ Missing',
      tenantId: microsoftService.tenantId || 'common',
      redirectUri: microsoftService.redirectUri,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/microsoft', async (req, res) => {
  try {
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    if (!microsoftService.isConfigured()) {
      return res.status(400).json({
        error: 'Microsoft OAuth not configured',
        message: 'Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables'
      });
    }

    console.log('🔗 Generating Microsoft OAuth URL...');
    console.log('  - Redirect URI:', microsoftService.redirectUri);

    // IMPORTANT: getAuthCodeUrl() returns a Promise, so we need to await it
    const url = await microsoftService.getAuthorizationUrl();

    console.log('✅ Microsoft OAuth URL generated successfully');
    console.log('  - URL length:', url.length);
    console.log('  - URL starts with:', url.substring(0, 50) + '...');

    res.json({ url });
  } catch (error) {
    console.error('❌ Error generating Microsoft auth URL:', error);
    console.error('  - Error message:', error.message);
    console.error('  - Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate authorization URL', details: error.message });
  }
});

// Check Microsoft Calendar connection status
router.get('/microsoft/status', authenticateSupabaseUser, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable'
      });
    }

    const userId = req.user.id;

    // Check if user has Microsoft Calendar connection
    const { data: calendarConnection, error } = await req.supabase
      .from('calendar_connections')
      .select('access_token, refresh_token, token_expires_at, provider, is_active')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Microsoft Calendar status:', error);
      return res.status(500).json({
        connected: false,
        error: 'Failed to check status'
      });
    }

    if (!calendarConnection) {
      return res.json({
        connected: false,
        message: 'Microsoft Calendar not connected'
      });
    }

    // Check if token is expired
    let isExpired = false;
    if (calendarConnection.token_expires_at) {
      const expiresAt = new Date(calendarConnection.token_expires_at);
      const now = new Date();
      isExpired = expiresAt <= now;
    }

    return res.json({
      connected: calendarConnection.is_active && !isExpired,
      user: req.user.email,
      expiresAt: calendarConnection.token_expires_at,
      expired: isExpired,
      message: isExpired ? 'Microsoft Calendar token expired' : 'Microsoft Calendar connected'
    });

  } catch (error) {
    console.error('Error in /auth/microsoft/status:', error);
    return res.status(500).json({
      connected: false,
      error: 'Failed to check Microsoft Calendar status'
    });
  }
});

// Handle Microsoft OAuth callback
router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Log with timestamp and all request details
    const timestamp = new Date().toISOString();
    console.log('='.repeat(80));
    console.log(`📅 MICROSOFT CALLBACK HIT - ${timestamp}`);
    console.log('='.repeat(80));
    console.log('  - code:', code ? '✅ Present' : '❌ Missing');
    console.log('  - Full query params:', JSON.stringify(req.query));
    console.log('  - error:', req.query.error || 'none');
    console.log('  - error_description:', req.query.error_description || 'none');
    console.log('='.repeat(80));

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      if (state) {
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'MICROSOFT_OAUTH_ERROR',
                    error: 'Database service unavailable'
                  }, '*');
                }
                window.close();
              </script>
              <p>Error: Database service unavailable</p>
            </body>
          </html>
        `);
      }
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    if (!code) {
      if (state) {
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'MICROSOFT_OAUTH_ERROR',
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

    // Exchange code for tokens
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    const tokenResponse = await microsoftService.exchangeCodeForToken(code);
    const accessToken = tokenResponse.accessToken;
    const refreshToken = tokenResponse.refreshToken;
    const expiresOn = tokenResponse.expiresOn;

    // Get user info from Microsoft
    const userInfo = await microsoftService.getUserInfo(accessToken);

    console.log('📅 Microsoft OAuth callback - User:', userInfo.mail || userInfo.userPrincipalName);
    console.log('📅 Microsoft tokens received - Access token:', accessToken ? 'yes' : 'no', 'Refresh token:', refreshToken ? 'yes' : 'no');

    // Find or create user
    const userEmail = userInfo.mail || userInfo.userPrincipalName;
    const { data: existingUser, error: findError } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding user:', findError);
      throw new Error('Database error while finding user');
    }

    // Use UserService to get or create user
    const UserService = require('../services/userService');

    const supabaseUser = {
      id: userInfo.id,
      email: userEmail,
      user_metadata: {
        full_name: userInfo.displayName
      }
    };

    const user = await UserService.getOrCreateUser(supabaseUser);
    let tenantId = user.tenant_id;

    if (!tenantId) {
      tenantId = await UserService.ensureUserHasTenant(user);
    }

    console.log(`✅ User ${user.id} has tenant ${tenantId}`);

    // Store Microsoft tokens in calendar_connections table
    console.log('💾 Storing Microsoft Calendar tokens in calendar_connections...');

    const { data: existingConnection } = await getSupabase()
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .eq('provider_account_email', userEmail)
      .single();

    if (existingConnection) {
      console.log('✅ Updating existing Microsoft Calendar connection...');

      const { error: updateError } = await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken || null,
          token_expires_at: expiresOn ? new Date(expiresOn).toISOString() : null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating calendar connection:', updateError);
      } else {
        console.log('✅ Microsoft Calendar connection updated successfully');
      }
    } else {
      console.log('✅ Creating new Microsoft Calendar connection...');

      // Deactivate other connections
      await getSupabase()
        .from('calendar_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { error: createError } = await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          provider: 'microsoft',
          provider_account_email: userEmail,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          token_expires_at: expiresOn ? new Date(expiresOn).toISOString() : null,
          is_active: true,
          is_primary: true,
          sync_enabled: true,
          transcription_enabled: false
        });

      if (createError) {
        console.error('Error creating calendar connection:', createError);
      } else {
        console.log('✅ Microsoft Calendar connection created successfully');
      }
    }

    // Set up Microsoft Calendar webhook (for live updates)
    // This is done immediately after connection is created/updated
    try {
      console.log('📡 Setting up Microsoft Calendar webhook...');
      const MicrosoftCalendarService = require('../services/microsoftCalendar');
      const microsoftService = new MicrosoftCalendarService();
      await microsoftService.setupCalendarWatch(user.id);
      console.log('✅ Microsoft Calendar webhook set up successfully');
    } catch (webhookError) {
      console.error('❌ Failed to set up Microsoft Calendar webhook:', webhookError.message);
      // Don't fail the OAuth flow, but log the error
      // The webhook can be set up later via the verify-webhooks endpoint
    }

    // Trigger initial Microsoft Calendar sync (in background)
    try {
      console.log('🔄 Triggering initial Microsoft Calendar sync in background...');
      const calendarSyncService = require('../services/calendarSync');
      // Don't await - let it run in background
      calendarSyncService.syncUserCalendar(user.id, { timeRange: 'extended', includeDeleted: true }).then(syncResult => {
        console.log('✅ Initial Microsoft Calendar sync completed:', syncResult);
      }).catch(syncError => {
        console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
      });
    } catch (syncError) {
      console.warn('⚠️  Failed to start background sync:', syncError.message);
      // Don't fail the connection if sync fails
    }

    // Generate JWT and redirect to frontend
    console.log('✅ Generating JWT and redirecting to /auth/callback');
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (error) {
    console.error('Microsoft auth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// Verify token and return user info
router.get('/verify', authenticateSupabaseUser, async (req, res) => {
    try {
        // Check if Supabase is available
        if (!isSupabaseAvailable()) {
            return res.status(503).json({
                error: 'Database service unavailable. Please contact support.'
            });
        }

        const userId = req.user.id;
        const { data: user } = await req.supabase
            .from('users')
            .select('id, email, name, profilepicture, business_name')
            .eq('id', userId)
            .single();

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        provider: 'local',
        providerid: email
      })
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Registration failed' });
    }

    res.json({ message: 'User registered', user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // For now, basic auth is not implemented with Supabase
    // This is a placeholder for future implementation
    res.status(501).json({ error: 'Basic auth not implemented. Please use Google OAuth.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================================
// ONBOARDING ENDPOINTS
// ============================================================================

/**
 * GET /api/auth/onboarding/status
 * Get the current user's onboarding status
 */
router.get('/onboarding/status', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error } = await req.supabase
      .from('users')
      .select('onboarding_completed, onboarding_step, business_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching onboarding status:', error);
      return res.status(500).json({ error: 'Failed to fetch onboarding status' });
    }

    res.json({
      onboarding_completed: user.onboarding_completed || false,
      onboarding_step: user.onboarding_step || 0,
      business_name: user.business_name
    });
  } catch (error) {
    console.error('Error in GET /onboarding/status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/onboarding/step
 * Update the current user's onboarding step
 */
router.put('/onboarding/step', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { step } = req.body;

    if (typeof step !== 'number' || step < 0) {
      return res.status(400).json({ error: 'Invalid step number' });
    }

    const { data: user, error } = await req.supabase
      .from('users')
      .update({
        onboarding_step: step,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating onboarding step:', error);
      return res.status(500).json({ error: 'Failed to update onboarding step' });
    }

    res.json({
      onboarding_step: user.onboarding_step,
      message: 'Onboarding step updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /onboarding/step:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/onboarding/business-profile
 * Save business profile information during onboarding
 */
router.post('/onboarding/business-profile', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_name, business_type, team_size, timezone } = req.body;

    if (!business_name) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Update user's business info
    const { error: userError } = await req.supabase
      .from('users')
      .update({
        business_name,
        timezone: timezone || 'UTC',
        // onboarding_completed will be set by /onboarding/complete at the end
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating user business info:', userError);
      return res.status(500).json({ error: 'Failed to save business profile' });
    }

    console.log(`✅ Business profile saved for user ${userId}`);

    res.json({
      success: true,
      message: 'Business profile saved successfully'
    });
  } catch (error) {
    console.error('Error in POST /onboarding/business-profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/onboarding/complete
 * Mark onboarding as complete
 * ✅ SECURITY FIX: Verify user has active subscription or trial before completing
 */
router.post('/onboarding/complete', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // ✅ CRITICAL: Verify user has active subscription or trial
    const { data: subscription, error: subError } = await req.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      // PGRST116 is "not found" - other errors are real problems
      console.error('Error checking subscription:', subError);
      return res.status(500).json({ error: 'Failed to verify subscription' });
    }

    // Check if subscription exists and is active
    if (!subscription) {
      console.warn(`⚠️  User ${userId} attempted to complete onboarding without subscription`);
      return res.status(403).json({
        error: 'Subscription required',
        message: 'Please complete your subscription before finishing onboarding'
      });
    }

    // Check subscription status
    const validStatuses = ['active', 'trialing'];
    if (!validStatuses.includes(subscription.status)) {
      console.warn(`⚠️  User ${userId} has invalid subscription status: ${subscription.status}`);
      return res.status(403).json({
        error: 'Invalid subscription status',
        message: 'Your subscription is not active. Please renew your subscription.'
      });
    }

    // Check if trial has expired
    if (subscription.status === 'trialing' && subscription.trial_ends_at) {
      const trialEndDate = new Date(subscription.trial_ends_at);
      if (trialEndDate < new Date()) {
        console.warn(`⚠️  User ${userId} trial has expired`);
        return res.status(403).json({
          error: 'Trial expired',
          message: 'Your trial has expired. Please upgrade to continue.'
        });
      }
    }

    console.log(`✅ Verified subscription for user ${userId}: status=${subscription.status}`);

    // ✅ Only now mark onboarding as complete
    const { error } = await req.supabase
      .from('users')
      .update({
        onboarding_completed: true,
        onboarding_step: 7, // Final step (after subscription)
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error completing onboarding:', error);
      return res.status(500).json({ error: 'Failed to complete onboarding' });
    }

    console.log(`✅ User ${userId} completed onboarding with active subscription`);

    // Trigger calendar sync and webhook setup now that onboarding is complete
    try {
      console.log('🔄 Setting up calendar webhooks and sync after onboarding completion...');

      // Check which calendar provider the user has connected
      const { data: calendarConnection } = await req.supabase
        .from('calendar_connections')
        .select('provider')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (calendarConnection) {
        const provider = calendarConnection.provider;
        console.log(`📅 User has ${provider} calendar connected`);

        // Set up webhook based on provider
        if (provider === 'google') {
          try {
            console.log('📡 Setting up Google Calendar webhook...');
            const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
            const webhookService = new GoogleCalendarWebhookService();

            // ✅ FIX: Await webhook creation to ensure it completes successfully
            await webhookService.setupCalendarWatch(userId);
            console.log('✅ Google Calendar webhook created successfully');
          } catch (webhookErr) {
            console.error('❌ Failed to set up Google webhook:', webhookErr.message);
            // Don't fail onboarding, but log the error prominently
          }
        } else if (provider === 'microsoft') {
          try {
            console.log('📡 Setting up Microsoft Calendar webhook...');
            const MicrosoftCalendarService = require('../services/microsoftCalendar');
            const microsoftService = new MicrosoftCalendarService();

            // ✅ FIX: Await webhook creation to ensure it completes successfully
            await microsoftService.setupCalendarWatch(userId);
            console.log('✅ Microsoft Calendar webhook created successfully');
          } catch (webhookErr) {
            console.error('❌ Failed to set up Microsoft webhook:', webhookErr.message);
            // Don't fail onboarding, but log the error prominently
          }
        }
      }

      // Trigger calendar sync
      console.log('🔄 Triggering calendar sync...');
      const calendarSyncService = require('../services/calendarSync');

      // Don't await - let it run in background
      calendarSyncService.syncUserCalendar(userId, {
        timeRange: 'extended',
        includeDeleted: true
      }).then(syncResult => {
        console.log('✅ Calendar sync completed after onboarding:', syncResult);
      }).catch(syncErr => {
        console.warn('⚠️ Calendar sync failed after onboarding (non-fatal):', syncErr.message);
      });
    } catch (syncErr) {
      console.warn('⚠️ Failed to start calendar sync after onboarding:', syncErr.message);
      // Don't fail onboarding completion if sync fails
    }

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Error in POST /onboarding/complete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/onboarding/skip-calendar
 * Skip calendar connection during onboarding
 * DEPRECATED: Calendar is now auto-connected during Google OAuth login
 */
router.post('/onboarding/skip-calendar', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Move to final step (skipping calendar connection)
    const { error } = await req.supabase
      .from('users')
      .update({
        onboarding_step: 3, // Move to initial sync step (step 3 in new flow)
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error skipping calendar:', error);
      return res.status(500).json({ error: 'Failed to skip calendar connection' });
    }

    res.json({
      success: true,
      message: 'Calendar connection skipped'
    });
  } catch (error) {
    console.error('Error in POST /onboarding/skip-calendar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/auto-connect-calendar
 * Automatically create calendar connection from Supabase Auth session
 * This is called after Google OAuth login to extract calendar tokens
 */
router.post('/auto-connect-calendar', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log(`📅 Auto-connecting Google Calendar for user: ${userEmail}`);

    // Get the user's Supabase Auth session to extract provider tokens
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No auth token provided' });
    }

    // Verify the token and get the full session data
    const { data: { user: authUser }, error: authError } = await req.supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Error getting auth user:', authError);
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    // Check if user signed in with Google (provider_token contains the Google access token)
    const providerToken = authUser.app_metadata?.provider_token;
    const providerRefreshToken = authUser.app_metadata?.provider_refresh_token;

    if (!providerToken) {
      console.log('⚠️ No provider token found in app_metadata');
      console.log('ℹ️ This may occur when switching calendars or if user did not sign in with Google');

      return res.json({
        success: false,
        message: 'Cannot auto-connect Google Calendar. Please use the manual connection flow in Settings.',
        reason: 'provider_token_not_available'
      });
    }

    console.log('✅ Found Google provider token in Supabase Auth session');

    // Get user's tenant_id (optional - for backwards compatibility with pre-multi-tenant users)
    const { data: userData, error: userError } = await req.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error getting user data:', userError);
      return res.status(500).json({
        error: 'Failed to fetch user data'
      });
    }

    const tenantId = userData?.tenant_id || null; // Allow null for backwards compatibility

    // Check if calendar connection already exists
    const { data: existingConnection } = await req.supabase
      .from('calendar_connections')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('provider_account_email', userEmail)
      .single();

    if (existingConnection) {
      console.log('✅ Calendar connection already exists, updating tokens...');

      // Update existing connection
      const { error: updateError } = await req.supabase
        .from('calendar_connections')
        .update({
          access_token: providerToken,
          refresh_token: providerRefreshToken || null,
          is_active: true,
          sync_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating calendar connection:', updateError);
        return res.status(500).json({ error: 'Failed to update calendar connection' });
      }

      return res.json({
        success: true,
        message: 'Google Calendar connection updated',
        connection_id: existingConnection.id
      });
    }

    // Deactivate all other active connections (single active per user)
    console.log('🔄 Deactivating other active calendar connections...');
    const { error: deactivateError } = await req.supabase
      .from('calendar_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      console.warn('Warning: Could not deactivate other connections:', deactivateError);
    } else {
      console.log('✅ Other connections deactivated');
    }

    // Create new calendar connection
    const { data: newConnection, error: createError } = await req.supabase
      .from('calendar_connections')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        provider: 'google',
        provider_account_email: userEmail,
        access_token: providerToken,
        refresh_token: providerRefreshToken || null,
        is_primary: true, // First calendar connection is primary
        is_active: true,
        sync_enabled: true,
        transcription_enabled: false // Transcription disabled by default - user must opt-in
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating calendar connection:', createError);
      return res.status(500).json({
        error: 'Failed to create calendar connection',
        details: createError.message
      });
    }

    console.log(`✅ Google Calendar auto-connected successfully: ${newConnection.id}`);

    res.json({
      success: true,
      message: 'Google Calendar connected automatically',
      connection_id: newConnection.id
    });

  } catch (error) {
    console.error('Error in POST /auto-connect-calendar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;