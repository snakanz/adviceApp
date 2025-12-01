const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const crypto = require('crypto');
const clientExtractionService = require('./clientExtraction');

/**
 * Microsoft Calendar Service
 * Handles Microsoft Graph API Calendar integration
 * Provides OAuth authentication and calendar sync
 */
class MicrosoftCalendarService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/auth/microsoft/callback`;
    
    // Initialize MSAL confidential client
    this.msalConfig = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        clientSecret: this.clientSecret,
      }
    };
    
    this.cca = new ConfidentialClientApplication(this.msalConfig);
  }

  /**
   * Check if Microsoft OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Generate Microsoft OAuth authorization URL
   */
  getAuthorizationUrl(state = '') {
    const scopes = [
      'User.Read',
      'Calendars.Read',
      'Calendars.ReadWrite',
      'offline_access'
    ];

    const authCodeUrlParameters = {
      scopes: scopes,
      redirectUri: this.redirectUri,
      state: state,
      prompt: 'consent' // ✅ FIX: Force consent screen to ensure refresh token is always provided
    };

    return this.cca.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Extract refresh token from MSAL token cache
   * MSAL stores refresh tokens in an internal cache for security
   * We need to extract it to store in our database
   */
  async getRefreshTokenFromCache(homeAccountId) {
    try {
      const cache = this.cca.getTokenCache();
      const cacheData = cache.serialize();

      // Parse the serialized cache
      const parsedCache = JSON.parse(cacheData);

      // Refresh tokens are stored in the RefreshToken section
      const refreshTokens = parsedCache.RefreshToken || {};

      // Find the refresh token for this specific account
      for (const key in refreshTokens) {
        const token = refreshTokens[key];
        if (token.home_account_id === homeAccountId) {
          console.log('✅ Refresh token found in MSAL cache for account:', homeAccountId);
          return token.secret; // This is the actual refresh token string
        }
      }

      console.warn('⚠️ No refresh token found in cache for account:', homeAccountId);
      return null;
    } catch (error) {
      console.error('❌ Error extracting refresh token from cache:', error);
      return null;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    const tokenRequest = {
      code: code,
      scopes: [
        'User.Read',
        'Calendars.Read',
        'Calendars.ReadWrite',
        'offline_access'
      ],
      redirectUri: this.redirectUri,
    };

    const response = await this.cca.acquireTokenByCode(tokenRequest);

    // Extract refresh token from MSAL cache
    const refreshToken = await this.getRefreshTokenFromCache(
      response.account.homeAccountId
    );

    console.log('🔑 Microsoft OAuth - Refresh token extracted:', refreshToken ? 'YES ✅' : 'NO ❌');
    console.log('📊 Microsoft OAuth - Access token received:', response.accessToken ? 'YES ✅' : 'NO ❌');
    console.log('⏰ Microsoft OAuth - Token expires on:', response.expiresOn);

    // Return enhanced response with refresh token
    return {
      accessToken: response.accessToken,
      refreshToken: refreshToken,
      expiresOn: response.expiresOn,
      account: response.account,
      scopes: response.scopes
    };
  }

  /**
   * Get Microsoft Graph client with access token
   */
  getGraphClient(accessToken) {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Get user info from Microsoft Graph
   */
  async getUserInfo(accessToken) {
    const client = this.getGraphClient(accessToken);
    const user = await client.api('/me').get();
    return user;
  }

  /**
   * Initialize Microsoft Graph client with user tokens from database
   */
  async initializeClientForUser(userId) {
    if (!isSupabaseAvailable()) {
      throw new Error('Database service unavailable');
    }

    // Get user's Microsoft Calendar connection
    const { data: connection, error } = await getSupabase()
      .from('calendar_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      throw new Error('No active Microsoft Calendar connection found');
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    
    let accessToken = connection.access_token;

    // Refresh token if expired
    if (expiresAt && expiresAt <= now && connection.refresh_token) {
      console.log('🔄 Microsoft access token expired, refreshing...');
      const refreshedTokens = await this.refreshAccessToken(connection.refresh_token);
      accessToken = refreshedTokens.accessToken;

      // Update tokens in database
      await getSupabase()
        .from('calendar_connections')
        .update({
          access_token: refreshedTokens.accessToken,
          token_expires_at: refreshedTokens.expiresOn ? new Date(refreshedTokens.expiresOn).toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', 'microsoft');

      console.log('✅ Microsoft access token refreshed');
    }

    return this.getGraphClient(accessToken);
  }

  /**
   * Refresh Microsoft access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    const refreshRequest = {
      refreshToken: refreshToken,
      scopes: [
        'User.Read',
        'Calendars.Read',
        'Calendars.ReadWrite',
        'offline_access'
      ]
    };

    const response = await this.cca.acquireTokenByRefreshToken(refreshRequest);
    return response;
  }

  /**
   * Setup Microsoft Calendar webhook subscription
   */
  async setupCalendarWatch(userId) {
    try {
      console.log(`📡 Setting up Microsoft Calendar webhook for user ${userId}...`);

      const client = await this.initializeClientForUser(userId);

      // Generate a unique subscription ID
      const subscriptionId = `advicly-calendar-${userId}-${Date.now()}`;
      const webhookUrl = `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendar/microsoft/webhook`;

      // Create subscription (expires after 3 days max for calendar resources)
      const subscription = {
        changeType: 'created,updated,deleted',
        notificationUrl: webhookUrl,
        resource: '/me/events',
        expirationDateTime: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString(), // 3 days
        clientState: crypto.randomBytes(16).toString('hex') // For validation
      };

      const response = await client.api('/subscriptions').post(subscription);

      console.log('✅ Microsoft Calendar webhook established:', {
        subscriptionId: response.id,
        expirationDateTime: response.expirationDateTime
      });

      // Store subscription info in database
      await getSupabase()
        .from('calendar_connections')
        .update({
          microsoft_subscription_id: response.id,
          microsoft_subscription_expires_at: response.expirationDateTime,
          microsoft_client_state: subscription.clientState,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', 'microsoft');

      return response;
    } catch (error) {
      console.error('❌ Error setting up Microsoft Calendar webhook:', error);
      throw error;
    }
  }

  /**
   * Renew Microsoft Calendar webhook subscription
   * Extends the expiration time before it expires
   */
  async renewCalendarWatch(userId) {
    try {
      console.log(`🔄 Renewing Microsoft Calendar webhook for user ${userId}...`);

      // Get current subscription info from database
      const { data: connection } = await getSupabase()
        .from('calendar_connections')
        .select('microsoft_subscription_id, microsoft_subscription_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'microsoft')
        .eq('is_active', true)
        .single();

      if (!connection || !connection.microsoft_subscription_id) {
        console.log('⚠️  No Microsoft subscription found, setting up new one...');
        return await this.setupCalendarWatch(userId);
      }

      // Check if subscription is expired or about to expire
      const expiresAt = new Date(connection.microsoft_subscription_expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

      if (hoursUntilExpiry < 0) {
        console.log('❌ Subscription already expired, creating new one...');
        return await this.setupCalendarWatch(userId);
      }

      console.log(`⏰ Subscription expires in ${hoursUntilExpiry.toFixed(1)} hours`);

      const client = await this.initializeClientForUser(userId);

      // Renew subscription by updating expiration time (3 days from now)
      const newExpirationDateTime = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString();

      const response = await client
        .api(`/subscriptions/${connection.microsoft_subscription_id}`)
        .patch({
          expirationDateTime: newExpirationDateTime
        });

      console.log('✅ Microsoft Calendar webhook renewed:', {
        subscriptionId: response.id,
        newExpirationDateTime: response.expirationDateTime
      });

      // Update expiration time in database
      await getSupabase()
        .from('calendar_connections')
        .update({
          microsoft_subscription_expires_at: response.expirationDateTime,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', 'microsoft');

      return response;
    } catch (error) {
      console.error('❌ Error renewing Microsoft Calendar webhook:', error);

      // If renewal fails (e.g., subscription not found), create a new one
      if (error.statusCode === 404) {
        console.log('🔄 Subscription not found, creating new one...');
        return await this.setupCalendarWatch(userId);
      }

      throw error;
    }
  }

  /**
   * Stop Microsoft Calendar webhook subscription
   */
  async stopCalendarWatch(userId) {
    try {
      console.log(`🛑 Stopping Microsoft Calendar webhook for user ${userId}...`);

      // Get subscription ID from database
      const { data: connection } = await getSupabase()
        .from('calendar_connections')
        .select('microsoft_subscription_id')
        .eq('user_id', userId)
        .eq('provider', 'microsoft')
        .single();

      if (!connection || !connection.microsoft_subscription_id) {
        console.log('⚠️  No Microsoft subscription found to stop');
        return;
      }

      const client = await this.initializeClientForUser(userId);

      // Delete the subscription
      await client.api(`/subscriptions/${connection.microsoft_subscription_id}`).delete();

      // Clear subscription info from database
      await getSupabase()
        .from('calendar_connections')
        .update({
          microsoft_subscription_id: null,
          microsoft_subscription_expires_at: null,
          microsoft_client_state: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', 'microsoft');

      console.log('✅ Microsoft Calendar webhook stopped');
    } catch (error) {
      console.error('❌ Error stopping Microsoft Calendar webhook:', error);
      throw error;
    }
  }

  /**
   * Sync calendar events from Microsoft Calendar
   */
  async syncCalendarEvents(userId) {
    try {
      console.log(`🔄 Syncing Microsoft Calendar events for user ${userId}...`);

      const client = await this.initializeClientForUser(userId);

      // Get events from the next 30 days
      const startDateTime = new Date().toISOString();
      const endDateTime = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString();

      const events = await client
        .api('/me/calendar/calendarView')
        .query({
          startDateTime: startDateTime,
          endDateTime: endDateTime,
          // IMPORTANT: Use 'onlineMeeting' NOT 'onlineMeetingUrl' - Microsoft deprecated onlineMeetingUrl
          // The actual Teams join URL is in onlineMeeting.joinUrl
          $select: 'subject,start,end,location,attendees,body,isOnlineMeeting,onlineMeeting,id',
          $orderby: 'start/dateTime'
        })
        .get();

      console.log(`📅 Found ${events.value.length} Microsoft Calendar events`);

      // Process and store events (similar to Google Calendar sync)
      // This will be implemented in the next step

      return {
        success: true,
        eventsCount: events.value.length
      };
    } catch (error) {
      console.error('❌ Error syncing Microsoft Calendar events:', error);
      throw error;
    }
  }
}

module.exports = MicrosoftCalendarService;

