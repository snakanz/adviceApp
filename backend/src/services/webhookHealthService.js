/**
 * Webhook Health Check Service
 * Monitors and auto-recreates Calendly webhooks to ensure they stay active
 * Prevents webhooks from expiring or being deleted without user knowledge
 */

const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const CalendlyService = require('./calendlyService');
const CalendlyWebhookService = require('./calendlyWebhookService');

class WebhookHealthService {
  /**
   * Check if a user's Calendly webhook is still active
   * If missing, automatically recreate it
   * ✅ FIX: Skip webhook recreation for free plan users (use polling instead)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Health status
   */
  static async checkAndRepairWebhook(userId) {
    try {
      if (!isSupabaseAvailable()) {
        console.warn('⚠️  Database not available for webhook health check');
        return { status: 'error', message: 'Database unavailable' };
      }

      const supabase = getSupabase();

      // Get user's Calendly connection
      const { data: connection, error: connError } = await supabase
        .from('calendar_connections')
        .select('id, access_token, refresh_token, token_expires_at, calendly_user_uri, calendly_organization_uri, webhook_status, webhook_last_verified_at, webhook_last_error')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .maybeSingle();

      if (connError || !connection) {
        return { status: 'not_connected', message: 'No active Calendly connection' };
      }

      console.log(`\n🔍 Checking webhook health for user ${userId}...`);

      // ✅ FIX: Skip webhook recreation for free plan users
      // If the last error indicates a free plan limitation, don't retry webhook creation
      // The 15-minute polling will handle syncing for these users
      if (connection.webhook_status === 'error' &&
          connection.webhook_last_error &&
          (connection.webhook_last_error.includes('upgrade your Calendly account') ||
           connection.webhook_last_error.includes('Permission Denied'))) {
        console.log(`⏭️  Skipping webhook check for user ${userId} - Calendly free plan detected`);
        console.log(`   Using 15-minute polling instead of webhooks`);
        return {
          status: 'polling_only',
          message: 'Using polling (Calendly free plan - webhooks not supported)',
          plan_limit: 'calendly_free_plan'
        };
      }

      // Check if webhook was verified recently (within last 24 hours)
      const lastVerified = connection.webhook_last_verified_at ? new Date(connection.webhook_last_verified_at) : null;
      const now = new Date();
      const hoursSinceVerification = lastVerified ? (now - lastVerified) / (1000 * 60 * 60) : 999;

      if (hoursSinceVerification < 24 && connection.webhook_status === 'active') {
        console.log(`✅ Webhook verified recently (${Math.round(hoursSinceVerification)} hours ago)`);
        return { status: 'active', message: 'Webhook is healthy' };
      }

      // ✅ FIX: Get fresh access token (auto-refreshes if expired)
      console.log('🔐 Verifying webhook exists in Calendly...');
      const accessToken = await CalendlyService.getUserAccessToken(userId);

      if (!accessToken) {
        console.error('❌ Could not obtain valid Calendly access token');
        return { status: 'error', message: 'Could not obtain valid access token' };
      }

      const calendlyService = new CalendlyService(accessToken);

      try {
        // ✅ FIX: Pass BOTH organization AND user parameters
        // Calendly API v2 requires both parameters regardless of scope
        const webhooks = await calendlyService.makeRequest(
          `/webhook_subscriptions?organization=${encodeURIComponent(connection.calendly_organization_uri)}&user=${encodeURIComponent(connection.calendly_user_uri)}&scope=user`
        );

        const appUrl = process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com';
        const ourWebhook = (webhooks.collection || []).find(wh =>
          wh.callback_url && wh.callback_url.includes(appUrl)
        );

        if (ourWebhook) {
          console.log('✅ Webhook found in Calendly');

          // Update verification status
          await supabase
            .from('calendar_connections')
            .update({
              webhook_status: 'active',
              webhook_last_verified_at: now.toISOString(),
              webhook_verification_attempts: 0,
              webhook_last_error: null
            })
            .eq('id', connection.id);

          return { status: 'active', message: 'Webhook verified and active' };
        }

        console.warn('⚠️  Webhook not found in Calendly - will recreate');
        return await this.recreateWebhook(userId, connection);

      } catch (verifyError) {
        console.error('❌ Error verifying webhook:', verifyError.message);
        return await this.recreateWebhook(userId, connection);
      }

    } catch (error) {
      console.error('❌ Error in webhook health check:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Recreate a user's webhook subscription
   * @param {string} userId - User ID
   * @param {Object} connection - Calendar connection object
   * @returns {Promise<Object>} Recreation status
   */
  static async recreateWebhook(userId, connection) {
    try {
      console.log(`🔧 Attempting to recreate webhook for user ${userId}...`);

      const supabase = getSupabase();

      // ✅ FIX: Get fresh access token (auto-refreshes if expired)
      const accessToken = await CalendlyService.getUserAccessToken(userId);

      if (!accessToken) {
        throw new Error('Could not obtain valid Calendly access token for webhook recreation');
      }

      const webhookService = new CalendlyWebhookService(accessToken);

      // Recreate webhook
      const webhook = await webhookService.ensureWebhookSubscription(
        connection.calendly_organization_uri,
        connection.calendly_user_uri,
        userId
      );

      console.log('✅ Webhook recreated successfully');

      // Update connection status
      await supabase
        .from('calendar_connections')
        .update({
          webhook_status: 'active',
          webhook_last_verified_at: new Date().toISOString(),
          webhook_verification_attempts: 0,
          webhook_last_error: null
        })
        .eq('id', connection.id);

      return { status: 'recreated', message: 'Webhook recreated successfully' };

    } catch (error) {
      console.error('❌ Error recreating webhook:', error.message);

      const supabase = getSupabase();

      // ✅ FIX: Detect free plan limitation and mark connection appropriately
      // This prevents future retry attempts for users who can't use webhooks
      const isFreePlanError = error.message.includes('upgrade your Calendly account') ||
                              error.message.includes('Permission Denied') ||
                              error.message.includes('403');

      if (isFreePlanError) {
        console.log(`⚠️  User ${userId} appears to be on Calendly free plan - webhooks not supported`);
        console.log(`   Will use 15-minute polling instead`);

        await supabase
          .from('calendar_connections')
          .update({
            webhook_status: 'error',
            webhook_last_error: error.message,
            // Don't increment attempts for free plan - this is a permanent limitation
            webhook_verification_attempts: 0
          })
          .eq('id', connection.id);

        return {
          status: 'polling_only',
          message: 'Calendly free plan detected - using polling instead of webhooks',
          plan_limit: 'calendly_free_plan'
        };
      }

      // Update error status for other errors
      await supabase
        .from('calendar_connections')
        .update({
          webhook_status: 'error',
          webhook_last_error: error.message,
          webhook_verification_attempts: (connection.webhook_verification_attempts || 0) + 1
        })
        .eq('id', connection.id);

      return { status: 'error', message: `Failed to recreate webhook: ${error.message}` };
    }
  }
}

module.exports = WebhookHealthService;

