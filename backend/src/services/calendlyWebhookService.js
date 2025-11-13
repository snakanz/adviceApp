const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * Service for managing Calendly webhook subscriptions (API v2)
 * Handles programmatic creation and management of organization-scoped webhooks
 *
 * v2 Changes:
 * - Uses URI-based resource references
 * - signing_key is provided in webhook creation response
 * - Better error handling with structured responses
 * - Keyset-based pagination for listing webhooks
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

    // Handle 204 No Content (DELETE requests return empty response)
    if (response.status === 204) {
      console.log(`✅ [${requestId}] Calendly API Response: 204 No Content (DELETE successful)`);
      return null;
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

      const crypto = require('crypto');

      // ✅ v2 API FIX: Generate our own signing_key
      // Calendly v2 does NOT return signing_key in response, so we generate it
      // and send it when creating the webhook
      const signingKey = crypto.randomBytes(32).toString('hex');

      const requestBody = {
        url: this.webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: organizationUri,
        scope: scope,
        signing_key: signingKey  // ✅ Send our generated key to Calendly
      };

      // Add user URI for user-scoped webhooks
      if (scope === 'user') {
        requestBody.user = userUri;
      }

      console.log('📤 Webhook Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('🔑 Generated signing key:', signingKey.substring(0, 20) + '...');

      const response = await this.makeRequest('/webhook_subscriptions', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('✅ Webhook subscription created successfully:', response.resource?.uri);
      // ✅ DIAGNOSTIC: Log full webhook response
      console.log('📋 Full Webhook Response:', JSON.stringify(response, null, 2));

      const webhookResource = response.resource;

      // ✅ v2 API FIX: Calendly echoes back the signing_key we sent
      // If it's not in the response, use our generated key
      if (webhookResource?.signing_key) {
        console.log('🔑 Webhook signing key confirmed by Calendly:', webhookResource.signing_key.substring(0, 20) + '...');
      } else {
        // Calendly didn't echo it back, so use our generated key
        webhookResource.signing_key = signingKey;
        console.log('🔑 Using generated signing key (Calendly did not echo back):', signingKey.substring(0, 20) + '...');
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
   * List all webhook subscriptions for an organization or user (v2 with keyset pagination)
   * @param {string} resourceUri - The Calendly organization URI or user URI
   * @param {string} scope - 'organization' or 'user'
   * @returns {Promise<Array>} List of webhook subscriptions
   */
  async listWebhookSubscriptions(resourceUri, scope = 'organization') {
    try {
      let allWebhooks = [];
      let cursor = null;
      let pageCount = 0;

      do {
        const params = new URLSearchParams({
          scope: scope,
          page_size: '100' // v2 uses page_size
        });

        // ✅ FIX: Use correct parameter based on scope
        // For organization-scoped webhooks, use 'organization' parameter
        // For user-scoped webhooks, use 'user' parameter
        if (scope === 'user') {
          params.append('user', resourceUri);
        } else {
          params.append('organization', resourceUri);
        }

        // Add pagination token if we have one
        if (cursor) {
          params.append('pagination_token', cursor);
        }

        const response = await this.makeRequest(`/webhook_subscriptions?${params}`);
        const webhooks = response.collection || [];
        allWebhooks = allWebhooks.concat(webhooks);
        pageCount++;

        console.log(`📊 Webhook page ${pageCount}: Found ${webhooks.length} webhooks (Total: ${allWebhooks.length})`);

        // v2 uses pagination_token instead of next_page
        const pagination = response.pagination || {};
        cursor = pagination.next_page_token || null;

        // Safety check
        if (pageCount > 50) {
          console.warn('⚠️  Reached maximum page limit (50), stopping pagination');
          break;
        }
      } while (cursor);

      console.log(`✅ Listed ${allWebhooks.length} webhook subscriptions across ${pageCount} pages`);
      return allWebhooks;
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
   * Ensure webhook subscription exists for a USER (user-scoped)
   * Creates one if it doesn't exist, or returns existing one
   *
   * ✅ USER-SCOPED: Each user gets their own webhook with their own signing key
   * ✅ MULTI-TENANT: Supports 100s of users with their own private Calendly accounts
   * ✅ CLEANUP: Deletes old webhooks when user reconnects
   *
   * @param {string} organizationUri - The Calendly organization URI
   * @param {string} userUri - The Calendly user URI
   * @param {string} userId - The Advicly user ID (UUID)
   * @returns {Promise<Object>} The webhook subscription
   */
  async ensureWebhookSubscription(organizationUri, userUri, userId) {
    try {
      if (!isSupabaseAvailable()) {
        throw new Error('Database not available');
      }

      const supabase = getSupabase();

      console.log(`\n🔍 Ensuring user-scoped webhook for user: ${userId}`);
      console.log(`   User URI: ${userUri}`);

      // Step 1: Check if webhook already exists in database for this user
      console.log('🔍 Checking for existing webhook subscription for this user...');
      const { data: existingWebhook } = await supabase
        .from('calendly_webhook_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('scope', 'user')
        .eq('is_active', true)
        .maybeSingle();

      if (existingWebhook) {
        console.log('✅ Found existing user-scoped webhook:', existingWebhook.webhook_subscription_uri);

        // Verify webhook still exists in Calendly
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

      // Step 2: Clean up old webhooks for this user before creating new one
      console.log('🧹 Cleaning up old webhooks for this user...');
      try {
        const existingWebhooks = await this.listWebhookSubscriptions(userUri, 'user');
        const ourWebhooks = existingWebhooks.filter(wh => wh.callback_url === this.webhookUrl);

        for (const oldWebhook of ourWebhooks) {
          try {
            console.log(`🗑️  Deleting old webhook: ${oldWebhook.uri}`);
            await this.deleteWebhookSubscription(oldWebhook.uri);
            console.log(`✅ Deleted old webhook: ${oldWebhook.uri}`);
          } catch (deleteError) {
            console.warn(`⚠️  Failed to delete old webhook ${oldWebhook.uri}:`, deleteError.message);
          }
        }

        // Also clean up database records for this user
        const { error: dbDeleteError } = await supabase
          .from('calendly_webhook_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('scope', 'user');

        if (dbDeleteError) {
          console.warn('⚠️  Error cleaning up old webhook records in database:', dbDeleteError);
        } else {
          console.log('✅ Cleaned up old webhook records in database');
        }
      } catch (cleanupError) {
        console.warn('⚠️  Error during webhook cleanup:', cleanupError.message);
      }

      // Step 3: Create new USER-SCOPED webhook subscription
      console.log('🆕 Creating new user-scoped webhook subscription...');
      let webhook;

      try {
        webhook = await this.createWebhookSubscription(organizationUri, userUri, 'user');
      } catch (createError) {
        // Handle 409 Conflict - webhook already exists in Calendly
        if (createError.message.includes('409') && createError.message.includes('Already Exists')) {
          console.warn('⚠️  Webhook already exists in Calendly (409 Conflict)');
          console.log('🔍 Attempting to delete and recreate webhook...');

          try {
            const existingWebhooks = await this.listWebhookSubscriptions(userUri, 'user');
            const ourWebhook = existingWebhooks.find(wh => wh.callback_url === this.webhookUrl);

            if (ourWebhook) {
              console.log(`🗑️  Deleting conflicting webhook: ${ourWebhook.uri}`);
              await this.deleteWebhookSubscription(ourWebhook.uri);
              console.log('✅ Deleted conflicting webhook');

              console.log('🆕 Retrying webhook creation...');
              webhook = await this.createWebhookSubscription(organizationUri, userUri, 'user');
              console.log('✅ Webhook created successfully after deletion');
            } else {
              throw new Error('Webhook exists but could not be found in user webhooks list');
            }
          } catch (conflictError) {
            console.error('❌ Failed to resolve 409 Conflict:', conflictError.message);
            throw conflictError;
          }
        } else {
          throw createError;
        }
      }

      // Step 4: Store webhook subscription with signing key
      let signingKey = webhook.signing_key;

      if (!signingKey && webhook.uri) {
        console.warn('⚠️  Signing key missing from creation response, fetching webhook details...');
        try {
          const webhookUuid = webhook.uri.split('/').pop();
          const webhookDetails = await this.makeRequest(`/webhook_subscriptions/${webhookUuid}`);
          signingKey = webhookDetails.resource?.signing_key;

          if (signingKey) {
            console.log('✅ Retrieved signing key from webhook details');
          }
        } catch (detailsError) {
          console.error('❌ Error fetching webhook details:', detailsError.message);
        }
      }

      // Step 5: Store in database with user_id for per-user lookup
      const { error: insertError } = await supabase
        .from('calendly_webhook_subscriptions')
        .insert({
          user_id: userId,  // ✅ USER-SCOPED: Link to specific user
          organization_uri: organizationUri,
          user_uri: userUri,  // ✅ Store user URI for webhook routing
          webhook_subscription_uri: webhook.uri,
          webhook_url: this.webhookUrl,
          webhook_signing_key: signingKey,
          scope: 'user',  // ✅ Mark as user-scoped
          events: ['invitee.created', 'invitee.canceled'],
          is_active: true
        });

      if (insertError) {
        console.error('❌ Error storing webhook subscription in database:', insertError);
        if (!webhook.existing) {
          try {
            await this.deleteWebhookSubscription(webhook.uri);
          } catch (deleteError) {
            console.error('❌ Failed to cleanup webhook after database error:', deleteError);
          }
        }
        throw insertError;
      }

      console.log('✅ User-scoped webhook subscription stored in database');
      console.log('🔑 Webhook signing key stored for verification');
      console.log(`\n✅ User-scoped webhook setup complete for user: ${userId}\n`);

      return {
        webhook_uri: webhook.uri,
        webhook_signing_key: signingKey,
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

