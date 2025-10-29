# ✅ Recall.ai Setup Checklist - Quick Start

## 🎯 Your Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Render Environment | ✅ READY | All env vars configured |
| Backend Routes | ✅ READY | All API endpoints working |
| Webhook Endpoint | ✅ READY | Configured in Recall dashboard |
| Database Schema | ⚠️ PENDING | Need to run migration |
| Test User | ⚠️ PENDING | Need to create |
| Test Meeting | ⚠️ PENDING | Need to create |

---

## 📋 STEP-BY-STEP SETUP

### STEP 1: Apply Database Migration (2 minutes)

**What:** Add Recall.ai columns to your database

**How:**
1. Go to **https://app.supabase.com** → Your project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy entire contents of `RECALL_COMPLETE_SETUP.sql`
5. Paste into the editor
6. Click **Run** (blue button)
7. Wait for success message

**Expected:** No errors, query completes successfully

---

### STEP 2: Verify Migration Worked (1 minute)

**What:** Confirm all columns were added

**How:**
1. Still in SQL Editor
2. Click **New Query**
3. Copy this single query:

```sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN (
  'recall_bot_id', 
  'recall_recording_id',
  'recall_status', 
  'recall_error',
  'transcript_source'
)
ORDER BY column_name;
```

4. Click **Run**

**Expected:** 5 rows returned with these columns:
- recall_bot_id (text)
- recall_error (text)
- recall_recording_id (text)
- recall_status (text)
- transcript_source (text)

**If you get 0 rows:** Migration didn't work. Run `RECALL_COMPLETE_SETUP.sql` again.

---

### STEP 3: Create Test User (3 minutes)

**What:** Create a user to test with

**How:**
1. Go to **https://adviceapp.pages.dev/register**
2. Click **Sign up with Email**
3. Fill in:
   - **Name:** Test User Recall
   - **Email:** testuser+recall@example.com
   - **Password:** TestPassword123!
4. Click **Sign Up**
5. Complete onboarding:
   - **Business Name:** Test Business
   - **Timezone:** Your timezone
6. Click **Next** through all steps
7. **Skip calendar setup** (click Next)
8. Click **Go to Dashboard**

**Expected:** You reach the Meetings page with "No meetings" message

---

### STEP 4: Create Google Meet (2 minutes)

**What:** Create a test meeting to record

**How:**
1. Open new tab: **https://meet.google.com**
2. Click **Create a meeting** or **Start an instant meeting**
3. Copy the meeting URL (e.g., `https://meet.google.com/abc-defg-hij`)
4. **Keep this tab open** - you'll join it soon

**Expected:** You have a meeting URL ready

---

### STEP 5: Trigger Recall Bot (1 minute)

**What:** Tell Recall.ai to join your meeting

**How:**
1. Go back to Advicly tab (Meetings page)
2. Open DevTools: Press **F12**
3. Click **Console** tab
4. Copy and paste this code:

```javascript
const token = localStorage.getItem('supabase.auth.token');
const accessToken = JSON.parse(token).access_token;
const meetingUrl = 'https://meet.google.com/abc-defg-hij'; // REPLACE WITH YOUR URL

fetch('https://adviceapp-9rgw.onrender.com/api/recall/schedule-bot', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ meeting_url: meetingUrl })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Bot created:', data);
  window.botId = data.botId;
})
.catch(err => console.error('❌ Error:', err));
```

5. Press **Enter**

**Expected:** Console shows:
```
✅ Bot created: {
  success: true,
  botId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  message: "Recall bot scheduled successfully"
}
```

---

### STEP 6: Join Meeting & Talk (2 minutes)

**What:** Have a conversation for the bot to record

**How:**
1. Go to your Google Meet tab
2. Click **Join now**
3. Allow camera/microphone
4. **Talk for 30-60 seconds** (say anything - the bot is recording)
5. Click **Leave** to end the meeting

**Expected:** Recall bot appears as a participant, then leaves when you do

---

### STEP 7: Check Transcript (2 minutes)

**What:** Verify transcript appears in Advicly

**How:**
1. Go back to Advicly Meetings page
2. **Wait 15 seconds** (processing time)
3. Refresh the page (F5)
4. Look for your test meeting
5. Click on it to see details

**Expected:** You see:
- ✅ Meeting title
- ✅ Transcript text
- ✅ Quick summary (if AI processing completed)

---

### STEP 8: Verify Webhook Events (1 minute)

**What:** Confirm Recall.ai sent webhook events

**How:**
1. Go to **Render Dashboard** → Your Advicly service
2. Click **Logs** tab
3. Look for messages like:
   ```
   📥 Received Recall webhook: bot.status_change
   📥 Received Recall webhook: transcript.done
   ✅ Transcript stored for meeting
   ```

**Expected:** You see webhook events in the logs

---

## ✅ SUCCESS CHECKLIST

- [ ] Database migration applied (RECALL_COMPLETE_SETUP.sql)
- [ ] Verification query returned 5 columns
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

| Problem | Solution |
|---------|----------|
| Verification query returns 0 rows | Run RECALL_COMPLETE_SETUP.sql again |
| "Recall API not configured" error | Check RECALL_API_KEY in Render environment |
| Bot doesn't join meeting | Verify meeting URL is correct and public |
| No transcript appears | Wait 15 seconds, then refresh page |
| Webhook events not in logs | Check webhook URL in Recall dashboard |

---

## 📞 Need Help?

If you get stuck:
1. Check the error message carefully
2. Review the troubleshooting table above
3. Check Render logs for backend errors
4. Check browser console (F12) for frontend errors

---

**Ready? Start with STEP 1!** 🚀

