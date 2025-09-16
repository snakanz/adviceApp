const webpush = require('web-push');
const { getSupabase } = require('../lib/supabase');

class PushNotificationService {
  constructor() {
    this.isConfigured = false;
    this.init();
  }

  init() {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:simon@greenwood.co.nz';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
      this.isConfigured = true;
      console.log('✅ Push notification service initialized');
    } else {
      console.warn('⚠️  VAPID keys not configured. Push notifications disabled.');
      console.warn('   Required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
    }
  }

  // Save push subscription to database
  async saveSubscription(userId, subscription) {
    if (!this.isConfigured) {
      throw new Error('Push notification service not configured');
    }

    try {
      const { data, error } = await getSupabase()
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving push subscription:', error);
        throw error;
      }

      console.log('Push subscription saved for user:', userId);
      return data;
    } catch (error) {
      console.error('Error in saveSubscription:', error);
      throw error;
    }
  }

  // Remove push subscription from database
  async removeSubscription(userId) {
    try {
      const { error } = await getSupabase()
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing push subscription:', error);
        throw error;
      }

      console.log('Push subscription removed for user:', userId);
    } catch (error) {
      console.error('Error in removeSubscription:', error);
      throw error;
    }
  }

  // Get user's push subscription
  async getUserSubscription(userId) {
    try {
      const { data, error } = await getSupabase()
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error getting user subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  }

  // Send push notification to user
  async sendNotificationToUser(userId, payload) {
    if (!this.isConfigured) {
      console.warn('Push notifications not configured, skipping notification');
      return;
    }

    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        console.log('No push subscription found for user:', userId);
        return;
      }

      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      };

      const result = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );

      console.log('Push notification sent to user:', userId);
      return result;
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // If subscription is invalid, remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log('Removing invalid subscription for user:', userId);
        await this.removeSubscription(userId);
      }
      
      throw error;
    }
  }

  // Send meeting reminder notification
  async sendMeetingReminder(userId, meeting, minutesBefore = 15) {
    const payload = {
      title: '📅 Meeting Reminder',
      body: `${meeting.title || 'Untitled Meeting'} starts in ${minutesBefore} minutes`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `meeting-reminder-${meeting.id}`,
      requireInteraction: true,
      data: {
        type: 'meeting_reminder',
        meetingId: meeting.id,
        url: `/meetings?id=${meeting.id}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Meeting'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };

    return this.sendNotificationToUser(userId, payload);
  }

  // Send meeting summary notification
  async sendMeetingSummaryReady(userId, meeting) {
    const payload = {
      title: '✨ Meeting Summary Ready',
      body: `AI summary is ready for "${meeting.title || 'Untitled Meeting'}"`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `meeting-summary-${meeting.id}`,
      data: {
        type: 'meeting_summary',
        meetingId: meeting.id,
        url: `/meetings?id=${meeting.id}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Summary'
        }
      ]
    };

    return this.sendNotificationToUser(userId, payload);
  }

  // Send client update notification
  async sendClientUpdate(userId, client, message) {
    const payload = {
      title: '👤 Client Update',
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `client-update-${client.id}`,
      data: {
        type: 'client_update',
        clientId: client.id,
        url: `/clients?id=${client.id}`
      }
    };

    return this.sendNotificationToUser(userId, payload);
  }

  // Send Ask Advicly notification
  async sendAskAdviclyNotification(userId, threadId, message) {
    const payload = {
      title: '🤖 Ask Advicly Response',
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `ask-advicly-${threadId}`,
      data: {
        type: 'ask_advicly',
        threadId: threadId,
        url: `/ask-advicly?thread=${threadId}`
      }
    };

    return this.sendNotificationToUser(userId, payload);
  }

  // Send test notification
  async sendTestNotification(userId) {
    const payload = {
      title: '🔔 Test Notification',
      body: 'Push notifications are working correctly!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      data: {
        type: 'test',
        url: '/settings'
      }
    };

    return this.sendNotificationToUser(userId, payload);
  }

  // Schedule meeting reminders
  async scheduleMeetingReminders(userId, meeting) {
    // This would typically integrate with a job scheduler like Bull or Agenda
    // For now, we'll just log the scheduling
    console.log(`Scheduling reminders for meeting ${meeting.id}:`, {
      userId,
      meetingTitle: meeting.title,
      startTime: meeting.startTime || meeting.start
    });
    
    // In a real implementation, you would:
    // 1. Calculate reminder times (15 min, 1 hour, 1 day before)
    // 2. Schedule jobs with a job queue
    // 3. Jobs would call sendMeetingReminder at the scheduled times
  }
}

module.exports = new PushNotificationService();
