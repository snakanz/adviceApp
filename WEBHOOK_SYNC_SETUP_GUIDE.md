# 🚀 Webhook-Based Calendar Sync - Setup Guide

## ✅ What's Been Implemented

Your Advicly platform now uses a **webhook-only, real-time synchronization system** for calendar events. Here's what changed:

### 🔴 **REMOVED: Polling/Scheduled Sync**
- ❌ 15-minute automatic sync scheduler (disabled)
- ❌ 5-minute frontend auto-refresh polling (disabled)
- ✅ Replaced with instant webhook-driven updates

### 🟢 **ADDED: Webhook-Based Sync**

#### 1. **Google Calendar Webhooks** (NEW!)
- Real-time push notifications from Google Calendar
- Automatic sync when events are created, updated, or deleted
- Watch API integration with channel management
- Database table: `calendar_watch_channels`

#### 2. **Enhanced Calendly Webhooks**
- Support for `invitee.created` (new bookings)
- Support for `invitee.canceled` (cancellations)
- Support for `invitee.updated` (rescheduled meetings) - NEW!
- Improved duplicate detection and handling

#### 3. **Frontend Smart Polling** (NEW!)
- Lightweight polling (30-second intervals) on all pages
- Only polls when page is visible (tab is active)
- Automatic refresh when switching back to tab
- Meetings page: Updates within 30 seconds of webhook
- Clients page: Updates within 30 seconds of webhook
- Pipeline page: Updates within 30 seconds of webhook
- No manual refresh needed!

---

## 📋 Setup Instructions

### Step 1: Create Database Table for Google Calendar Webhooks

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS calendar_watch_channels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMP NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS calendar_watch_channels_user_id_idx ON calendar_watch_channels(user_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_channel_id_idx ON calendar_watch_channels(channel_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_expiration_idx ON calendar_watch_channels(expiration);
```

**Supabase SQL Editor:** https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/sql/new

### Step 2: Set Up Google Calendar Webhooks

After authenticating with Google Calendar in your app:

```bash
# Call this endpoint to register the webhook
POST https://adviceapp-9rgw.onrender.com/api/calendar/webhook/setup
Authorization: Bearer YOUR_JWT_TOKEN
```

This will:
- Register a push notification channel with Google
- Store channel details in the database
- Start receiving real-time calendar updates

**Note:** Google Calendar watch channels expire after 7 days. You'll need to renew them periodically (we can add auto-renewal later).

### Step 3: Verify Calendly Webhooks

Your Calendly webhook should already be set up. Verify it's working:

```bash
# Test the webhook endpoint
GET https://adviceapp-9rgw.onrender.com/api/calendly/webhook/test
```

If you need to set up a new webhook:
1. Go to Calendly → Integrations → Webhooks
2. Create webhook with URL: `https://adviceapp-9rgw.onrender.com/api/calendly/webhook`
3. Subscribe to events:
   - `invitee.created`
   - `invitee.canceled`
   - `invitee.updated`
4. Add signing key to `.env`: `CALENDLY_WEBHOOK_SIGNING_KEY=your_key`

---

## 🎯 How It Works

### Google Calendar Flow
```
1. User creates/updates/deletes event in Google Calendar
   ↓
2. Google sends webhook notification to your backend
   ↓
3. Backend receives notification and syncs changed events
   ↓
4. Database is updated (meetings table)
   ↓
5. Frontend polls database every 30 seconds (when page is visible)
   ↓
6. Frontend automatically updates UI within 30 seconds
```

### Calendly Flow
```
1. Client books/cancels/reschedules meeting in Calendly
   ↓
2. Calendly sends webhook to your backend
   ↓
3. Backend creates/updates/deletes meeting in database
   ↓
4. Frontend polls database every 30 seconds (when page is visible)
   ↓
5. Frontend automatically updates UI within 30 seconds
```

---

## 🧪 Testing

### Test Google Calendar Webhook

1. Authenticate with Google Calendar in Advicly
2. Set up the webhook (Step 3 above)
3. Create a test event in Google Calendar
4. Watch Render logs for webhook notification
5. Check Advicly - meeting should appear instantly!

### Test Calendly Webhook

1. Book a test meeting in Calendly
2. Watch Render logs for webhook notification
3. Check Advicly - meeting should appear within 1-2 seconds!
4. Cancel the meeting in Calendly
5. Check Advicly - meeting should be marked as deleted instantly!

### Test Frontend Real-time Updates

1. Open Advicly in two browser windows
2. Create/update a meeting in one window
3. Watch the other window update automatically!

---

## 📊 Monitoring

### Backend Logs (Render)

Watch for these log messages:

**Google Calendar:**
```
📥 Received Google Calendar webhook notification
🔄 Syncing calendar events for user 1...
✅ Sync complete: X created, Y updated, Z deleted
```

**Calendly:**
```
📥 Received Calendly webhook: invitee.created
✅ Meeting created from webhook: [Meeting Title]
```

**Frontend:**
```
📡 Setting up real-time subscription for meetings...
📥 Real-time meeting change detected: INSERT
```

### Database Monitoring

Check these tables in Supabase:

- `meetings` - Should update instantly when webhooks fire
- `calendar_watch_channels` - Should have one row per user
- `calendly_webhook_events` - Logs all Calendly webhook events

---

## 🔧 Troubleshooting

### Google Calendar Webhook Not Working

**Check:**
1. Is the watch channel registered? Query `calendar_watch_channels` table
2. Has the channel expired? Check `expiration` column
3. Are webhook notifications reaching your backend? Check Render logs
4. Is the webhook URL accessible? Test: `https://adviceapp-9rgw.onrender.com/api/calendar/webhook/test`

**Fix:**
```bash
# Re-register the webhook
POST /api/calendar/webhook/setup
```

### Calendly Webhook Not Working

**Check:**
1. Is the webhook configured in Calendly dashboard?
2. Is the signing key correct in `.env`?
3. Are notifications reaching your backend? Check Render logs

**Fix:**
- Verify webhook URL in Calendly settings
- Check `CALENDLY_WEBHOOK_SIGNING_KEY` environment variable

### Frontend Not Updating

**Check:**
1. Is the page visible (not in background tab)?
2. Are there any console errors in browser?
3. Is the user authenticated?
4. Check browser console for polling logs

**Fix:**
- Switch to the Advicly tab to trigger immediate refresh
- Check browser console for errors
- Verify JWT token is valid
- Wait up to 30 seconds for next poll

---

## 🎉 Benefits

### Before (Heavy Polling)
- ⏰ Updates every 5 minutes (even when no changes)
- 🔄 Constant API calls (expensive)
- 📊 Stale data between syncs
- 🐌 Slow user experience

### After (Webhook + Smart Polling)
- ⚡ Updates within 30 seconds of webhook firing
- 💰 Minimal API calls (only when page is visible)
- 📊 Near-real-time data (30-second max delay)
- 🚀 Fast, efficient user experience
- 🔋 Battery-friendly (no polling when tab is hidden)

---

## 📝 Next Steps

1. ✅ Create `calendar_watch_channels` table in Supabase
2. ✅ Set up Google Calendar webhook after authentication
3. ✅ Verify Calendly webhook is working
4. ✅ Test the system end-to-end
5. 🔄 (Optional) Add auto-renewal for Google Calendar watch channels
6. 🔄 (Optional) Add webhook health monitoring/alerts
7. 🔄 (Optional) Reduce polling interval to 15 seconds for faster updates

---

## 🆘 Support

If you encounter any issues:

1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify database tables exist and have correct permissions
4. Test webhook endpoints manually
5. Check Supabase Realtime is enabled

**Render Logs:** https://dashboard.render.com/web/srv-cujqvqm8ii6s73e5rvog/logs

**Supabase Dashboard:** https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx

---

## ✨ Summary

Your Advicly platform now has a **modern, webhook-driven synchronization system** that:

- ✅ Updates within 30 seconds when calendar events change
- ✅ Eliminates unnecessary polling (only polls when page is visible)
- ✅ Provides a near-real-time user experience
- ✅ Scales efficiently with minimal resource usage
- ✅ Battery-friendly (no background polling)

Enjoy your new webhook-based calendar sync! 🎉

