# 🎯 Recall.ai Testing Setup - Complete Guide

## ✅ STEP 1: Verify Render Environment Variables

Your Render backend has these configured:
- ✅ `RECALL_API_KEY` = `0a7e9b81a6d5fb6912a1b44eefc287642fc82e25`
- ✅ `RECALL_WEBHOOK_SECRET` = `whsec_QfFDUm10d4BZ0c1JTaNnC+YHDwUHTXuf`
- ✅ `BACKEND_URL` = `https://adviceapp-9rgw.onrender.com`

**Status:** ✅ CORRECT

---

## ✅ STEP 2: Apply Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy and paste the entire contents of `RECALL_COMPLETE_SETUP.sql`
4. Click **Run**
5. Verify no errors appear

**What this does:**
- ✅ Adds `recall_bot_id`, `recall_status`, `recall_error`, `transcript_source` to meetings table
- ✅ Adds `transcription_enabled` to calendar_connections table
- ✅ Creates `recall_webhook_events` table for webhook tracking
- ✅ Creates performance indexes

---

## ✅ STEP 3: Verify Webhook Endpoint

1. Go to **https://recall.ai/dashboard** → **Webhooks → Endpoints**
2. Verify your endpoint exists:
   - **URL:** `https://adviceapp-9rgw.onrender.com/api/webhooks/webhook`
   - **Status:** Active ✅
   - **Subscribed events:** `transcript.done`, `bot.status_change`, `recording.done`

**Status:** ✅ ALREADY CONFIGURED

---

## 🚀 STEP 4: Create Test User & Meeting

### 4a. Create Test User
1. Go to **https://adviceapp.pages.dev/register**
2. Sign up with email:
   - **Email:** `testuser+recall@example.com`
   - **Password:** `TestPassword123!`
   - **Name:** Test User Recall
3. Complete onboarding:
   - **Business Name:** Test Business
   - **Timezone:** Your timezone
4. **Skip calendar setup** (click Next)
5. You should reach the **Meetings** page

### 4b. Create Test Meeting
1. Go to **https://meet.google.com**
2. Click **Create a meeting** or **Start an instant meeting**
3. Copy the meeting URL (e.g., `https://meet.google.com/abc-defg-hij`)
4. **Keep this tab open** - you'll join it in a moment

---

## 🤖 STEP 5: Trigger Recall Bot

Open browser DevTools (F12) → Console and run:

```javascript
// Get your auth token
const token = localStorage.getItem('supabase.auth.token');
const accessToken = JSON.parse(token).access_token;

// Your Google Meet URL
const meetingUrl = 'https://meet.google.com/abc-defg-hij'; // REPLACE THIS

// Trigger Recall bot
fetch('https://adviceapp-9rgw.onrender.com/api/recall/schedule-bot', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    meeting_url: meetingUrl
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Bot created:', data);
  window.botId = data.botId; // Save for later
})
.catch(err => console.error('❌ Error:', err));
```

**Expected response:**
```json
{
  "success": true,
  "botId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "message": "Recall bot scheduled successfully"
}
```

---

## 📞 STEP 6: Join Meeting & Talk

1. Go back to your Google Meet tab
2. Click **Join now**
3. **Allow camera/microphone**
4. You should see **Recall bot joining** as a participant
5. **Talk for 30-60 seconds** to generate transcript content
6. **End the meeting**

---

## 📊 STEP 7: Verify Transcript

### Option A: Check via API
```javascript
const botId = window.botId; // From Step 5

// Check bot status
fetch(`https://adviceapp-9rgw.onrender.com/api/recall/bot/${botId}`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
.then(r => r.json())
.then(data => console.log('Bot Status:', data))
.catch(err => console.error('Error:', err));

// Get transcript (wait 10-15 seconds after meeting ends)
setTimeout(() => {
  fetch(`https://adviceapp-9rgw.onrender.com/api/recall/transcript/${botId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  .then(r => r.json())
  .then(data => console.log('Transcript:', data))
  .catch(err => console.error('Error:', err));
}, 15000);
```

### Option B: Check in Advicly UI
1. Go to **Meetings** page
2. Look for your test meeting
3. You should see:
   - ✅ Meeting title
   - ✅ Transcript populated
   - ✅ Quick summary (if AI processing completed)

---

## 🔍 STEP 8: Monitor Webhook Events

1. Go to **Render Dashboard** → Your Advicly service → **Logs**
2. Look for messages like:
   ```
   📥 Received Recall webhook: bot.status_change for bot 3fa85f64...
   📥 Received Recall webhook: transcript.done for bot 3fa85f64...
   ✅ Transcript stored for meeting...
   ```

---

## ✅ SUCCESS CHECKLIST

- [ ] Database migration applied (RECALL_COMPLETE_SETUP.sql)
- [ ] Render environment variables verified
- [ ] Webhook endpoint configured in Recall dashboard
- [ ] Test user created
- [ ] Google Meet created
- [ ] Recall bot triggered via API
- [ ] Bot joined meeting
- [ ] Talked in meeting for 30+ seconds
- [ ] Meeting ended
- [ ] Transcript appears in Advicly UI
- [ ] Webhook events visible in Render logs

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Recall API not configured" | Check `RECALL_API_KEY` in Render environment |
| Bot doesn't join meeting | Verify meeting URL is correct and public |
| No transcript appears | Wait 15 seconds, check Render logs for errors |
| Webhook not received | Verify webhook URL in Recall dashboard |
| "Invalid signature" error | Check `RECALL_WEBHOOK_SECRET` matches Recall dashboard |

---

## 📝 Next Steps After Testing

Once testing is successful:
1. Enable transcription for your test user in Settings
2. Create meetings with Google Calendar integration
3. Bots will automatically join and record
4. Transcripts will populate automatically via webhooks

