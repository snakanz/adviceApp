const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

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
   * ✅ PHASE 4: Enhanced error logging with full API response details
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers
    };

    const requestId = Math.random().toString(36).substring(7);
    console.log(`📤 [${requestId}] Calendly API Request:`, {
      method: options.method || 'GET',
      endpoint,
      url
    });

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();

      // ✅ PHASE 4: Enhanced error logging with full response details
      console.error(`\n❌ [${requestId}] Calendly API Error Details:`);
      console.error('   Status:', response.status);
      console.error('   Status Text:', response.statusText);
      console.error('   Endpoint:', endpoint);
      console.error('   Method:', options.method || 'GET');
      console.error('   URL:', url);
      console.error('   Response Headers:', {
        'content-type': response.headers.get('content-type'),
        'x-request-id': response.headers.get('x-request-id'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining')
      });
      console.error('   Response Body (raw):', errorText);

      // ✅ PHASE 4: Try to parse error as JSON for structured logging
      try {
        const errorJson = JSON.parse(errorText);
        console.error('   Response Body (parsed):', JSON.stringify(errorJson, null, 2));

        // Log specific error fields if available
        if (errorJson.error) {
          console.error('   Error Code:', errorJson.error);
        }
        if (errorJson.message) {
          console.error('   Error Message:', errorJson.message);
        }
        if (errorJson.details) {
          console.error('   Error Details:', JSON.stringify(errorJson.details, null, 2));
        }
      } catch (e) {
        // Not JSON, already logged as text
        console.error('   (Response body is not JSON)');
      }

      console.error(`\n`);

      throw new Error(`Calendly API error (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`✅ [${requestId}] Calendly API Response:`, {
      status: response.status,
      hasResource: !!responseData.resource,
      hasCollection: !!responseData.collection
    });

    return responseData;
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

      // ✅ DIAGNOSTIC: Fetch organization details to check plan before creating webhook
      console.log('🔍 Checking organization plan before creating webhook...');
      try {
        const orgEndpoint = organizationUri.replace('https://api.calendly.com', '');
        const orgResponse = await this.makeRequest(orgEndpoint);
        console.log('🏢 Organization Details:', JSON.stringify(orgResponse, null, 2));

        const plan = orgResponse.resource?.plan?.toLowerCase();
        if (plan) {
          console.log(`📊 Organization Plan: ${plan.toUpperCase()}`);

          // ✅ DIAGNOSTIC: Warn if plan might not support webhooks
          if (plan === 'free' || plan === 'basic') {
            console.warn('⚠️  WARNING: Organization appears to be on FREE/BASIC plan');
            console.warn('⚠️  Webhooks typically require PAID plan (Standard/Professional/Teams/Enterprise)');
            console.warn('⚠️  Webhook creation may fail with 400 error');
            console.warn('⚠️  Reference: https://zeeg.me/en/blog/post/calendly-api');
          } else {
            console.log('✅ Organization on paid plan - webhook creation should succeed');
          }
        } else {
          console.warn('⚠️  Could not determine organization plan from response');
        }
      } catch (orgError) {
        console.warn('⚠️  Could not fetch organization details:', orgError.message);
        console.warn('⚠️  Proceeding with webhook creation anyway...');
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

      // ✅ FIX: DO NOT send signing_key when creating webhook
      // Calendly will generate and return a signing_key in the response
      // We'll store that returned key for webhook verification

      console.log('📤 Webhook Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await this.makeRequest('/webhook_subscriptions', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('✅ Webhook subscription created successfully:', response.resource?.uri);
      // ✅ DIAGNOSTIC: Log full webhook response
      console.log('📋 Full Webhook Response:', JSON.stringify(response, null, 2));

      // ✅ FIX: Extract and return the signing_key from Calendly's response
      const webhookResource = response.resource;
      if (webhookResource?.signing_key) {
        console.log('🔑 Webhook signing key received from Calendly:', webhookResource.signing_key.substring(0, 20) + '...');
      } else {
        console.warn('⚠️  WARNING: No signing_key in webhook response from Calendly');
      }

      return webhookResource;
    } catch (error) {
      console.error('❌ Error creating webhook subscription:', error.message);
      // ✅ DIAGNOSTIC: Log full error stack for debugging
      console.error('❌ Full Error Stack:', error.stack);
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
   * ✅ PHASE 2: Cleans up old webhooks on reconnect to prevent accumulation
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

      // Check if we already have a webhook subscription for this organization in our database
      const { data: existingWebhook } = await supabase
        .from('calendly_webhook_subscriptions')
        .select('*')
        .eq('organization_uri', organizationUri)
        .single();

      if (existingWebhook) {
        console.log('✅ Webhook subscription already exists in database for organization:', organizationUri);

        // ✅ PHASE 2: On reconnect, verify webhook still exists in Calendly
        // If it doesn't, we'll create a new one
        try {
          const webhookUuid = existingWebhook.webhook_subscription_uri.split('/').pop();
          await this.makeRequest(`/webhook_subscriptions/${webhookUuid}`);
          console.log('✅ Existing webhook verified in Calendly');

          return {
            webhook_uri: existingWebhook.webhook_subscription_uri,
            webhook_signing_key: existingWebhook.webhook_signing_key,
            created: false,
            existing: true
          };
        } catch (verifyError) {
          console.warn('⚠️  Existing webhook not found in Calendly, will create new one');
          // Continue to create new webhook
        }
      }

      // ✅ PHASE 2: Clean up old webhooks before creating new one
      // This prevents webhook accumulation when user reconnects
      console.log('🧹 Cleaning up old webhooks for organization...');
      try {
        const existingWebhooks = await this.listWebhookSubscriptions(organizationUri, 'organization');
        const ourWebhooks = existingWebhooks.filter(wh => wh.callback_url === this.webhookUrl);

        for (const oldWebhook of ourWebhooks) {
          try {
            console.log(`🗑️  Deleting old webhook: ${oldWebhook.uri}`);
            await this.deleteWebhookSubscription(oldWebhook.uri);
            console.log(`✅ Deleted old webhook: ${oldWebhook.uri}`);
          } catch (deleteError) {
            console.warn(`⚠️  Failed to delete old webhook ${oldWebhook.uri}:`, deleteError.message);
            // Continue with other webhooks
          }
        }

        // Also clean up database records for this organization
        const { error: dbDeleteError } = await supabase
          .from('calendly_webhook_subscriptions')
          .delete()
          .eq('organization_uri', organizationUri);

        if (dbDeleteError) {
          console.warn('⚠️  Error cleaning up old webhook records in database:', dbDeleteError);
        } else {
          console.log('✅ Cleaned up old webhook records in database');
        }
      } catch (cleanupError) {
        console.warn('⚠️  Error during webhook cleanup:', cleanupError.message);
        // Continue with new webhook creation
      }

      // Create new webhook subscription
      console.log('🆕 Creating new webhook subscription...');
      let webhook;

      try {
        webhook = await this.createWebhookSubscription(organizationUri, userUri, 'organization');
      } catch (createError) {
        // ✅ FIX: Handle 409 Conflict - webhook already exists in Calendly
        if (createError.message.includes('409') && createError.message.includes('Already Exists')) {
          console.warn('⚠️  Webhook already exists in Calendly (409 Conflict)');
          console.log('🔍 Attempting to delete and recreate webhook...');

          try {
            // Fetch all webhooks for this organization and find the one with our URL
            const existingWebhooks = await this.listWebhookSubscriptions(organizationUri, 'organization');
            const ourWebhook = existingWebhooks.find(wh => wh.callback_url === this.webhookUrl);

            if (ourWebhook) {
              console.log(`🗑️  Deleting conflicting webhook: ${ourWebhook.uri}`);
              await this.deleteWebhookSubscription(ourWebhook.uri);
              console.log('✅ Deleted conflicting webhook');

              // Now try to create again
              console.log('🆕 Retrying webhook creation...');
              webhook = await this.createWebhookSubscription(organizationUri, userUri, 'organization');
              console.log('✅ Webhook created successfully after deletion');
            } else {
              console.error('❌ Could not find webhook with URL:', this.webhookUrl);
              console.error('❌ Existing webhooks:', existingWebhooks.map(w => w.callback_url));
              throw new Error('Webhook exists but could not be found in organization webhooks list');
            }
          } catch (conflictError) {
            console.error('❌ Failed to resolve 409 Conflict:', conflictError.message);
            throw conflictError;
          }
        } else {
          // Re-throw if it's a different error
          throw createError;
        }
      }

      // ✅ FIX: Store webhook subscription WITH the signing key returned by Calendly
      const { error: insertError } = await supabase
        .from('calendly_webhook_subscriptions')
        .insert({
          organization_uri: organizationUri,
          webhook_subscription_uri: webhook.uri,
          webhook_url: this.webhookUrl,
          webhook_signing_key: webhook.signing_key,  // ✅ Store Calendly's signing key
          scope: 'organization',
          events: ['invitee.created', 'invitee.canceled'],
          is_active: true
        });

      if (insertError) {
        console.error('❌ Error storing webhook subscription in database:', insertError);
        // Don't try to delete if this is an existing webhook
        if (!webhook.existing) {
          try {
            await this.deleteWebhookSubscription(webhook.uri);
          } catch (deleteError) {
            console.error('❌ Failed to cleanup webhook after database error:', deleteError);
          }
        }
        throw insertError;
      }

      console.log('✅ Webhook subscription stored in database');
      console.log('🔑 Webhook signing key stored for verification');

      return {
        webhook_uri: webhook.uri,
        webhook_signing_key: webhook.signing_key,  // ✅ Return signing key
        created: false,  // Mark as not newly created (either existing or recovered)
        existing: true
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

