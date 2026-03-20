# 🔧 RECALL.AI TECHNICAL IMPLEMENTATION GUIDE

---

## 1. RECALL.AI BOT CREATION SERVICE

```javascript
// backend/src/services/recallAiService.js
const axios = require('axios');
const { getSupabase } = require('../lib/supabase');

class RecallAiService {
  constructor() {
    this.apiKey = process.env.RECALL_AI_API_KEY;
    this.baseUrl = 'https://us-west-2.recall.ai/api/v1';
    this.webhookUrl = `${process.env.BACKEND_URL}/api/recall/webhook`;
  }

  /**
   * Create a bot to record a meeting
   */
  async createBot(meetingUrl, options = {}) {
    try {
      const response = await axios.post(`${this.baseUrl}/bot/`, {
        meeting_url: meetingUrl,
        recording_config: {
          transcript: {
            provider: {
              meeting_captions: {} // FREE transcription
            }
          }
        },
        ...options
      }, {
        headers: { Authorization: this.apiKey }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating Recall bot:', error.message);
      throw error;
    }
  }

  /**
   * Get bot status and transcript
   */
  async getBot(botId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bot/${botId}/`,
        { headers: { Authorization: this.apiKey } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching bot:', error.message);
      throw error;
    }
  }

  /**
   * Download transcript
   */
  async downloadTranscript(downloadUrl) {
    try {
      const response = await axios.get(downloadUrl);
      return response.data; // Array of speaker segments
    } catch (error) {
      console.error('Error downloading transcript:', error.message);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', this.apiKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    return hash === signature;
  }
}

module.exports = RecallAiService;
```

---

## 2. MEETING AUTO-JOIN LOGIC

```javascript
// backend/src/services/meetingAutoJoin.js
const RecallAiService = require('./recallAiService');
const { getSupabase } = require('../lib/supabase');

class MeetingAutoJoinService {
  /**
   * Extract meeting URL from calendar event
   */
  extractMeetingUrl(event) {
    // Google Meet
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints
        .find(ep => ep.entryPointType === 'video');
      if (videoEntry) return videoEntry.uri;
    }

    // Zoom/Teams/Webex in location or description
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = (event.location || event.description || '').match(urlRegex) || [];
    
    for (const url of urls) {
      if (url.includes('zoom.us') || url.includes('teams.microsoft.com') ||
          url.includes('webex.com') || url.includes('meet.google.com')) {
        return url;
      }
    }

    return null;
  }

  /**
   * Auto-join meeting when it starts
   */
  async autoJoinMeeting(userId, meeting) {
    try {
      const meetingUrl = this.extractMeetingUrl(meeting);
      
      if (!meetingUrl) {
        console.log(`⚠️ No meeting URL found for ${meeting.title}`);
        return { success: false, reason: 'no_url' };
      }

      // Create bot
      const recallService = new RecallAiService();
      const bot = await recallService.createBot(meetingUrl, {
        metadata: {
          user_id: userId,
          meeting_id: meeting.id,
          meeting_title: meeting.title
        }
      });

      // Store bot info
      await getSupabase()
        .from('meetings')
        .update({
          recall_bot_id: bot.id,
          recall_status: 'recording'
        })
        .eq('id', meeting.id);

      console.log(`✅ Bot created for meeting: ${bot.id}`);
      return { success: true, botId: bot.id };
    } catch (error) {
      console.error('Error auto-joining meeting:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MeetingAutoJoinService;
```

---

## 3. RECALL WEBHOOK HANDLER

```javascript
// backend/src/routes/recall.js
const express = require('express');
const router = express.Router();
const RecallAiService = require('../services/recallAiService');
const { getSupabase } = require('../lib/supabase');

/**
 * Recall.ai webhook endpoint
 * Called when bot finishes recording
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-recall-signature'];
    const recallService = new RecallAiService();

    // ✅ CRITICAL: Verify webhook signature
    if (!recallService.verifyWebhookSignature(req.body, signature)) {
      console.error('❌ Invalid Recall webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { id: webhookId, bot_id, status } = req.body;

    // ✅ Prevent duplicate processing
    const { data: existing } = await getSupabase()
      .from('recall_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (existing) {
      console.log('⏭️ Webhook already processed');
      return res.json({ received: true });
    }

    // Record webhook event
    await getSupabase()
      .from('recall_webhook_events')
      .insert({ webhook_id: webhookId, bot_id, status });

    // Handle different statuses
    if (status === 'done') {
      await handleRecordingComplete(bot_id);
    } else if (status === 'error') {
      await handleRecordingError(bot_id, req.body.error);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: true }); // Always return 200
  }
});

/**
 * Handle completed recording
 */
async function handleRecordingComplete(botId) {
  try {
    const recallService = new RecallAiService();
    const bot = await recallService.getBot(botId);
    const recording = bot.recordings[0];

    if (!recording?.media_shortcuts?.transcript) {
      console.warn('⚠️ No transcript found');
      return;
    }

    // Download transcript
    const transcriptData = await recallService
      .downloadTranscript(recording.media_shortcuts.transcript.data.download_url);

    // Convert to text
    const transcriptText = transcriptData
      .map(segment => `${segment.participant.name}: ${segment.words.map(w => w.text).join(' ')}`)
      .join('\n\n');

    // Update meeting
    const { data: meeting } = await getSupabase()
      .from('meetings')
      .select('id, user_id')
      .eq('recall_bot_id', botId)
      .single();

    if (meeting) {
      await getSupabase()
        .from('meetings')
        .update({
          transcript: transcriptText,
          recall_status: 'completed',
          recall_recording_id: recording.id
        })
        .eq('id', meeting.id);

      console.log(`✅ Transcript saved for meeting ${meeting.id}`);
    }
  } catch (error) {
    console.error('Error handling recording complete:', error);
  }
}

/**
 * Handle recording error
 */
async function handleRecordingError(botId, errorMsg) {
  try {
    const { data: meeting } = await getSupabase()
      .from('meetings')
      .select('id, user_id')
      .eq('recall_bot_id', botId)
      .single();

    if (meeting) {
      await getSupabase()
        .from('meetings')
        .update({
          recall_status: 'error',
          recall_error: errorMsg
        })
        .eq('id', meeting.id);

      console.error(`❌ Recording error for meeting ${meeting.id}: ${errorMsg}`);
    }
  } catch (error) {
    console.error('Error handling recording error:', error);
  }
}

module.exports = router;
```

---

## 4. DATABASE SCHEMA ADDITIONS

```sql
-- Add Recall.ai columns to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS (
  recall_bot_id TEXT UNIQUE,
  recall_recording_id TEXT,
  recall_status TEXT DEFAULT 'pending' CHECK (recall_status IN ('pending', 'recording', 'completed', 'error')),
  recall_error TEXT,
  transcript_provider TEXT DEFAULT 'meeting_captions' CHECK (transcript_provider IN ('meeting_captions', 'recall_ai'))
);

-- Track webhook events for deduplication
CREATE TABLE IF NOT EXISTS recall_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  bot_id TEXT NOT NULL,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track transcription costs
CREATE TABLE IF NOT EXISTS transcription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  meeting_id SERIAL REFERENCES meetings(id) ON DELETE CASCADE,
  transcription_hours DECIMAL(10,2),
  cost_usd DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. ENVIRONMENT VARIABLES

```bash
# .env
RECALL_AI_API_KEY=your_api_key_here
RECALL_AI_WEBHOOK_SECRET=your_webhook_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Billing
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PROFESSIONAL=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
```

---

## 6. ROUTE MOUNTING

```javascript
// backend/src/index.js
// Add to route mounting section
app.use('/api/recall', require('./routes/recall'));
console.log('✅ Recall.ai routes mounted');
```

---

## 7. TESTING CHECKLIST

- [ ] Test bot creation with valid meeting URL
- [ ] Test bot creation with invalid URL (should fail gracefully)
- [ ] Test webhook signature verification
- [ ] Test duplicate webhook handling
- [ ] Test transcript download and parsing
- [ ] Test error handling (bot kicked out, captions disabled)
- [ ] Test with Stripe test mode
- [ ] Test webhook retries
- [ ] Load test with 100+ concurrent meetings

---

## 8. MONITORING & ALERTS

```javascript
// Track key metrics
const metrics = {
  botsCreated: 0,
  botsSuccessful: 0,
  botsFailed: 0,
  transcriptsCaptured: 0,
  transcriptsCost: 0,
  webhookErrors: 0
};

// Alert on failures
if (botsFailed > 10) {
  await sendAlert('High bot failure rate detected');
}
```

---

**Next:** Implement Stripe billing in STRIPE_IMPLEMENTATION.md

