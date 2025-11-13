/**
 * Calendly OAuth 2.0 Service
 * Handles Calendly OAuth authentication flow
 */

class CalendlyOAuthService {
  constructor() {
    this.clientId = process.env.CALENDLY_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.CALENDLY_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.CALENDLY_OAUTH_REDIRECT_URI || `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendar/calendly/oauth/callback`;
    this.baseURL = 'https://auth.calendly.com';
    this.apiBaseURL = 'https://api.calendly.com';
  }

  /**
   * Check if Calendly OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Generate Calendly OAuth authorization URL
   */
  getAuthorizationUrl(state) {
    if (!this.isConfigured()) {
      throw new Error('Calendly OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state || 'state',
      scope: 'default', // Calendly uses 'default' scope for all permissions
      prompt: 'login', // ✅ FIX: Force Calendly to show login screen every time (stronger than 'consent')
      // ✅ FIX: Add cache-busting parameter to force fresh OAuth flow
      // This prevents browser/Calendly from caching the OAuth session
      nonce: Date.now().toString() // Unique nonce for each OAuth request
    });

    return `${this.baseURL}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) {
      throw new Error('Calendly OAuth not configured');
    }

    const response = await fetch(`${this.baseURL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly OAuth error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.isConfigured()) {
      throw new Error('Calendly OAuth not configured');
    }

    const response = await fetch(`${this.baseURL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly OAuth refresh error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get current user information using access token
   */
  async getCurrentUser(accessToken) {
    const response = await fetch(`${this.apiBaseURL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Calendly user: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Test Calendly OAuth connection
   */
  async testConnection(accessToken) {
    try {
      const userResponse = await this.getCurrentUser(accessToken);
      return {
        connected: true,
        user: userResponse.resource
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = CalendlyOAuthService;

