# 🚀 RECALL.AI WEBHOOK - NEXT STEPS

**Status:** Code deployed ✅  
**Commit:** `af18e6a`  
**Next:** Run database migration + verify

---

## ⚡ IMMEDIATE ACTIONS (5 minutes)

### 1️⃣ Run Database Migration
Go to **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy and paste:
```sql
-- Add payload column to recall_webhook_events
ALTER TABLE recall_webhook_events
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_event_type 
ON recall_webhook_events(event_type);

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recall_webhook_events' 
ORDER BY column_name;
```

Click **Run** and wait for success ✅

---

### 2️⃣ Verify Render Deployment
Go to **Render Dashboard** → Your Advicly service → **Logs**

Look for (should appear within 2-3 minutes):
```
✅ Recall V2 routes mounted successfully
```

If you see errors, check:
- `RECALL_WEBHOOK_SECRET` is set in Environment
- `RECALL_API_KEY` is set in Environment

---

### 3️⃣ Check Webhook Events Table
In Supabase SQL Editor, run:
```sql
SELECT 
  webhook_id,
  bot_id,
  event_type,
  status,
  created_at
FROM recall_webhook_events 
WHERE bot_id = '1135ddc6-6116-490b-a88e-1f2e2e737c23'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** You should see webhook events from your test meeting

---

## 🧪 TESTING (10 minutes)

### Test 1: Verify Webhook Payload Storage
```sql
SELECT 
  webhook_id,
  event_type,
  status,
  payload,
  created_at
FROM recall_webhook_events 
WHERE bot_id = '1135ddc6-6116-490b-a88e-1f2e2e737c23'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** `payload` column should contain JSON data like:
```json
{
  "status": "done"
}
```

---

### Test 2: Check Render Logs for Webhook Processing
In Render logs, search for:
```
📥 Received Recall webhook: transcript.done
📋 Full payload: { ... }
✅ Transcript retrieved. Length: 1234 characters
✅ Transcript stored for meeting 473
```

---

### Test 3: Verify Transcript in Database
```sql
SELECT 
  id,
  title,
  recall_bot_id,
  recall_status,
  transcript_source,
  LENGTH(transcript) as transcript_length,
  quick_summary
FROM meetings 
WHERE recall_bot_id = '1135ddc6-6116-490b-a88e-1f2e2e737c23';
```

**Expected:**
- `recall_status` = `'completed'`
- `transcript_source` = `'recall'`
- `transcript` = populated with text
- `quick_summary` = populated (if AI processing completed)

---

## 🔍 DEBUGGING CHECKLIST

If webhooks still aren't working:

### ❌ Problem: No webhook events in table
**Solution:**
1. Check Recall.ai dashboard → Webhooks → Activity
2. Look for your endpoint URL
3. Check error rate (should be 0%)
4. If errors, click on failed event to see error message

### ❌ Problem: "Invalid signature" errors in logs
**Solution:**
1. Verify `RECALL_WEBHOOK_SECRET` in Render environment
2. Go to Recall.ai dashboard → Settings → API Keys
3. Copy the webhook secret exactly
4. Update in Render environment variables
5. Redeploy

### ❌ Problem: "No meeting found for bot" errors
**Solution:**
1. Verify meeting exists in database:
   ```sql
   SELECT id, recall_bot_id FROM meetings WHERE id = 473;
   ```
2. Verify `recall_bot_id` matches webhook `bot_id`
3. If missing, the bot creation failed earlier

### ❌ Problem: Transcript not appearing
**Solution:**
1. Check if `transcript.done` webhook was received
2. Check Render logs for "Fetching transcript from Recall"
3. If error, check API key is correct
4. Verify bot has `recording_id` in Recall.ai dashboard

---

## 📊 MONITORING QUERIES

### Recent Webhook Events
```sql
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM recall_webhook_events 
GROUP BY event_type, status
ORDER BY latest DESC;
```

### Meetings with Recall Bots
```sql
SELECT 
  id,
  title,
  recall_bot_id,
  recall_status,
  transcript_source,
  CASE WHEN transcript IS NOT NULL THEN 'Yes' ELSE 'No' END as has_transcript,
  CASE WHEN quick_summary IS NOT NULL THEN 'Yes' ELSE 'No' END as has_summary,
  created_at
FROM meetings 
WHERE recall_bot_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

### Webhook Error Rate
```sql
SELECT 
  bot_id,
  event_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
  ROUND(100.0 * COUNT(CASE WHEN status = 'error' THEN 1 END) / COUNT(*), 1) as error_rate_percent
FROM recall_webhook_events 
GROUP BY bot_id, event_type
ORDER BY error_rate_percent DESC;
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Database migration ran successfully
- [ ] Render logs show "Recall V2 routes mounted successfully"
- [ ] Webhook events appear in `recall_webhook_events` table
- [ ] `payload` column contains JSON data
- [ ] Render logs show "Received Recall webhook" messages
- [ ] Transcript appears in meetings table
- [ ] Quick summary is generated
- [ ] Recall.ai dashboard shows 0% error rate

---

## 🎯 WHAT'S NEXT

Once everything is working:

1. **Test with a new meeting** to verify end-to-end flow
2. **Monitor webhook events** for 24 hours
3. **Check error logs** for any issues
4. **Verify frontend** displays transcripts and summaries

---

**Questions?** Check the logs! 🔍

