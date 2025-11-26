const cron = require('node-cron');
const CalendlyService = require('./calendlyService');
const GoogleCalendarWebhook = require('./googleCalendarWebhook');
const MicrosoftCalendarService = require('./microsoftCalendar');
const WebhookHealthService = require('./webhookHealthService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * Sync Scheduler Service
 * Handles automatic periodic syncing of Calendly meetings and webhook renewals
 */
class SyncScheduler {
  constructor() {
    this.calendlyService = new CalendlyService();
    this.googleCalendarWebhook = new GoogleCalendarWebhook();
    this.microsoftCalendarService = new MicrosoftCalendarService();
    this.isRunning = false;
    this.scheduledTasks = [];
  }

  /**
   * Start the automatic sync scheduler
   * Runs Calendly sync every 15 minutes
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Sync scheduler is already running');
      return;
    }

    console.log('🚀 Starting automatic sync scheduler...');

    // Schedule Calendly sync every 15 minutes
    // Cron format: minute hour day month weekday
    // */15 * * * * = every 15 minutes
    const calendlyTask = cron.schedule('*/15 * * * *', async () => {
      await this.syncCalendlyForAllUsers();
    });

    this.scheduledTasks.push({
      name: 'Calendly Sync',
      task: calendlyTask,
      schedule: 'Every 15 minutes'
    });

    // Schedule Calendly webhook health check every day at 1 AM
    // 0 1 * * * = every day at 1:00 AM
    const calendlyWebhookHealthTask = cron.schedule('0 1 * * *', async () => {
      await this.renewCalendlyWebhooksForAllUsers();
    });

    this.scheduledTasks.push({
      name: 'Calendly Webhook Health Check',
      task: calendlyWebhookHealthTask,
      schedule: 'Every day at 1:00 AM'
    });

    // Schedule Google Calendar webhook renewal every day at 2 AM
    // 0 2 * * * = every day at 2:00 AM
    const googleWebhookRenewalTask = cron.schedule('0 2 * * *', async () => {
      await this.renewGoogleCalendarWebhooksForAllUsers();
    });

    this.scheduledTasks.push({
      name: 'Google Calendar Webhook Renewal',
      task: googleWebhookRenewalTask,
      schedule: 'Every day at 2:00 AM'
    });

    // Schedule Microsoft Calendar webhook renewal every day at 3 AM
    // 0 3 * * * = every day at 3:00 AM
    const microsoftWebhookRenewalTask = cron.schedule('0 3 * * *', async () => {
      await this.renewMicrosoftCalendarWebhooksForAllUsers();
    });

    this.scheduledTasks.push({
      name: 'Microsoft Calendar Webhook Renewal',
      task: microsoftWebhookRenewalTask,
      schedule: 'Every day at 3:00 AM'
    });

    this.isRunning = true;
    console.log('✅ Sync scheduler started successfully');
    console.log('📅 Calendly sync will run every 15 minutes');
    console.log('📡 Calendly webhooks will be checked daily at 1:00 AM');
    console.log('📡 Google Calendar webhooks will renew daily at 2:00 AM');
    console.log('📡 Microsoft Calendar webhooks will renew daily at 3:00 AM');
  }

  /**
   * Stop the automatic sync scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Sync scheduler is not running');
      return;
    }

    console.log('🛑 Stopping sync scheduler...');

    // Stop all scheduled tasks
    this.scheduledTasks.forEach(({ name, task }) => {
      task.stop();
      console.log(`  ✓ Stopped: ${name}`);
    });

    this.scheduledTasks = [];
    this.isRunning = false;
    console.log('✅ Sync scheduler stopped');
  }

  /**
   * Sync Calendly meetings for all users
   */
  async syncCalendlyForAllUsers() {
    try {
      console.log('\n🔄 [Scheduled Sync] Starting automatic Calendly sync...');

      if (!isSupabaseAvailable()) {
        console.log('❌ [Scheduled Sync] Database unavailable, skipping sync');
        return;
      }

      // Get all users with active Calendly connections
      const { data: connections, error } = await getSupabase()
        .from('calendar_connections')
        .select('user_id')
        .eq('provider', 'calendly')
        .eq('is_active', true);

      if (error) {
        console.error('❌ [Scheduled Sync] Error fetching Calendly connections:', error);
        return;
      }

      if (!connections || connections.length === 0) {
        console.log('⚠️  [Scheduled Sync] No active Calendly connections found');
        return;
      }

      console.log(`📊 [Scheduled Sync] Found ${connections.length} active Calendly connection(s)`);

      let totalSynced = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const connection of connections) {
        const userId = connection.user_id;

        try {
          console.log(`  🔄 Syncing Calendly events for user ${userId}...`);

          // Get a fresh access token for this user (auto-refreshes if needed)
          const accessToken = await CalendlyService.getUserAccessToken(userId);

          if (!accessToken) {
            console.warn(`  ⚠️  Skipping user ${userId} - no valid Calendly access token`);
            totalErrors++;
            continue;
          }

          const calendlyService = new CalendlyService(accessToken);
          const result = await calendlyService.syncMeetingsToDatabase(userId);

          totalSynced += result.synced || 0;
          totalUpdated += result.updated || 0;
          totalErrors += result.errors || 0;

          console.log(`  ✅ User ${userId}: ${result.synced} new, ${result.updated} updated`);
        } catch (userError) {
          console.error(`  ❌ Error syncing Calendly for user ${userId}:`, userError.message);
          totalErrors++;
        }
      }

      console.log(`\n✅ [Scheduled Sync] Completed: ${totalSynced} new, ${totalUpdated} updated, ${totalErrors} errors`);
      console.log(`⏰ Next sync in 15 minutes\n`);

    } catch (error) {
      console.error('❌ [Scheduled Sync] Fatal error:', error);
    }
  }

  /**
   * Renew Google Calendar webhooks for all users
   * Prevents webhook expiration (7-day limit)
   */
  async renewGoogleCalendarWebhooksForAllUsers() {
    try {
      console.log('\n📡 [Webhook Renewal] Starting Google Calendar webhook renewal...');

      if (!isSupabaseAvailable()) {
        console.log('❌ [Webhook Renewal] Database unavailable, skipping renewal');
        return;
      }

      // Get all users with active Google Calendar connections
      const { data: connections, error } = await getSupabase()
        .from('calendar_connections')
        .select('user_id')
        .eq('provider', 'google')
        .eq('is_active', true);

      if (error) {
        console.error('❌ [Webhook Renewal] Error fetching connections:', error);
        return;
      }

      if (!connections || connections.length === 0) {
        console.log('⚠️  [Webhook Renewal] No active Google Calendar connections found');
        return;
      }

      console.log(`📊 [Webhook Renewal] Found ${connections.length} active Google Calendar connection(s)`);

      // Renew webhook for each user
      let renewed = 0;
      let failed = 0;

      for (const connection of connections) {
        try {
          console.log(`  🔄 Renewing webhook for user ${connection.user_id}...`);

          await this.googleCalendarWebhook.setupCalendarWatch(connection.user_id);

          renewed++;
          console.log(`  ✅ Webhook renewed for user ${connection.user_id}`);
        } catch (userError) {
          console.error(`  ❌ Error renewing webhook for user ${connection.user_id}:`, userError.message);
          failed++;
        }
      }

      console.log(`\n✅ [Webhook Renewal] Completed: ${renewed} renewed, ${failed} failed`);
      console.log(`⏰ Next renewal in 24 hours\n`);

    } catch (error) {
      console.error('❌ [Webhook Renewal] Fatal error:', error);
    }
  }

  /**
   * Renew Calendly webhooks for all users (health check + recreation)
   * Ensures Calendly webhooks stay active or are recreated when missing
   */
  async renewCalendlyWebhooksForAllUsers() {
    try {
      console.log('\n📡 [Webhook Renewal] Starting Calendly webhook renewal...');

      if (!isSupabaseAvailable()) {
        console.log('❌ [Webhook Renewal] Database unavailable, skipping Calendly renewal');
        return;
      }

      // Get all users with active Calendly connections
      const { data: connections, error } = await getSupabase()
        .from('calendar_connections')
        .select('user_id')
        .eq('provider', 'calendly')
        .eq('is_active', true);

      if (error) {
        console.error('❌ [Webhook Renewal] Error fetching Calendly connections:', error);
        return;
      }

      if (!connections || connections.length === 0) {
        console.log('⚠️  [Webhook Renewal] No active Calendly connections found');
        return;
      }

      console.log(`📊 [Webhook Renewal] Found ${connections.length} active Calendly connection(s)`);

      let checked = 0;
      let failed = 0;

      for (const connection of connections) {
        try {
          console.log(`  🔄 Checking Calendly webhook health for user ${connection.user_id}...`);
          await WebhookHealthService.checkAndRepairWebhook(connection.user_id);
          checked++;
        } catch (userError) {
          console.error(`  ❌ Error checking Calendly webhook for user ${connection.user_id}:`, userError.message);
          failed++;
        }
      }

      console.log(`\n✅ [Webhook Renewal] Completed: ${checked} checked, ${failed} failed`);
      console.log(`⏰ Next Calendly webhook health check in 24 hours\n`);
    } catch (error) {
      console.error('❌ [Webhook Renewal] Fatal error (Calendly):', error);
    }
  }

  /**
   * Manually trigger a sync (for testing or immediate sync needs)
   */
  async triggerManualSync() {
    console.log('🔄 Manual sync triggered...');
    await this.syncCalendlyForAllUsers();
  }

  /**
   * Manually trigger webhook renewal (for testing or immediate renewal needs)
   */
  async triggerManualWebhookRenewal() {
    console.log('📡 Manual webhook renewal triggered...');
    await this.renewGoogleCalendarWebhooksForAllUsers();
  }

  /**
   * Renew Microsoft Calendar webhooks for all users
   * Prevents webhook expiration (3-day limit)
   */
  async renewMicrosoftCalendarWebhooksForAllUsers() {
    try {
      console.log('\n📡 [Webhook Renewal] Starting Microsoft Calendar webhook renewal...');

      if (!isSupabaseAvailable()) {
        console.log('❌ [Webhook Renewal] Database unavailable, skipping renewal');
        return;
      }

      // Get all users with active Microsoft Calendar connections
      const { data: connections, error } = await getSupabase()
        .from('calendar_connections')
        .select('user_id, microsoft_subscription_expires_at')
        .eq('provider', 'microsoft')
        .eq('is_active', true);

      if (error) {
        console.error('❌ [Webhook Renewal] Error fetching connections:', error);
        return;
      }

      if (!connections || connections.length === 0) {
        console.log('⚠️  [Webhook Renewal] No active Microsoft Calendar connections found');
        return;
      }

      console.log(`📊 [Webhook Renewal] Found ${connections.length} active Microsoft Calendar connection(s)`);

      // Renew webhook for each user
      let renewed = 0;
      let failed = 0;

      for (const connection of connections) {
        try {
          // Check if webhook is expiring soon (within 24 hours)
          const expiresAt = new Date(connection.microsoft_subscription_expires_at);
          const now = new Date();
          const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

          if (hoursUntilExpiry < 24) {
            console.log(`  🔄 Renewing webhook for user ${connection.user_id} (expires in ${hoursUntilExpiry.toFixed(1)}h)...`);

            await this.microsoftCalendarService.renewCalendarWatch(connection.user_id);

            renewed++;
            console.log(`  ✅ Webhook renewed for user ${connection.user_id}`);
          } else {
            console.log(`  ⏭️  Skipping user ${connection.user_id} (expires in ${hoursUntilExpiry.toFixed(1)}h)`);
          }
        } catch (userError) {
          console.error(`  ❌ Error renewing webhook for user ${connection.user_id}:`, userError.message);
          failed++;
        }
      }

      console.log(`\n✅ [Webhook Renewal] Completed: ${renewed} renewed, ${failed} failed`);
      console.log(`⏰ Next renewal check in 24 hours\n`);

    } catch (error) {
      console.error('❌ [Webhook Renewal] Fatal error:', error);
    }
  }

  /**
   * Manually trigger Microsoft webhook renewal (for testing or immediate renewal needs)
   */
  async triggerManualMicrosoftWebhookRenewal() {
    console.log('📡 Manual Microsoft webhook renewal triggered...');
    await this.renewMicrosoftCalendarWebhooksForAllUsers();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: this.scheduledTasks.map(({ name, schedule }) => ({
        name,
        schedule
      })),
      calendlyConfigured: this.calendlyService.isConfigured()
    };
  }
}

// Create singleton instance
const syncScheduler = new SyncScheduler();

module.exports = syncScheduler;

