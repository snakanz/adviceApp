const express = require('express');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const pushNotificationService = require('../services/pushNotificationService');
const { notificationSubscribe } = require('../middleware/validators');

const router = express.Router();

// Subscribe to push notifications
router.post('/subscribe', authenticateSupabaseUser, ...notificationSubscribe, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    await pushNotificationService.saveSubscription(userId, subscription);
    
    res.json({ 
      success: true, 
      message: 'Push notification subscription saved successfully' 
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ 
      error: 'Failed to subscribe to push notifications',
      details: error.message 
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    await pushNotificationService.removeSubscription(userId);
    
    res.json({ 
      success: true, 
      message: 'Push notification subscription removed successfully' 
    });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ 
      error: 'Failed to unsubscribe from push notifications',
      details: error.message 
    });
  }
});

// Get subscription status
router.get('/status', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const subscription = await pushNotificationService.getUserSubscription(userId);
    
    res.json({ 
      subscribed: !!subscription,
      subscription: subscription ? {
        endpoint: subscription.endpoint,
        created_at: subscription.created_at
      } : null
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription status',
      details: error.message 
    });
  }
});

// Get notification preferences
router.get('/preferences', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: preferences, error } = await req.supabase
      .rpc('get_user_notification_preferences', { p_user_id: userId });

    if (error) {
      console.error('Error getting notification preferences:', error);
      return res.status(500).json({ error: 'Failed to get notification preferences' });
    }

    res.json(preferences);
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ 
      error: 'Failed to get notification preferences',
      details: error.message 
    });
  }
});

// Update notification preferences
router.put('/preferences', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data, error } = await req.supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return res.status(500).json({ error: 'Failed to update notification preferences' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ 
      error: 'Failed to update notification preferences',
      details: error.message 
    });
  }
});

// Send test notification
router.post('/test', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    await pushNotificationService.sendTestNotification(userId);
    
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ 
      error: 'Failed to send test notification',
      details: error.message 
    });
  }
});

// Get notification history
router.get('/history', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    const { data: notifications, error } = await req.supabase
      .from('notification_log')
      .select(`
        id,
        notification_type,
        title,
        body,
        status,
        sent_at,
        delivered_at,
        created_at,
        meetings(title),
        clients(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error getting notification history:', error);
      return res.status(500).json({ error: 'Failed to get notification history' });
    }

    res.json(notifications);
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({ 
      error: 'Failed to get notification history',
      details: error.message 
    });
  }
});

// Trigger meeting reminder (for testing)
router.post('/meeting-reminder/:meetingId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { minutesBefore = 15 } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get meeting details
    const { data: meeting, error } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    await pushNotificationService.sendMeetingReminder(userId, meeting, minutesBefore);
    
    res.json({ 
      success: true, 
      message: 'Meeting reminder sent successfully' 
    });
  } catch (error) {
    console.error('Error sending meeting reminder:', error);
    res.status(500).json({ 
      error: 'Failed to send meeting reminder',
      details: error.message 
    });
  }
});

module.exports = router;
