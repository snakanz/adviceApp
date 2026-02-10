const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

// In-memory store for OAuth state tokens (for CSRF protection)
// In production, consider using Redis for multi-instance deployments
const oauthStateStore = new Map();

// Clean up expired state tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.timestamp > maxAge) {
      oauthStateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Microsoft Azure AD error codes that require special handling
// See: https://learn.microsoft.com/en-us/azure/active-directory/develop/reference-aadsts-error-codes
const AADSTS_ERROR_MAP = {
  'AADSTS65001': {
    type: 'admin_consent_required',
    message: 'Your organization requires IT administrator approval before you can connect your calendar.',
    showAdminUrl: true,
    userAction: 'Please share the admin approval link with your IT team.'
  },
  'AADSTS700016': {
    type: 'app_not_found_in_tenant',
    message: 'This application is not available in your organization.',
    showAdminUrl: true,
    userAction: 'Your IT admin needs to add this application to your organization.'
  },
  'AADSTS50105': {
    type: 'user_not_assigned',
    message: 'You have not been granted access to this application.',
    showAdminUrl: false,
    userAction: 'Please contact your IT administrator to request access.'
  },
  'AADSTS90094': {
    type: 'admin_consent_required',
    message: 'Administrator consent is required for the permissions this app needs.',
    showAdminUrl: true,
    userAction: 'Please share the admin approval link with your IT team.'
  },
  'AADSTS650052': {
    type: 'app_needs_permissions',
    message: 'The app needs access to resources in your organization that only an admin can grant.',
    showAdminUrl: true,
    userAction: 'Please share the admin approval link with your IT team.'
  },
  'AADSTS70011': {
    type: 'invalid_scope',
    message: 'The requested permissions are invalid or not supported.',
    showAdminUrl: false,
    userAction: 'Please try again or contact support.'
  }
};

// Helper to detect AADSTS error codes from Microsoft OAuth error
function parseAadtsError(errorCode, errorDescription) {
  // Check if error description contains an AADSTS code
  const aadtsMatch = errorDescription?.match(/AADSTS(\d+)/);
  if (aadtsMatch) {
    const fullCode = `AADSTS${aadtsMatch[1]}`;
    return AADSTS_ERROR_MAP[fullCode] || null;
  }

  // Also check the error code itself
  if (errorCode && AADSTS_ERROR_MAP[errorCode]) {
    return AADSTS_ERROR_MAP[errorCode];
  }

  // Check for common OAuth error types that indicate admin consent
  // Microsoft returns various messages when consent is denied or required
  if (errorCode === 'access_denied') {
    const desc = (errorDescription || '').toLowerCase();

    // Check for phrases that indicate admin consent is needed
    const adminConsentIndicators = [
      'admin',
      'administrator',
      'consent',
      'approval',
      'not consented',
      'requires approval',
      'organization',
      'tenant'
    ];

    // If the description mentions any consent-related phrase, treat as admin consent required
    if (adminConsentIndicators.some(phrase => desc.includes(phrase))) {
      return AADSTS_ERROR_MAP['AADSTS65001'];
    }

    // Even if no specific phrase, "access_denied" from Microsoft during OAuth
    // often means consent was denied - treat it as admin consent required
    // so users get the helpful admin consent flow UI
    console.log('⚠️ access_denied with no recognized consent phrase, treating as admin consent required');
    console.log('   Error description:', errorDescription);
    return AADSTS_ERROR_MAP['AADSTS65001'];
  }

  if (errorCode === 'consent_required') {
    return AADSTS_ERROR_MAP['AADSTS65001'];
  }

  return null;
}

// Generate admin consent URL for Microsoft
function generateAdminConsentUrl(tenantId = 'common') {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.BACKEND_URL}/api/auth/microsoft/callback`;

  // Admin consent endpoint - IT admins use this to approve the app for the entire organization
  return `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

// Get Google OAuth URL
router.get('/google', authenticateSupabaseUser, (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  // Check if this is during onboarding (query parameter from frontend)
  const isOnboarding = req.query.onboarding === 'true';

  // Generate a cryptographically secure nonce for CSRF protection
  const nonce = crypto.randomBytes(32).toString('hex');

  // Store the state data with the nonce as the key
  const stateData = {
    user_id: req.user?.id || null,
    onboarding: isOnboarding,
    timestamp: Date.now()
  };
  oauthStateStore.set(nonce, stateData);

  // The state parameter contains only the nonce (the actual data is stored server-side)
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: nonce // Cryptographic nonce for CSRF protection
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
    console.log('  - state:', state ? '✅ Present' : '❌ Missing');

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=database_unavailable`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=missing_code`);
    }

    // Validate the state parameter (CSRF protection)
    // The state is a nonce that maps to stored session data
    let authenticatedUserId = null;
    let isOnboarding = false;

    if (state) {
      const stateData = oauthStateStore.get(state);
      if (stateData) {
        // Valid state - retrieve the stored data
        authenticatedUserId = stateData.user_id;
        isOnboarding = stateData.onboarding === true;
        console.log('📅 Authenticated user ID from state:', authenticatedUserId);
        console.log('📅 Is onboarding:', isOnboarding);

        // Delete the nonce after use (one-time use)
        oauthStateStore.delete(state);
      } else {
        // State not found - could be expired or invalid (potential CSRF attack)
        console.warn('⚠️ Invalid or expired state parameter - possible CSRF attempt');
        // For backwards compatibility, try parsing as JSON (old format)
        try {
          const parsedState = JSON.parse(state);
          authenticatedUserId = parsedState.user_id;
          isOnboarding = parsedState.onboarding === true;
          console.log('📅 Using legacy state format (JSON)');
        } catch (e) {
          console.warn('⚠️ Could not parse state parameter:', e);
        }
      }
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    console.log('📅 Google OAuth callback - Google account:', userInfo.data.email);
    console.log('📅 Google tokens received - Access token:', tokens.access_token ? 'yes' : 'no', 'Refresh token:', tokens.refresh_token ? 'yes' : 'no');

    // ✅ CRITICAL: Verify the user actually granted calendar permissions
    // If they didn't click "Allow" on the calendar scope, the tokens won't have calendar access
    try {
      console.log('🔍 Verifying Google Calendar permissions...');
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Try to list calendars - this will fail if calendar permission wasn't granted
      const calendarList = await calendar.calendarList.list({ maxResults: 1 });

      if (!calendarList.data || !calendarList.data.items) {
        throw new Error('No calendar access');
      }

      console.log('✅ Google Calendar permissions verified - found', calendarList.data.items.length, 'calendar(s)');
    } catch (calendarError) {
      console.error('❌ Google Calendar permission verification failed:', calendarError.message);

      // Redirect with error - user didn't grant calendar permissions
      const errorMessage = encodeURIComponent('Calendar access not granted. Please click "Allow" on the Google permissions screen to connect your calendar.');
      const redirectUrl = isOnboarding
        ? `${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&onboarding=true&provider=google`
        : `${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&provider=google`;

      return res.redirect(redirectUrl);
    }

    // **FIX**: Use the authenticated user ID from state parameter (for calendar connection during onboarding)
    // If state contains a user_id, this is a calendar connection for an existing logged-in user
    // Otherwise, this is a new user signup via Google OAuth
    let user;
    let tenantId;

    if (authenticatedUserId) {
      // Calendar connection for existing user - use the authenticated user from state
      console.log('📅 Linking calendar to existing authenticated user:', authenticatedUserId);
      const { data: existingUser, error: findError } = await getSupabase()
        .from('users')
        .select('*')
        .eq('id', authenticatedUserId)
        .single();

      if (findError || !existingUser) {
        // User not found in users table - this can happen during email/password signup
        // when the auth.users record exists but the public users record hasn't been created yet
        console.log('⚠️ User not found in users table, attempting to create from auth.users:', authenticatedUserId);

        // Try to get the user from Supabase Auth and create their users record
        const { data: authUsers, error: authError } = await getSupabase().auth.admin.listUsers();

        if (authError) {
          console.error('❌ Error fetching auth users:', authError);
          throw new Error('Authenticated user not found');
        }

        const authUser = authUsers.users.find(u => u.id === authenticatedUserId);

        if (!authUser) {
          console.error('❌ Could not find user in auth.users:', authenticatedUserId);
          throw new Error('Authenticated user not found');
        }

        console.log('✅ Found user in auth.users:', authUser.email);

        // Create the user record using UserService
        const UserService = require('../services/userService');
        user = await UserService.getOrCreateUser({
          id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata
        });

        tenantId = user.tenant_id;
        console.log('✅ Created user record for:', user.email);
      } else {
        user = existingUser;
        tenantId = user.tenant_id;
        console.log('✅ Found authenticated user:', user.email);
      }
    } else {
      // New user signup via Google OAuth - create/find user by email
      console.log('📅 New user signup or login via Google OAuth');
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
      user = await UserService.getOrCreateUser(supabaseUser);
      tenantId = user.tenant_id;
    }

    // Ensure user has a tenant (UserService should have created one, but double-check)
    if (!tenantId) {
      const UserService = require('../services/userService');
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
          transcription_enabled: true // Enabled by default for better UX - users can disable in settings
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

    // **FIX**: Redirect based on whether this is onboarding or post-login calendar connection
    if (authenticatedUserId && !isOnboarding) {
      // Post-login calendar connection from Settings → redirect back to Settings
      console.log('✅ Google Calendar connected from Settings - redirecting to Settings');
      res.redirect(`${process.env.FRONTEND_URL}/settings?calendar_connected=google`);
    } else {
      // Onboarding calendar connection OR new user signup → redirect to auth/callback with onboarding flag
      console.log('✅ Google Calendar connected during onboarding - redirecting to /auth/callback');
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true&provider=google&onboarding=true`);
    }
  } catch (error) {
    console.error('❌ Google auth error:', error);
    // **FIX**: Include error details and preserve onboarding context
    const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&provider=google&onboarding=true`);
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

router.get('/microsoft', authenticateSupabaseUser, async (req, res) => {
  try {
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    if (!microsoftService.isConfigured()) {
      return res.status(400).json({
        error: 'Microsoft OAuth not configured',
        message: 'Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables'
      });
    }

    // Check if this is during onboarding (query parameter from frontend)
    const isOnboarding = req.query.onboarding === 'true';

    console.log('🔗 Generating Microsoft OAuth URL...');
    console.log('  - Redirect URI:', microsoftService.redirectUri);
    console.log('  - Is onboarding:', isOnboarding);
    console.log('  - User ID:', req.user?.id || 'none');

    // Let MSAL generate the URL (and its own state parameter)
    const url = await microsoftService.getAuthorizationUrl();

    // Extract MSAL's generated state from the URL and store our app context against it.
    // This ensures the callback can look up user_id/onboarding using the exact state
    // value that Microsoft will return.
    const msalState = new URL(url).searchParams.get('state');
    if (msalState) {
      const stateData = {
        user_id: req.user?.id || null,
        onboarding: isOnboarding,
        timestamp: Date.now()
      };
      oauthStateStore.set(msalState, stateData);
    }

    console.log('✅ Microsoft OAuth URL generated successfully');
    console.log('  - URL length:', url.length);
    console.log('  - State extracted:', msalState ? 'yes' : 'no');

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

/**
 * GET /api/auth/microsoft/admin-consent-url
 * Get the admin consent URL for IT administrators to approve the app
 *
 * This endpoint returns the URL that users can share with their IT team
 * to request admin consent for the application in their organization.
 */
router.get('/microsoft/admin-consent-url', authenticateSupabaseUser, async (req, res) => {
  try {
    const MicrosoftCalendarService = require('../services/microsoftCalendar');
    const microsoftService = new MicrosoftCalendarService();

    if (!microsoftService.isConfigured()) {
      return res.status(400).json({
        error: 'Microsoft OAuth not configured',
        message: 'Microsoft Calendar integration is not available'
      });
    }

    // Get tenant ID from query if provided (for organization-specific consent)
    // Default to 'common' which works for any organization
    const tenantId = req.query.tenant_id || 'common';

    const adminConsentUrl = generateAdminConsentUrl(tenantId);

    // Generate email template for users to send to IT
    const emailTemplate = {
      subject: 'Please approve Advicly for Microsoft 365',
      body: `Hi IT Team,

I'm trying to use Advicly to manage my client meetings. It needs access to my Microsoft calendar, but requires administrator approval for our organization.

Could you please approve the app using this link?
${adminConsentUrl}

The app only needs to read calendar events - it won't modify or delete anything.

Permissions requested:
- Read calendar events (Calendars.Read)
- Read user profile (User.Read)
- Offline access for background sync

Thank you!`
    };

    res.json({
      success: true,
      admin_consent_url: adminConsentUrl,
      email_template: emailTemplate,
      instructions: [
        '1. Share this link with your IT administrator',
        '2. The admin will sign in and approve the app for your organization',
        '3. After approval, return here and click "Try Again" to connect your calendar'
      ]
    });

  } catch (error) {
    console.error('Error generating admin consent URL:', error);
    res.status(500).json({
      error: 'Failed to generate admin consent URL',
      message: error.message
    });
  }
});

// Handle Microsoft OAuth callback
router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description: errorDescription } = req.query;

    // Log with timestamp and all request details
    const timestamp = new Date().toISOString();
    console.log('='.repeat(80));
    console.log(`📅 MICROSOFT CALLBACK HIT - ${timestamp}`);
    console.log('='.repeat(80));
    console.log('  - code:', code ? '✅ Present' : '❌ Missing');
    console.log('  - Full query params:', JSON.stringify(req.query));
    console.log('  - error:', oauthError || 'none');
    console.log('  - error_description:', errorDescription || 'none');
    console.log('='.repeat(80));

    // ✅ NEW: Check for Microsoft OAuth errors (AADSTS codes) FIRST
    // This catches admin consent required, app blocked, etc.
    if (oauthError) {
      console.log('🔒 Microsoft OAuth error detected:', oauthError);
      console.log('   Description:', errorDescription);

      // Parse for specific AADSTS error codes
      const aadtsError = parseAadtsError(oauthError, errorDescription);

      if (aadtsError) {
        console.log('🔒 Identified AADSTS error type:', aadtsError.type);
        console.log('   showAdminUrl:', aadtsError.showAdminUrl);

        // Generate admin consent URL if needed
        const adminConsentUrl = aadtsError.showAdminUrl ? generateAdminConsentUrl() : null;
        console.log('   Generated admin consent URL:', adminConsentUrl ? 'YES' : 'NO');

        // Get user ID from state to save pending consent status
        let authenticatedUserId = null;
        let isOnboarding = false;
        if (state) {
          const stateData = oauthStateStore.get(state);
          if (stateData) {
            authenticatedUserId = stateData.user_id;
            isOnboarding = stateData.onboarding === true;
            oauthStateStore.delete(state);
          }
        }

        // Save pending admin consent status to database if we have a user ID
        if (authenticatedUserId && aadtsError.type === 'admin_consent_required') {
          try {
            console.log('💾 Saving pending admin consent status for user:', authenticatedUserId);

            // Check if a Microsoft connection already exists
            const { data: existingConn } = await getSupabase()
              .from('calendar_connections')
              .select('id')
              .eq('user_id', authenticatedUserId)
              .eq('provider', 'microsoft')
              .maybeSingle();

            if (existingConn) {
              // Update existing connection with pending status
              await getSupabase()
                .from('calendar_connections')
                .update({
                  pending_admin_consent: true,
                  admin_consent_requested_at: new Date().toISOString(),
                  admin_consent_error: aadtsError.message,
                  admin_consent_error_type: aadtsError.type,
                  is_active: false,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingConn.id);

              console.log('✅ Updated existing connection with pending admin consent status');
            } else {
              // Get user's tenant_id
              const { data: userData } = await getSupabase()
                .from('users')
                .select('tenant_id')
                .eq('id', authenticatedUserId)
                .single();

              if (userData?.tenant_id) {
                // Create new connection record with pending status
                await getSupabase()
                  .from('calendar_connections')
                  .insert({
                    user_id: authenticatedUserId,
                    tenant_id: userData.tenant_id,
                    provider: 'microsoft',
                    pending_admin_consent: true,
                    admin_consent_requested_at: new Date().toISOString(),
                    admin_consent_error: aadtsError.message,
                    admin_consent_error_type: aadtsError.type,
                    is_active: false
                  });

                console.log('✅ Created new connection with pending admin consent status');
              }
            }
          } catch (dbError) {
            console.error('⚠️ Failed to save pending admin consent status:', dbError.message);
            // Don't fail the redirect - this is just for UX improvement
          }
        }

        // Build error parameters for frontend
        const errorParams = new URLSearchParams({
          error: aadtsError.message,
          error_type: aadtsError.type,
          provider: 'microsoft',
          user_action: aadtsError.userAction
        });

        if (adminConsentUrl) {
          errorParams.append('admin_consent_url', adminConsentUrl);
        }

        if (isOnboarding) {
          errorParams.append('onboarding', 'true');
        }

        const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?${errorParams.toString()}`;
        console.log('🔒 Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
      }

      // Generic OAuth error (not a specific AADSTS code we recognize)
      const genericErrorMessage = errorDescription || oauthError || 'Microsoft authorization failed';

      // Check onboarding state
      let isOnboarding = false;
      if (state) {
        const stateData = oauthStateStore.get(state);
        if (stateData) {
          isOnboarding = stateData.onboarding === true;
          oauthStateStore.delete(state);
        }
      }

      const errorParams = new URLSearchParams({
        error: genericErrorMessage,
        error_type: 'oauth_error',
        provider: 'microsoft'
      });

      if (isOnboarding) {
        errorParams.append('onboarding', 'true');
      }

      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${errorParams.toString()}`);
    }

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
    const microsoftEmail = userInfo.mail || userInfo.userPrincipalName;

    console.log('📅 Microsoft OAuth callback - Microsoft account:', microsoftEmail);
    console.log('📅 Microsoft tokens received - Access token:', accessToken ? 'yes' : 'no', 'Refresh token:', refreshToken ? 'yes' : 'no');

    // ✅ CRITICAL: Verify the user actually granted calendar permissions
    // If they didn't click "Allow" on the calendar scope, the tokens won't have calendar access
    try {
      console.log('🔍 Verifying Microsoft Calendar permissions...');

      // Try to access the user's calendar - this will fail if calendar permission wasn't granted
      // Using fetch to make a direct Graph API call
      const calendarResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!calendarResponse.ok) {
        const errorData = await calendarResponse.json().catch(() => ({}));
        console.error('❌ Calendar access check failed:', calendarResponse.status, errorData);
        throw new Error('No calendar access');
      }

      const calendarData = await calendarResponse.json();
      if (!calendarData.value || calendarData.value.length === 0) {
        throw new Error('No calendars found');
      }

      console.log('✅ Microsoft Calendar permissions verified - found', calendarData.value.length, 'calendar(s)');
    } catch (calendarError) {
      console.error('❌ Microsoft Calendar permission verification failed:', calendarError.message);

      // Parse state to check if onboarding (need to do this before the main state parsing below)
      let isOnboardingForError = false;
      if (state) {
        const stateData = oauthStateStore.get(state);
        if (stateData) {
          isOnboardingForError = stateData.onboarding === true;
          oauthStateStore.delete(state); // Clean up the nonce
        }
      }

      // Redirect with error - user didn't grant calendar permissions
      const errorMessage = encodeURIComponent('Calendar access not granted. Please click "Allow" on the Microsoft permissions screen to connect your calendar.');
      const redirectUrl = isOnboardingForError
        ? `${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&onboarding=true&provider=microsoft`
        : `${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&provider=microsoft`;

      return res.redirect(redirectUrl);
    }

    // Validate the state parameter (CSRF protection)
    // The state is a nonce that maps to stored session data
    let authenticatedUserId = null;
    let isOnboarding = false;

    if (state) {
      const stateData = oauthStateStore.get(state);
      if (stateData) {
        // Valid state - retrieve the stored data
        authenticatedUserId = stateData.user_id;
        isOnboarding = stateData.onboarding === true;
        console.log('📅 Authenticated user ID from state:', authenticatedUserId);
        console.log('📅 Is onboarding:', isOnboarding);

        // Delete the nonce after use (one-time use)
        oauthStateStore.delete(state);
      } else {
        // State not found - could be expired or invalid (potential CSRF attack)
        console.warn('⚠️ Invalid or expired state parameter - possible CSRF attempt');
        // For backwards compatibility, try parsing as JSON (old format)
        try {
          const parsedState = JSON.parse(state);
          authenticatedUserId = parsedState.user_id;
          isOnboarding = parsedState.onboarding === true;
          console.log('📅 Using legacy state format (JSON)');
        } catch (e) {
          console.warn('⚠️ Could not parse state parameter:', e);
        }
      }
    }

    // Use the authenticated user ID from state parameter (for calendar connection during onboarding)
    // If state contains a user_id, this is a calendar connection for an existing logged-in user
    // Otherwise, this is a new user signup via Microsoft OAuth (not currently supported)
    let user;
    let tenantId;

    if (authenticatedUserId) {
      // Calendar connection for existing user - use the authenticated user from state
      console.log('📅 Linking Microsoft calendar to existing authenticated user:', authenticatedUserId);
      const { data: existingUser, error: findError } = await getSupabase()
        .from('users')
        .select('*')
        .eq('id', authenticatedUserId)
        .single();

      // Log what we found
      console.log('👤 Microsoft callback user lookup:', {
        authenticatedUserId,
        found: !!existingUser,
        errorCode: findError?.code,
        errorMessage: findError?.message
      });

      if (findError || !existingUser) {
        // User not found in users table - this can happen during email/password signup
        // when the auth.users record exists but the public users record hasn't been created yet
        console.log('⚠️ User not found in users table, attempting to create from auth.users:', authenticatedUserId);

        // Try to get the user from Supabase Auth and create their users record
        const { data: authUsers, error: authError } = await getSupabase().auth.admin.listUsers();

        if (authError) {
          console.error('❌ Error fetching auth users:', authError);
          throw new Error('Authenticated user not found');
        }

        const authUser = authUsers.users.find(u => u.id === authenticatedUserId);

        if (!authUser) {
          console.error('❌ Could not find user in auth.users:', authenticatedUserId);
          throw new Error('Authenticated user not found');
        }

        console.log('✅ Found user in auth.users:', authUser.email);

        // Create the user record using UserService
        const UserService = require('../services/userService');
        user = await UserService.getOrCreateUser({
          id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata
        });

        tenantId = user.tenant_id;
        console.log('✅ Created user record for:', user.email);
      } else {
        user = existingUser;
        tenantId = user.tenant_id;
        console.log('✅ Found authenticated user:', user.email);
      }
    } else {
      // No authenticated user - try to find by Microsoft email
      console.log('📅 No authenticated user in state, looking up by Microsoft email:', microsoftEmail);
      const { data: existingUser, error: findError } = await getSupabase()
        .from('users')
        .select('*')
        .eq('email', microsoftEmail)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding user:', findError);
        throw new Error('Database error while finding user');
      }

      if (existingUser) {
        user = existingUser;
        tenantId = user.tenant_id;
        console.log('✅ Found existing user by Microsoft email:', user.email);
      } else {
        // No existing user found - Microsoft OAuth signup not supported for new users
        // They should sign up with email/password or Google first
        console.error('❌ No existing user found for Microsoft email:', microsoftEmail);
        throw new Error('Please sign up first before connecting Microsoft Calendar');
      }
    }

    // Ensure user has a tenant
    if (!tenantId) {
      const UserService = require('../services/userService');
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
      .eq('provider_account_email', microsoftEmail)
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

      const { data: newConnection, error: createError } = await getSupabase()
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          provider: 'microsoft',
          provider_account_email: microsoftEmail,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          token_expires_at: expiresOn ? new Date(expiresOn).toISOString() : null,
          is_active: true,
          is_primary: true,
          sync_enabled: true,
          transcription_enabled: true // Enabled by default for better UX - users can disable in settings
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating calendar connection:', createError);
        console.error('Error details:', { code: createError.code, message: createError.message, details: createError.details, hint: createError.hint });
        // This is a critical failure - throw to redirect with error
        throw new Error(`Failed to save calendar connection: ${createError.message}`);
      } else {
        console.log('✅ Microsoft Calendar connection created successfully:', newConnection?.id);
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

    // Redirect based on whether this is onboarding or post-login calendar connection
    // (isOnboarding was already parsed from state earlier in the callback)
    if (isOnboarding) {
      // Onboarding calendar connection → redirect to auth/callback with onboarding flag
      console.log('✅ Microsoft Calendar connected during onboarding - redirecting to /auth/callback');
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true&provider=microsoft&onboarding=true`);
    } else {
      // Post-login calendar connection from Settings → redirect back to Settings
      console.log('✅ Microsoft Calendar connected from Settings - redirecting to Settings');
      res.redirect(`${process.env.FRONTEND_URL}/settings?calendar_connected=microsoft`);
    }
  } catch (error) {
    console.error('❌ Microsoft auth error:', error);
    const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${errorMessage}&provider=microsoft&onboarding=true`);
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

    // CRITICAL FIX: Use service role client instead of user-scoped client
    // For email/password signup users, the user record may not exist yet in public.users
    // and RLS policies could block reads for newly created users
    const { data: user, error } = await getSupabase()
      .from('users')
      .select('onboarding_completed, onboarding_step, business_name')
      .eq('id', userId)
      .single();

    if (error) {
      // Check if user doesn't exist in users table (PGRST116 = not found)
      if (error.code === 'PGRST116') {
        console.log('⚠️ User not found in users table, creating from req.user:', userId);

        // Create the user record using info from JWT token (already available in req.user)
        try {
          const UserService = require('../services/userService');

          // Use req.user which already has the authenticated user's info from the JWT
          const newUser = await UserService.getOrCreateUser({
            id: req.user.id,
            email: req.user.email,
            user_metadata: {
              full_name: req.user.name || req.user.email.split('@')[0]
            },
            app_metadata: {
              provider: req.user.provider || 'email'
            }
          });

          console.log('✅ Created user record for:', newUser.email);

          // Return default onboarding status for new user
          return res.json({
            onboarding_completed: false,
            onboarding_step: 0,
            business_name: newUser.business_name || null
          });
        } catch (createError) {
          console.error('❌ Error creating user record:', createError);
          return res.status(500).json({ error: 'Failed to create user record', details: createError.message });
        }
      }

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

    console.log('=== ONBOARDING STEP UPDATE ===');
    console.log('User ID:', userId);
    console.log('Email:', req.user.email);
    console.log('Step:', step);
    console.log('Timestamp:', new Date().toISOString());

    if (typeof step !== 'number' || step < 0) {
      return res.status(400).json({ error: 'Invalid step number' });
    }

    // First check if user exists - use service role client to bypass RLS
    const { data: existingUser, error: checkError } = await getSupabase()
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Log what we found
    console.log('👤 User check for step update:', {
      userId,
      email: req.user.email,
      found: !!existingUser,
      errorCode: checkError?.code,
      errorMessage: checkError?.message
    });

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        // User doesn't exist - create them first using req.user info from JWT
        console.log('⚠️ User not found in users table for step update, creating:', userId);

        try {
          const UserService = require('../services/userService');

          await UserService.getOrCreateUser({
            id: req.user.id,
            email: req.user.email,
            user_metadata: {
              full_name: req.user.name || req.user.email.split('@')[0]
            },
            app_metadata: {
              provider: req.user.provider || 'email'
            }
          });
          console.log('✅ Created user record before step update');
        } catch (createError) {
          console.error('❌ Error creating user for step update:', createError);
          return res.status(500).json({
            error: 'Failed to create user record',
            details: createError.message
          });
        }
      } else {
        // Some other database error
        console.error('❌ Database error checking user for step update:', checkError);
        return res.status(500).json({
          error: 'Database error checking user',
          details: checkError.message
        });
      }
    }

    // CRITICAL FIX: Use service role client instead of user-scoped client
    // The user-scoped client (req.supabase) uses RLS, which can fail for newly created users
    // because the user record may have just been created moments ago during onboarding
    const { data: user, error } = await getSupabase()
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
      console.error('Error details:', { code: error.code, message: error.message, details: error.details });
      return res.status(500).json({ error: 'Failed to update onboarding step', details: error.message });
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
    // Use service role client to bypass RLS for newly created users
    const { error: userError } = await getSupabase()
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
      console.error('Error details:', { code: userError.code, message: userError.message });
      return res.status(500).json({ error: 'Failed to save business profile', details: userError.message });
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
    // Use service role client to bypass RLS for newly created users
    let { data: subscription, error: subError } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      // PGRST116 is "not found" - other errors are real problems
      console.error('Error checking subscription:', subError);
      return res.status(500).json({ error: 'Failed to verify subscription' });
    }

    // If no subscription exists, create a free tier subscription
    // This is a fallback in case the create-trial call failed earlier
    if (!subscription) {
      console.log(`⚠️ No subscription found for user ${userId}, creating free tier as fallback...`);

      try {
        const { data: newSub, error: createError } = await getSupabase()
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan: 'free',
            status: 'active',
            free_meetings_limit: 5,
            free_meetings_used: 0,
            current_period_start: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating fallback subscription:', createError);
          return res.status(403).json({
            error: 'Subscription required',
            message: 'Could not create subscription. Please try again.'
          });
        }

        subscription = newSub;
        console.log(`✅ Created fallback free subscription for user ${userId}`);
      } catch (fallbackError) {
        console.error('❌ Fallback subscription creation failed:', fallbackError);
        return res.status(403).json({
          error: 'Subscription required',
          message: 'Please complete your subscription before finishing onboarding'
        });
      }
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
    // Use service role client to bypass RLS for newly created users
    const { error } = await getSupabase()
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
      // Use service role client to bypass RLS
      const { data: calendarConnection } = await getSupabase()
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

/**
 * POST /api/auth/risc/events
 * Google Cross-Account Protection (RISC) endpoint
 * Receives security events when a user's Google account is compromised
 *
 * This endpoint handles Security Event Tokens (SETs) from Google's RISC API
 * https://developers.google.com/identity/protocols/risc
 */
router.post('/risc/events', async (req, res) => {
  try {
    console.log('🔐 RISC Event received');
    console.log('  - Headers:', JSON.stringify(req.headers, null, 2));

    // Google sends the event as a JWT in the request body
    const eventToken = req.body;

    if (!eventToken) {
      console.warn('⚠️ RISC: No event token received');
      return res.status(400).json({ error: 'No event token' });
    }

    // For verification requests, Google may send a challenge
    if (req.body.challenge) {
      console.log('✅ RISC: Responding to challenge');
      return res.json({ challenge: req.body.challenge });
    }

    // Parse the Security Event Token (SET)
    // The token is a JWT that should be verified with Google's public keys
    // For now, we'll log the event and take appropriate action

    let decodedEvent;
    try {
      // Decode without verification for logging (in production, verify with Google's keys)
      const parts = typeof eventToken === 'string' ? eventToken.split('.') : null;
      if (parts && parts.length === 3) {
        decodedEvent = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      } else {
        decodedEvent = eventToken;
      }
    } catch (e) {
      decodedEvent = eventToken;
    }

    console.log('🔐 RISC Event details:', JSON.stringify(decodedEvent, null, 2));

    // Handle different event types
    // https://developers.google.com/identity/protocols/risc#supported_event_types
    const events = decodedEvent.events || {};

    for (const [eventType, eventData] of Object.entries(events)) {
      console.log(`🔐 Processing RISC event: ${eventType}`);

      const subject = eventData.subject || decodedEvent.sub;
      const subjectEmail = subject?.email;
      const subjectId = subject?.id || subject?.sub;

      switch (eventType) {
        case 'https://schemas.openid.net/secevent/risc/event-type/account-disabled':
          // User's Google account was disabled
          console.log('⚠️ RISC: Account disabled for:', subjectEmail || subjectId);
          await handleAccountCompromise(subjectEmail, subjectId, 'account_disabled');
          break;

        case 'https://schemas.openid.net/secevent/risc/event-type/account-enabled':
          // User's Google account was re-enabled
          console.log('✅ RISC: Account re-enabled for:', subjectEmail || subjectId);
          break;

        case 'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required':
          // User needs to change credentials (potential compromise)
          console.log('⚠️ RISC: Credential change required for:', subjectEmail || subjectId);
          await handleAccountCompromise(subjectEmail, subjectId, 'credential_change_required');
          break;

        case 'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked':
          // All sessions were revoked
          console.log('⚠️ RISC: Sessions revoked for:', subjectEmail || subjectId);
          await handleAccountCompromise(subjectEmail, subjectId, 'sessions_revoked');
          break;

        case 'https://schemas.openid.net/secevent/risc/event-type/tokens-revoked':
          // OAuth tokens were revoked
          console.log('⚠️ RISC: Tokens revoked for:', subjectEmail || subjectId);
          await handleTokensRevoked(subjectEmail, subjectId);
          break;

        case 'https://schemas.openid.net/secevent/risc/event-type/account-purged':
          // Account was deleted
          console.log('⚠️ RISC: Account purged for:', subjectEmail || subjectId);
          break;

        default:
          console.log('ℹ️ RISC: Unknown event type:', eventType);
      }
    }

    // Always acknowledge receipt
    res.status(202).json({ status: 'accepted' });

  } catch (error) {
    console.error('❌ Error processing RISC event:', error);
    // Still acknowledge to prevent retries
    res.status(202).json({ status: 'accepted', error: 'Processing error' });
  }
});

/**
 * Handle account compromise events
 * Invalidate calendar connections and notify user
 */
async function handleAccountCompromise(email, googleId, reason) {
  try {
    if (!email && !googleId) {
      console.warn('⚠️ Cannot handle account compromise: no email or ID provided');
      return;
    }

    // Find user by email or Google provider ID
    let query = getSupabase().from('users').select('id, email');

    if (email) {
      query = query.eq('email', email);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      console.log('ℹ️ RISC: User not found in our system:', email || googleId);
      return;
    }

    console.log(`🔐 Handling account compromise for user ${user.id} (${user.email}) - reason: ${reason}`);

    // Mark Google calendar connections as requiring re-authentication
    const { error: updateError } = await getSupabase()
      .from('calendar_connections')
      .update({
        is_active: false,
        sync_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (updateError) {
      console.error('❌ Error deactivating calendar connections:', updateError);
    } else {
      console.log('✅ Deactivated Google calendar connections for user:', user.id);
    }

    // TODO: Send email notification to user about the security event
    // TODO: Create audit log entry

  } catch (err) {
    console.error('❌ Error in handleAccountCompromise:', err);
  }
}

/**
 * Handle token revocation events
 * Mark calendar connections as inactive
 */
async function handleTokensRevoked(email, googleId) {
  try {
    if (!email && !googleId) {
      console.warn('⚠️ Cannot handle token revocation: no email or ID provided');
      return;
    }

    // Find user by email
    let query = getSupabase().from('users').select('id, email');

    if (email) {
      query = query.eq('email', email);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      console.log('ℹ️ RISC: User not found for token revocation:', email || googleId);
      return;
    }

    console.log(`🔐 Handling token revocation for user ${user.id} (${user.email})`);

    // Mark Google calendar connections as needing re-authentication
    const { error: updateError } = await getSupabase()
      .from('calendar_connections')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (updateError) {
      console.error('❌ Error clearing calendar tokens:', updateError);
    } else {
      console.log('✅ Cleared Google calendar tokens for user:', user.id);
    }

  } catch (err) {
    console.error('❌ Error in handleTokensRevoked:', err);
  }
}

module.exports = router;