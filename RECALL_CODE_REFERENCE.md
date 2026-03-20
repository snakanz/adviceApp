# 📚 RECALL.AI CODE REFERENCE

Quick reference for all Recall.ai integration code.

---

## 🔑 Environment Variables

```bash
# backend/.env
RECALL_API_KEY=your_api_key_here
RECALL_WEBHOOK_SECRET=your_webhook_secret_here
BACKEND_URL=https://adviceapp-9rgw.onrender.com
```

---

## 🗄️ Database Schema

```sql
-- Add to calendar_connections
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN DEFAULT FALSE;

-- Create webhook tracking table
CREATE TABLE IF NOT EXISTS recall_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  bot_id TEXT NOT NULL,
  event_type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_bot_id ON recall_webhook_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_transcription_enabled 
ON calendar_connections(user_id, transcription_enabled);
```

---

## 🔌 API Endpoints

### Webhook Endpoint
```
POST /api/webhooks/webhook
Headers: x-recall-signature: <hmac-sha256-signature>
Body: {
  "id": "webhook_event_id",
  "bot_id": "bot_123",
  "event_type": "transcript.done",
  "data": { ... }
}
```

### Toggle Transcription
```
PATCH /api/calendar-connections/:id/toggle-transcription
Headers: Authorization: Bearer <token>
Body: { "transcription_enabled": true }
```

### Schedule Bot
```
POST /api/recall/schedule-bot
Headers: Authorization: Bearer <token>
Body: {
  "meetingId": "meeting_123",
  "meetingUrl": "https://meet.google.com/abc-def-ghi"
}
```

### Get Bot Status
```
GET /api/recall/bot/:botId
Headers: Authorization: Bearer <token>
```

### Get Transcript
```
GET /api/recall/transcript/:botId
Headers: Authorization: Bearer <token>
```

---

## 🎯 Frontend Integration

### Toggle Component
```jsx
<input
  type="checkbox"
  id={`transcription-${connection.id}`}
  checked={connection.transcription_enabled || false}
  onChange={(e) => handleToggleTranscription(connection.id, e.target.checked)}
  className="w-4 h-4 rounded border-gray-300 text-blue-600"
/>
<label htmlFor={`transcription-${connection.id}`} className="text-xs">
  🎙️ Auto-record with Recall.ai
</label>
```

### Toggle Handler
```javascript
const handleToggleTranscription = async (connectionId, enabled) => {
  try {
    const token = await getAccessToken();
    await axios.patch(
      `${API_BASE_URL}/api/calendar-connections/${connectionId}/toggle-transcription`,
      { transcription_enabled: enabled },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSuccess(`✅ Transcription ${enabled ? 'enabled' : 'disabled'}`);
    loadConnections();
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to update');
    loadConnections();
  }
};
```

---

## 🧪 Testing

### Test Webhook Endpoint
```bash
curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test
```

### Send Test Event from Recall
1. Go to Recall Dashboard → Webhooks → Activity
2. Click "Send Test Event"
3. Check backend logs

### Create Test Meeting
1. Sign in to Advicly
2. Connect Google Calendar
3. Create meeting with Google Meet
4. Check logs for "Recall bot scheduled"

### Verify Transcript
```sql
SELECT id, title, transcript, recall_status, transcript_source 
FROM meetings 
WHERE recall_bot_id IS NOT NULL 
LIMIT 1;
```

---

## 📊 Monitoring Queries

### Recent Webhook Events
```sql
SELECT * FROM recall_webhook_events 
ORDER BY created_at DESC LIMIT 20;
```

### Meetings with Recall Bots
```sql
SELECT id, title, recall_bot_id, recall_status, transcript_source, transcript 
FROM meetings 
WHERE recall_bot_id IS NOT NULL 
ORDER BY created_at DESC LIMIT 20;
```

### Transcription Settings
```sql
SELECT user_id, provider, transcription_enabled, is_active 
FROM calendar_connections 
ORDER BY created_at DESC;
```

### Failed Bots
```sql
SELECT * FROM recall_webhook_events 
WHERE event_type = 'bot.status_change' AND status = 'error' 
ORDER BY created_at DESC;
```

---

## 🔐 Security

### Webhook Signature Verification
```javascript
const crypto = require('crypto');

function verifyRecallWebhookSignature(payload, signature, apiKey) {
  const hash = crypto
    .createHmac('sha256', apiKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}
```

### RLS Policy (Automatic)
- All meetings are scoped to `user_id`
- Webhooks use service role (admin access)
- User endpoints use authenticated user context

---

## 🚀 Deployment

### Pre-Deployment
```bash
# Verify all files exist
ls backend/src/routes/recall-*.js
ls src/components/CalendarSettings.js

# Check environment variables
grep RECALL backend/.env
```

### Deploy
```bash
git add .
git commit -m "feat: Recall.ai integration"
git push origin main
```

### Post-Deployment
```bash
# Check logs
# Verify routes mounted
# Test webhook endpoint
# Send test event
```

---

## 📞 Troubleshooting

### Enable Debug Logging
```javascript
// In webhook handler
console.log('📥 Received webhook:', req.body);
console.log('🔐 Signature:', req.headers['x-recall-signature']);
console.log('✅ Verified:', verifyRecallWebhookSignature(...));
```

### Check Database Connection
```sql
SELECT COUNT(*) FROM recall_webhook_events;
SELECT COUNT(*) FROM calendar_connections WHERE transcription_enabled = true;
```

### Verify API Key
```bash
# Test Recall API directly
curl -H "Authorization: Token YOUR_API_KEY" \
  https://api.recall.ai/api/v1/bot/
```

---

## 📚 Resources

- Recall.ai Docs: https://docs.recall.ai
- Webhook Reference: https://docs.recall.ai/reference/webhooks-overview
- Bot API: https://docs.recall.ai/reference/bot_create
- Transcript API: https://docs.recall.ai/reference/transcript_get

