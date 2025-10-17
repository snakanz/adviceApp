const cron = require('node-cron');
const CalendlyService = require('./calendlyService');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * Sync Scheduler Service
 * Handles automatic periodic syncing of Calendly meetings
 */
class SyncScheduler {
  constructor() {
    this.calendlyService = new CalendlyService();
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

    this.isRunning = true;
    console.log('✅ Sync scheduler started successfully');
    console.log('📅 Calendly sync will run every 15 minutes');
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

      if (!this.calendlyService.isConfigured()) {
        console.log('⚠️  [Scheduled Sync] Calendly not configured, skipping sync');
        return;
      }

      // Get all active users
      const { data: users, error } = await getSupabase()
        .from('users')
        .select('id, email, name')
        .order('id');

      if (error) {
        console.error('❌ [Scheduled Sync] Error fetching users:', error);
        return;
      }

      if (!users || users.length === 0) {
        console.log('⚠️  [Scheduled Sync] No users found');
        return;
      }

      console.log(`📊 [Scheduled Sync] Found ${users.length} user(s) to sync`);

      // Sync for each user
      let totalSynced = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const user of users) {
        try {
          console.log(`  🔄 Syncing for user ${user.id} (${user.email})...`);
          
          const result = await this.calendlyService.syncMeetingsToDatabase(user.id);
          
          totalSynced += result.synced || 0;
          totalUpdated += result.updated || 0;
          totalErrors += result.errors || 0;

          console.log(`  ✅ User ${user.id}: ${result.synced} new, ${result.updated} updated`);
        } catch (userError) {
          console.error(`  ❌ Error syncing for user ${user.id}:`, userError.message);
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
   * Manually trigger a sync (for testing or immediate sync needs)
   */
  async triggerManualSync() {
    console.log('🔄 Manual sync triggered...');
    await this.syncCalendlyForAllUsers();
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

