const axios = require('axios');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * Calendly Webhook Manager
 * Ensures Calendly webhooks are always active and properly configured
 */
class CalendlyWebhookManager {
  constructor() {
    this.webhookUrl = `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendly/webhook`;
    this.signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    this.calendlyApiUrl = 'https://api.calendly.com';
  }

  /**
   * Check if Calendly webhook is properly configured
   */
  isConfigured() {
    return !!this.signingKey;
  }

  /**
   * Verify webhook is active for a user's Calendly account
   * This checks if the webhook subscription exists in Calendly
   */
  async verifyWebhookActive(userId) {
    try {
      if (!this.isConfigured()) {
        console.warn('⚠️ Calendly webhook not configured (missing CALENDLY_WEBHOOK_SIGNING_KEY)');
        return false;
      }

      // Get user's Calendly connection with organization URI
      const { data: connection, error } = await getSupabase()
        .from('calendar_connections')
        .select('access_token, provider, is_active, calendly_organization_uri')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      if (error || !connection?.access_token) {
        console.log(`⚠️ No active Calendly connection for user ${userId}`);
        return false;
      }

      if (!connection.calendly_organization_uri) {
        console.warn(`⚠️ No organization URI for user ${userId}`);
        return false;
      }

      // Check if webhook subscription exists (pass organization URI)
      const webhookExists = await this.checkWebhookSubscription(connection.access_token, connection.calendly_organization_uri);

      if (webhookExists) {
        console.log(`✅ Calendly webhook verified for user ${userId}`);
        return true;
      } else {
        console.warn(`⚠️ Calendly webhook not found for user ${userId}`);
        return false;
      }
    } catch (error) {
      console.error('Error verifying Calendly webhook:', error.message);
      return false;
    }
  }

  /**
   * Check if webhook subscription exists in Calendly
   * Note: This requires the organization URI to be specified
   */
  async checkWebhookSubscription(accessToken, organizationUri) {
    try {
      if (!organizationUri) {
        console.warn('⚠️ Cannot check webhook subscription without organization URI');
        return false;
      }

      // Calendly requires organization parameter to list webhooks
      const url = `${this.calendlyApiUrl}/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const subscriptions = response.data.collection || [];

      // Look for our webhook URL in the subscriptions
      const ourWebhook = subscriptions.find(sub =>
        sub.callback_url === this.webhookUrl
      );

      return !!ourWebhook;
    } catch (error) {
      console.error('Error checking webhook subscription:', error.message);
      return false;
    }
  }

  /**
   * Get webhook status for display
   */
  async getWebhookStatus(userId) {
    try {
      const isActive = await this.verifyWebhookActive(userId);
      
      return {
        webhook_active: isActive,
        sync_method: isActive ? 'webhook' : 'polling',
        webhook_url: this.webhookUrl,
        configured: this.isConfigured(),
        message: isActive 
          ? 'Calendly webhook is active and syncing in real-time'
          : 'Calendly is using polling sync (15 min intervals)'
      };
    } catch (error) {
      console.error('Error getting webhook status:', error.message);
      return {
        webhook_active: false,
        sync_method: 'polling',
        error: error.message
      };
    }
  }

  /**
   * Ensure webhook is active on user login
   * This is called when user logs in to verify webhook is still working
   */
  async ensureWebhookActiveOnLogin(userId) {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Calendly webhook not configured - skipping webhook verification');
        return { success: false, reason: 'not_configured' };
      }

      const isActive = await this.verifyWebhookActive(userId);
      
      if (isActive) {
        console.log(`✅ Calendly webhook confirmed active for user ${userId} on login`);
        return { success: true, status: 'active' };
      } else {
        console.warn(`⚠️ Calendly webhook not active for user ${userId} on login - will use polling`);
        return { success: false, status: 'inactive', reason: 'webhook_not_found' };
      }
    } catch (error) {
      console.error('Error ensuring webhook on login:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get webhook setup instructions
   */
  getSetupInstructions() {
    return {
      webhook_url: this.webhookUrl,
      events: ['invitee.created', 'invitee.canceled', 'invitee.updated'],
      instructions: [
        '1. Go to Calendly → Integrations → Webhooks',
        '2. Click "Create Webhook"',
        `3. Set Webhook URL to: ${this.webhookUrl}`,
        '4. Subscribe to events: invitee.created, invitee.canceled, invitee.updated',
        '5. Copy the Signing Key',
        '6. Add to environment: CALENDLY_WEBHOOK_SIGNING_KEY=<signing_key>',
        '7. Restart backend server'
      ]
    };
  }
}

module.exports = CalendlyWebhookManager;

