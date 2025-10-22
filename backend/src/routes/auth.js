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

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
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

    let user;
    if (!existingUser) {
      // Create new user
      console.log('Creating new user with data:', {
        id: userInfo.data.id,
        email: userInfo.data.email,
        name: userInfo.data.name,
        provider: 'google',
        providerid: userInfo.data.id
      });

      const { data: newUser, error: createError } = await getSupabase()
        .from('users')
        .insert({
          id: userInfo.data.id,
          email: userInfo.data.email,
          name: userInfo.data.name,
          provider: 'google',
          providerid: userInfo.data.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        throw new Error('Database error while creating user');
      }
      user = newUser;
    } else {
      // Update existing user's profile
      const { data: updatedUser, error: updateError } = await getSupabase()
        .from('users')
        .update({
          name: userInfo.data.name
        })
        .eq('email', userInfo.data.email)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw new Error('Database error while updating user');
      }
      user = updatedUser;
    }

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

        // Setup webhook for automatic sync
        try {
          console.log('📡 Setting up Google Calendar webhook for automatic sync...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();
          await webhookService.setupCalendarWatch(user.id);
          console.log('✅ Webhook setup completed - meetings will sync automatically');

          // Trigger initial sync to fetch existing meetings
          try {
            console.log('🔄 Triggering initial sync to fetch existing meetings...');
            await webhookService.syncCalendarEvents(user.id);
            console.log('✅ Initial sync completed - existing meetings fetched');
          } catch (syncError) {
            console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
            // Don't fail the connection if initial sync fails
          }
        } catch (webhookError) {
          console.warn('⚠️  Webhook setup failed (non-fatal):', webhookError.message);
          // Don't fail the connection if webhook setup fails
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
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          is_active: true
        });

      if (createError) {
        console.error('Error creating calendar connection:', createError);
      } else {
        console.log('✅ Google Calendar connection created successfully');

        // Setup webhook for automatic sync
        try {
          console.log('📡 Setting up Google Calendar webhook for automatic sync...');
          const GoogleCalendarWebhookService = require('../services/googleCalendarWebhook');
          const webhookService = new GoogleCalendarWebhookService();
          await webhookService.setupCalendarWatch(user.id);
          console.log('✅ Webhook setup completed - meetings will sync automatically');

          // Trigger initial sync to fetch existing meetings
          try {
            console.log('🔄 Triggering initial sync to fetch existing meetings...');
            await webhookService.syncCalendarEvents(user.id);
            console.log('✅ Initial sync completed - existing meetings fetched');
          } catch (syncError) {
            console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
            // Don't fail the connection if initial sync fails
          }
        } catch (webhookError) {
          console.warn('⚠️  Webhook setup failed (non-fatal):', webhookError.message);
          // Don't fail the connection if webhook setup fails
        }
      }
    }

    // Generate JWT
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

// Verify token and return user info
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Check if Supabase is available
        if (!isSupabaseAvailable()) {
            return res.status(503).json({
                error: 'Database service unavailable. Please contact support.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: user } = await getSupabase()
            .from('users')
            .select('id, email, name, profilepicture')
            .eq('id', decoded.id)
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
        onboarding_step: 2, // Move to next step
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating user business info:', userError);
      return res.status(500).json({ error: 'Failed to save business profile' });
    }

    // Check if user already has a tenant
    const { data: existingUser } = await req.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    let tenantId = existingUser?.tenant_id;

    // Create tenant if doesn't exist
    if (!tenantId) {
      // Use service role client for tenant creation (bypasses RLS)
      const adminClient = getSupabase();

      const { data: tenant, error: tenantError } = await adminClient
        .from('tenants')
        .insert({
          name: business_name,
          business_type,
          team_size,
          timezone: timezone || 'UTC',
          owner_id: userId
        })
        .select()
        .single();

      if (tenantError) {
        console.error('Error creating tenant:', tenantError);
        return res.status(500).json({ error: 'Failed to create tenant' });
      }

      tenantId = tenant.id;

      // Add user as tenant owner (use service role client)
      const { error: memberError } = await adminClient
        .from('tenant_members')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) {
        console.error('Error adding tenant member:', memberError);
        return res.status(500).json({ error: 'Failed to add tenant member' });
      }

      // Update user with tenant_id (use service role client)
      const { error: updateError } = await adminClient
        .from('users')
        .update({ tenant_id: tenantId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user tenant_id:', updateError);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      console.log(`✅ Created tenant ${tenantId} for user ${userId}`);
    }

    res.json({
      success: true,
      tenant_id: tenantId,
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
 */
router.post('/onboarding/complete', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await req.supabase
      .from('users')
      .update({
        onboarding_completed: true,
        onboarding_step: 6, // Final step
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error completing onboarding:', error);
      return res.status(500).json({ error: 'Failed to complete onboarding' });
    }

    console.log(`✅ User ${userId} completed onboarding`);

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
      console.log('⚠️ No provider token found - user may not have signed in with Google');
      return res.json({
        success: false,
        message: 'No Google Calendar access - user did not sign in with Google OAuth'
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
        sync_enabled: true
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