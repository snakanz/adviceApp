# 🔔 Push Notifications Setup Guide

This guide will help you set up push notifications for the Advicly platform.

## 📋 Prerequisites

1. **Database constraint update** (from previous setup):
   ```sql
   ALTER TABLE meetings 
   DROP CONSTRAINT IF EXISTS meetings_meeting_source_check;
   
   ALTER TABLE meetings 
   ADD CONSTRAINT meetings_meeting_source_check 
   CHECK (meeting_source IN ('google', 'manual', 'outlook', 'calendly'));
   ```

## 🔧 Setup Steps

### 1. Generate VAPID Keys

Run this command to generate VAPID keys for push notifications:

```bash
cd backend && node generate-vapid-keys.js
```

This will output environment variables that you need to add to your `.env` files.

### 2. Update Backend Environment Variables

Add these to your `backend/.env` file:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_EMAIL=mailto:simon@greenwood.co.nz
```

### 3. Update Frontend Environment Variables

Add this to your frontend `.env` file (root directory):

```env
REACT_APP_VAPID_PUBLIC_KEY=your_public_key_here
```

### 4. Run Database Migration

Execute the push notifications migration in your Supabase SQL editor:

```sql
-- Copy and paste the contents of backend/migrations/005_push_notifications.sql
```

This creates:
- `push_subscriptions` table
- `notification_preferences` table  
- `notification_log` table
- Helper functions for managing notifications

### 5. Test the Setup

1. **Start the backend**:
   ```bash
   cd backend && npm start
   ```

2. **Start the frontend**:
   ```bash
   npm start
   ```

3. **Navigate to Settings** and test notifications:
   - Go to `/settings`
   - Enable push notifications
   - Send a test notification
   - Check that you receive the notification

## 🎯 Features Implemented

### ✅ Core Functionality
- **Service Worker**: Handles background notifications and offline caching
- **Push Subscription Management**: Subscribe/unsubscribe from notifications
- **Notification Preferences**: Granular control over notification types
- **Backend Service**: Send notifications via web-push API
- **Database Integration**: Store subscriptions and preferences

### ✅ Notification Types
- **Meeting Reminders**: 15 min, 1 hour, 1 day before meetings
- **Meeting Summaries**: When AI summaries are ready
- **Client Updates**: New clients and client changes
- **Ask Advicly**: AI response notifications
- **Test Notifications**: For testing the system

### ✅ UI Components
- **NotificationSettings**: Complete settings interface
- **Permission Management**: Request/manage browser permissions
- **Preference Controls**: Toggle switches for all notification types
- **Status Indicators**: Visual feedback for subscription status

## 🔄 API Endpoints

### Push Notification Routes (`/api/notifications/`)

- `POST /subscribe` - Subscribe to push notifications
- `POST /unsubscribe` - Unsubscribe from notifications
- `GET /status` - Get subscription status
- `GET /preferences` - Get notification preferences
- `PUT /preferences` - Update notification preferences
- `POST /test` - Send test notification
- `GET /history` - Get notification history
- `POST /meeting-reminder/:meetingId` - Send meeting reminder

## 🧪 Testing

### Manual Testing
1. Enable notifications in Settings
2. Use "Send Test Notification" button
3. Test meeting reminders with `/api/notifications/meeting-reminder/:meetingId`

### Browser Testing
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Limited support (iOS 16.4+)
- **Mobile**: Works on Android, limited on iOS

## 🔒 Security & Privacy

- **VAPID Keys**: Secure authentication for push messages
- **User Consent**: Explicit permission required
- **Data Privacy**: Only stores necessary subscription data
- **Secure Storage**: Subscriptions tied to user accounts

## 🚀 Future Enhancements

### Planned Features
- **Smart Scheduling**: AI-powered optimal notification timing
- **Rich Notifications**: Images, action buttons, progress indicators
- **Email Fallback**: Send emails when push notifications fail
- **Batch Notifications**: Group related notifications
- **Analytics**: Track notification engagement

### Integration Opportunities
- **Calendar Sync**: Auto-schedule reminders for new meetings
- **Client Pipeline**: Notifications for pipeline changes
- **Ask Advicly**: Real-time chat notifications
- **Meeting Transcripts**: Notify when transcripts are ready

## 🐛 Troubleshooting

### Common Issues

1. **"Notifications not supported"**
   - Check browser compatibility
   - Ensure HTTPS (required for push notifications)
   - Verify service worker registration

2. **"Permission denied"**
   - User blocked notifications
   - Reset in browser settings: Site Settings > Notifications

3. **"Subscription failed"**
   - Check VAPID keys are correct
   - Verify backend is running
   - Check network connectivity

4. **"No notifications received"**
   - Check notification preferences
   - Verify subscription is active
   - Test with manual test notification

### Debug Commands

```bash
# Check service worker registration
console.log(await navigator.serviceWorker.getRegistrations());

# Check notification permission
console.log(Notification.permission);

# Check push subscription
console.log(await registration.pushManager.getSubscription());
```

## 📊 Monitoring

The system logs all notification attempts in the `notification_log` table:
- Delivery status tracking
- Error logging
- Performance metrics
- User engagement data

## 🎉 Ready to Use!

Once setup is complete, users will be able to:
- ✅ Receive meeting reminders
- ✅ Get notified when AI summaries are ready
- ✅ Stay updated on client changes
- ✅ Receive Ask Advicly responses
- ✅ Customize all notification preferences
- ✅ Test the system anytime

The push notification system is now fully integrated with your Advicly platform!
