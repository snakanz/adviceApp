const { google } = require('googleapis');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const crypto = require('crypto');

/**
 * Google Calendar Webhook Service
 * Handles Google Calendar Push Notifications (Watch API)
 * Provides real-time updates when calendar events change
 */
class GoogleCalendarWebhookService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Set up a watch on user's Google Calendar
   * This registers a webhook to receive push notifications
   */
  async setupCalendarWatch(userId) {
    try {
      console.log(`📡 Setting up Google Calendar watch for user ${userId}...`);

      if (!isSupabaseAvailable()) {
        throw new Error('Database unavailable');
      }

      // Get user's Google tokens
      const { data: user, error: userError } = await getSupabase()
        .from('users')
        .select('googleaccesstoken, googlerefreshtoken, email')
        .eq('id', userId)
        .single();

      if (userError || !user?.googleaccesstoken) {
        throw new Error('User not authenticated with Google Calendar');
      }

      // Set OAuth credentials
      this.oauth2Client.setCredentials({
        access_token: user.googleaccesstoken,
        refresh_token: user.googlerefreshtoken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Generate a unique channel ID
      const channelId = `advicly-calendar-${userId}-${Date.now()}`;
      const webhookUrl = `${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendar/webhook`;

      // Set up the watch (expires after 7 days max, we'll renew it)
      const watchResponse = await calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      console.log('✅ Google Calendar watch established:', {
        channelId: watchResponse.data.id,
        resourceId: watchResponse.data.resourceId,
        expiration: new Date(parseInt(watchResponse.data.expiration))
      });

      // Store watch details in database
      const { error: insertError } = await getSupabase()
        .from('calendar_watch_channels')
        .upsert({
          user_id: userId,
          channel_id: watchResponse.data.id,
          resource_id: watchResponse.data.resourceId,
          expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
          webhook_url: webhookUrl,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (insertError) {
        console.error('Error storing watch channel:', insertError);
      }

      return watchResponse.data;
    } catch (error) {
      console.error('❌ Error setting up calendar watch:', error);
      throw error;
    }
  }

  /**
   * Stop watching a user's calendar
   */
  async stopCalendarWatch(userId) {
    try {
      console.log(`🛑 Stopping Google Calendar watch for user ${userId}...`);

      if (!isSupabaseAvailable()) {
        throw new Error('Database unavailable');
      }

      // Get watch channel details
      const { data: channel, error: channelError } = await getSupabase()
        .from('calendar_watch_channels')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (channelError || !channel) {
        console.log('No active watch channel found');
        return;
      }

      // Get user's Google tokens
      const { data: user } = await getSupabase()
        .from('users')
        .select('googleaccesstoken, googlerefreshtoken')
        .eq('id', userId)
        .single();

      if (user?.googleaccesstoken) {
        this.oauth2Client.setCredentials({
          access_token: user.googleaccesstoken,
          refresh_token: user.googlerefreshtoken
        });

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        // Stop the watch
        await calendar.channels.stop({
          requestBody: {
            id: channel.channel_id,
            resourceId: channel.resource_id
          }
        });

        console.log('✅ Calendar watch stopped');
      }

      // Remove from database
      await getSupabase()
        .from('calendar_watch_channels')
        .delete()
        .eq('user_id', userId);

    } catch (error) {
      console.error('❌ Error stopping calendar watch:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook notification from Google Calendar
   */
  async processWebhookNotification(headers, userId) {
    try {
      console.log('📥 Received Google Calendar webhook notification');

      const channelId = headers['x-goog-channel-id'];
      const resourceId = headers['x-goog-resource-id'];
      const resourceState = headers['x-goog-resource-state'];
      const resourceUri = headers['x-goog-resource-uri'];

      console.log('Webhook details:', {
        channelId,
        resourceId,
        resourceState,
        resourceUri
      });

      // Verify this is a valid channel
      const { data: channel } = await getSupabase()
        .from('calendar_watch_channels')
        .select('*')
        .eq('channel_id', channelId)
        .eq('resource_id', resourceId)
        .single();

      if (!channel) {
        console.warn('⚠️  Unknown webhook channel, ignoring');
        return { success: false, reason: 'Unknown channel' };
      }

      // Handle different resource states
      if (resourceState === 'sync') {
        console.log('📡 Sync message received (initial setup confirmation)');
        return { success: true, action: 'sync' };
      }

      if (resourceState === 'exists') {
        console.log('🔄 Calendar changed, syncing events...');
        
        // Fetch and sync the changed events
        await this.syncCalendarEvents(channel.user_id);
        
        return { success: true, action: 'synced' };
      }

      return { success: true, action: 'ignored' };
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Sync calendar events after receiving webhook notification
   */
  async syncCalendarEvents(userId) {
    try {
      console.log(`🔄 Syncing calendar events for user ${userId}...`);

      // Get user's Google tokens
      const { data: user } = await getSupabase()
        .from('users')
        .select('googleaccesstoken, googlerefreshtoken')
        .eq('id', userId)
        .single();

      if (!user?.googleaccesstoken) {
        throw new Error('User not authenticated');
      }

      this.oauth2Client.setCredentials({
        access_token: user.googleaccesstoken,
        refresh_token: user.googlerefreshtoken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Fetch recent events (last 30 days to future)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: thirtyDaysAgo.toISOString(),
        maxResults: 500,
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: true // Important: detect deleted events
      });

      const events = response.data.items || [];
      console.log(`📅 Found ${events.length} events to process`);

      let created = 0;
      let updated = 0;
      let deleted = 0;

      for (const event of events) {
        if (event.status === 'cancelled') {
          // Event was deleted
          const { error } = await getSupabase()
            .from('meetings')
            .update({ is_deleted: true, updatedat: new Date().toISOString() })
            .eq('googleeventid', event.id)
            .eq('userid', userId);

          if (!error) deleted++;
        } else {
          // Event is active - create or update
          const meetingData = this.transformEventToMeeting(event, userId);

          // Check if meeting exists
          const { data: existing } = await getSupabase()
            .from('meetings')
            .select('id')
            .eq('googleeventid', event.id)
            .eq('userid', userId)
            .single();

          if (existing) {
            // Update existing meeting
            const { error } = await getSupabase()
              .from('meetings')
              .update(meetingData)
              .eq('id', existing.id);

            if (!error) updated++;
          } else {
            // Create new meeting
            const { error } = await getSupabase()
              .from('meetings')
              .insert(meetingData);

            if (!error) created++;
          }
        }
      }

      console.log(`✅ Sync complete: ${created} created, ${updated} updated, ${deleted} deleted`);

      return { created, updated, deleted };
    } catch (error) {
      console.error('❌ Error syncing calendar events:', error);
      throw error;
    }
  }

  /**
   * Transform Google Calendar event to meeting database format
   */
  transformEventToMeeting(event, userId) {
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;

    return {
      userid: userId,
      googleeventid: event.id,
      title: event.summary || 'Untitled Meeting',
      starttime: startTime,
      endtime: endTime,
      location: event.location || null,
      description: event.description || null,
      meeting_source: 'google_calendar',
      synced_via_webhook: true,
      is_deleted: false,
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };
  }
}

module.exports = GoogleCalendarWebhookService;

