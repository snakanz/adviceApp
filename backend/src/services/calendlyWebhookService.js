const { getSupabase, isSupabaseAvailable } = require('../config/supabase');

/**
 * Service for managing Calendly webhook subscriptions
 * Handles programmatic creation and management of organization-scoped webhooks
 */
class CalendlyWebhookService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://api.calendly.com';
    this.webhookUrl = `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendly/webhook`;
    this.signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  }

  /**
   * Check if webhook service is properly configured
   */
  isConfigured() {
    return !!(this.accessToken && this.signingKey);
  }

  /**
   * Make authenticated request to Calendly API
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create a webhook subscription for an organization
   * @param {string} organizationUri - The Calendly organization URI
   * @param {string} userUri - The Calendly user URI (for user-scoped webhooks)
   * @param {string} scope - 'organization' or 'user'
   * @returns {Promise<Object>} The created webhook subscription
   */
  async createWebhookSubscription(organizationUri, userUri, scope = 'organization') {
    try {
      console.log(`📡 Creating Calendly webhook subscription (scope: ${scope})...`);
      console.log(`   Organization: ${organizationUri}`);
      console.log(`   User: ${userUri}`);
      console.log(`   Webhook URL: ${this.webhookUrl}`);

      if (!this.isConfigured()) {
        throw new Error('Calendly webhook service not configured (missing access token or signing key)');
      }

      const requestBody = {
        url: this.webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: organizationUri,
        scope: scope
      };

      // Add user URI for user-scoped webhooks
      if (scope === 'user') {
        requestBody.user = userUri;
      }

      // Add signing key if available
      if (this.signingKey) {
        requestBody.signing_key = this.signingKey;
      }

      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await this.makeRequest('/webhook_subscriptions', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('✅ Webhook subscription created successfully:', response.resource?.uri);

      return response.resource;
    } catch (error) {
      console.error('❌ Error creating webhook subscription:', error.message);
      throw error;
    }
  }

  /**
   * List all webhook subscriptions for an organization
   * @param {string} organizationUri - The Calendly organization URI
   * @returns {Promise<Array>} List of webhook subscriptions
   */
  async listWebhookSubscriptions(organizationUri, scope = 'organization') {
    try {
      const params = new URLSearchParams({
        organization: organizationUri,
        scope: scope
      });

      const response = await this.makeRequest(`/webhook_subscriptions?${params}`);
      return response.collection || [];
    } catch (error) {
      console.error('❌ Error listing webhook subscriptions:', error.message);
      throw error;
    }
  }

  /**
   * Delete a webhook subscription
   * @param {string} webhookUri - The webhook subscription URI
   */
  async deleteWebhookSubscription(webhookUri) {
    try {
      const webhookUuid = webhookUri.split('/').pop();
      await this.makeRequest(`/webhook_subscriptions/${webhookUuid}`, {
        method: 'DELETE'
      });
      console.log('✅ Webhook subscription deleted:', webhookUri);
    } catch (error) {
      console.error('❌ Error deleting webhook subscription:', error.message);
      throw error;
    }
  }

  /**
   * Ensure webhook subscription exists for an organization
   * Creates one if it doesn't exist, returns existing one if it does
   * @param {string} organizationUri - The Calendly organization URI
   * @param {string} userUri - The Calendly user URI
   * @returns {Promise<Object>} The webhook subscription
   */
  async ensureWebhookSubscription(organizationUri, userUri) {
    try {
      if (!isSupabaseAvailable()) {
        throw new Error('Database not available');
      }

      const supabase = getSupabase();

      // Check if we already have a webhook subscription for this organization
      const { data: existingWebhook } = await supabase
        .from('calendly_webhook_subscriptions')
        .select('*')
        .eq('organization_uri', organizationUri)
        .single();

      if (existingWebhook) {
        console.log('✅ Webhook subscription already exists for organization:', organizationUri);
        return {
          webhook_uri: existingWebhook.webhook_subscription_uri,
          created: false,
          existing: true
        };
      }

      // Create new webhook subscription
      console.log('🆕 No webhook found for organization, creating new one...');
      const webhook = await this.createWebhookSubscription(organizationUri, userUri, 'organization');

      // Store webhook subscription in database
      const { error: insertError } = await supabase
        .from('calendly_webhook_subscriptions')
        .insert({
          organization_uri: organizationUri,
          webhook_subscription_uri: webhook.uri,
          webhook_url: this.webhookUrl,
          scope: 'organization',
          events: ['invitee.created', 'invitee.canceled'],
          is_active: true
        });

      if (insertError) {
        console.error('❌ Error storing webhook subscription in database:', insertError);
        // Try to delete the webhook we just created
        try {
          await this.deleteWebhookSubscription(webhook.uri);
        } catch (deleteError) {
          console.error('❌ Failed to cleanup webhook after database error:', deleteError);
        }
        throw insertError;
      }

      console.log('✅ Webhook subscription created and stored in database');

      return {
        webhook_uri: webhook.uri,
        created: true,
        existing: false
      };
    } catch (error) {
      console.error('❌ Error ensuring webhook subscription:', error.message);
      throw error;
    }
  }

  /**
   * Check if a webhook subscription exists for an organization
   * @param {string} organizationUri - The Calendly organization URI
   * @returns {Promise<boolean>} True if webhook exists
   */
  async webhookExists(organizationUri) {
    try {
      if (!isSupabaseAvailable()) {
        return false;
      }

      const { data } = await getSupabase()
        .from('calendly_webhook_subscriptions')
        .select('id')
        .eq('organization_uri', organizationUri)
        .eq('is_active', true)
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }
}

module.exports = CalendlyWebhookService;

