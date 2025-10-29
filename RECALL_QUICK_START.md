# ⚡ RECALL.AI QUICK START CHECKLIST

## 🎯 5-MINUTE SETUP

### Step 1: Get Credentials (2 min)
- [ ] Go to https://recall.ai/dashboard
- [ ] Settings → API Keys → Copy **API Key**
- [ ] Settings → Webhook Signing Secret → Copy **Secret**

### Step 2: Update .env (1 min)
Edit `backend/.env`:
```bash
RECALL_API_KEY=paste_your_api_key_here
RECALL_WEBHOOK_SECRET=paste_your_secret_here
BACKEND_URL=https://adviceapp-9rgw.onrender.com
```

### Step 3: Database Migration (1 min)
In Supabase SQL Editor, run:
```sql
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recall_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  bot_id TEXT NOT NULL,
  event_type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_bot_id ON recall_webhook_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_transcription_enabled 
ON calendar_connections(user_id, transcription_enabled);
```

### Step 4: Set Up Webhook (1 min)
In Recall Dashboard:
1. Webhooks → Endpoints → New Endpoint
2. URL: `https://adviceapp-9rgw.onrender.com/api/webhooks/webhook`
3. Subscribe to: `transcript.done`, `bot.status_change`, `recording.done`
4. Create

### Step 5: Deploy (0 min - auto)
```bash
git add .
git commit -m "feat: Recall.ai integration"
git push origin main
```

---

## ✅ VERIFY IT WORKS

### Test 1: Webhook Endpoint
```bash
curl https://adviceapp-9rgw.onrender.com/api/webhooks/webhook/test
```

### Test 2: Create Meeting
1. Sign in to Advicly
2. Connect Google Calendar
3. Create meeting with Google Meet link
4. Check logs: "Recall bot scheduled"

### Test 3: Check Database
```sql
SELECT * FROM recall_webhook_events LIMIT 5;
SELECT recall_bot_id, recall_status FROM meetings WHERE recall_bot_id IS NOT NULL LIMIT 5;
```

---

## 🎉 DONE!

Meetings will now automatically have:
- ✅ Recall bot joining
- ✅ Transcripts captured
- ✅ AI summaries generated
- ✅ Stored in database

---

## 📞 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Webhook not receiving | Check URL in Recall dashboard, verify credentials |
| Bot not scheduling | Verify `transcription_enabled=true`, check meeting has video URL |
| Transcript missing | Wait for meeting to end, check webhook events table |
| API errors | Verify `RECALL_API_KEY` and `RECALL_WEBHOOK_SECRET` are correct |

---

## 📚 FULL DOCS

See `RECALL_AI_SETUP_COMPLETE.md` for detailed setup and troubleshooting.

