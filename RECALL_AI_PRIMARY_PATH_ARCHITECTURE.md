# 🎯 Recall.ai PRIMARY Path Architecture

## Executive Summary

**Advicly's transcript and action items system is designed with Recall.ai as the PRIMARY path (99% of cases).**

- ✅ **PRIMARY (99%):** Recall.ai webhook automatically records meetings, generates transcripts, and extracts action items
- ⚠️ **FALLBACK (1%):** Manual transcript upload for edge cases

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADVICLY TRANSCRIPT SYSTEM                    │
└─────────────────────────────────────────────────────────────────┘

PRIMARY PATH (99% - Automatic)
═════════════════════════════════════════════════════════════════

1. Google Calendar Integration
   └─ User connects Google Calendar
   └─ Advicly has calendar read/write access

2. Meeting Scheduled
   └─ User creates meeting in Google Calendar
   └─ Meeting synced to Advicly database

3. Recall.ai Bot Joins (Automatic)
   └─ Recall.ai bot joins meeting automatically
   └─ No user action required
   └─ Bot records audio/video

4. Meeting Ends
   └─ Recall.ai processes recording
   └─ Generates transcript from audio

5. Webhook Fires (recall-webhooks.js)
   └─ Recall.ai sends "transcript.done" webhook
   └─ Backend receives webhook
   └─ Fetches transcript from Recall.ai API

6. AI Processing
   └─ OpenAI generates 4 summaries:
      • quick_summary (1 sentence)
      • detailed_summary (structured)
      • email_summary_draft (professional email)
      • action_points (bullet list)
   └─ Extracts action items as JSON array

7. Database Storage
   └─ Saves summaries to meetings table
   └─ Saves action items to pending_transcript_action_items
   └─ Sets transcript_source = 'recall'

8. User Review
   └─ User sees pending action items
   └─ Reviews and approves items
   └─ Approved items move to transcript_action_items

9. Display
   └─ Action Items page shows approved items
   └─ Meetings page shows summaries
   └─ Clients page shows quick summaries


FALLBACK PATH (1% - Manual)
═════════════════════════════════════════════════════════════════

1. Recall.ai Failed
   └─ Bot didn't record (network issue, etc.)
   └─ OR user has external transcript

2. Manual Upload
   └─ User clicks "Add Transcript"
   └─ Pastes or uploads transcript text
   └─ Clicks "Upload & Generate Summaries"

3. Backend Processing
   └─ Finds meeting by numeric ID
   └─ Updates transcript column
   └─ Sets transcript_source = 'manual'

4. AI Processing (Same as Primary)
   └─ Generates 4 summaries
   └─ Extracts action items

5. Rest of Flow (Same as Primary)
   └─ Saves to database
   └─ User reviews and approves
   └─ Items appear on Action Items page
```

---

## Code Implementation

### Primary Path: recall-webhooks.js

**File:** `backend/src/routes/recall-webhooks.js`

**Key Functions:**

1. **Webhook Receiver** (Line 612)
   ```javascript
   router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
     // Verifies SVIX signature
     // Parses Recall.ai webhook payload
     // Routes to appropriate handler
   });
   ```

2. **Transcript Fetcher** (Line 115)
   ```javascript
   async function fetchTranscriptFromRecall(botId) {
     // Calls Recall.ai API
     // Downloads transcript JSON
     // Parses transcript text
   }
   ```

3. **Transcript Handler** (Line 221)
   ```javascript
   async function handleTranscriptComplete(botId, data) {
     // Fetches transcript from Recall.ai
     // Generates 4 AI summaries
     // Extracts action items
     // Saves to database
   }
   ```

4. **Summary Generation** (Lines 317-391)
   ```javascript
   // Quick Summary (single sentence)
   const quickSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: quickSummaryPrompt });
   
   // Detailed Summary (structured)
   const detailedSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: detailedSummaryPrompt });
   
   // Email Summary (professional)
   const emailSummary = await generateMeetingSummary(transcriptText, 'standard', { prompt: autoTemplate });
   
   // Action Points (JSON array)
   const actionPointsResponse = await generateMeetingSummary(transcriptText, 'standard', { prompt: actionPointsPrompt });
   ```

5. **Database Save** (Lines 498-545)
   ```javascript
   // Save summaries to meetings table
   await supabase.from('meetings').update({
     quick_summary: quickSummary,
     detailed_summary: detailedSummary,
     email_summary_draft: emailSummary,
     action_points: actionPoints,
     last_summarized_at: new Date().toISOString()
   }).eq('id', meeting.id);
   
   // Save pending action items
   await supabase.from('pending_transcript_action_items').insert(actionItemsToInsert);
   ```

### Fallback Path: calendar.js

**File:** `backend/src/routes/calendar.js`

**Endpoint:** `POST /meetings/:meetingId/transcript` (Lines 1320-1492)

```javascript
// Find meeting by numeric ID (primary) or external_id (fallback)
const { data: meetingById } = await req.supabase
  .from('meetings')
  .select('*')
  .eq('id', parseInt(meetingId))
  .eq('user_id', userId)
  .single();

// Update transcript
await req.supabase.from('meetings').update({
  transcript: transcript,
  transcript_source: 'manual',
  updated_at: new Date().toISOString()
}).eq('id', existingMeeting.id);
```

---

## Database Schema

### meetings table
```sql
transcript TEXT                    -- Raw transcript text
quick_summary TEXT                 -- 1 sentence summary
detailed_summary TEXT              -- Structured summary
email_summary_draft TEXT           -- Email format
action_points TEXT                 -- Bullet list of actions
transcript_source TEXT             -- 'recall' or 'manual'
recall_bot_id TEXT UNIQUE          -- Recall.ai bot ID
recall_status TEXT                 -- 'pending', 'recording', 'completed'
last_summarized_at TIMESTAMP       -- When summaries were generated
```

### pending_transcript_action_items table
```sql
id UUID PRIMARY KEY
meeting_id INTEGER → meetings(id)
client_id UUID → clients(id)
advisor_id UUID → users(id)        -- ✅ UUID (multi-tenant safe)
action_text TEXT
priority INTEGER (1-4)
display_order INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
```

### transcript_action_items table
```sql
id UUID PRIMARY KEY
meeting_id INTEGER → meetings(id)
client_id UUID → clients(id)
advisor_id UUID → users(id)        -- ✅ UUID (multi-tenant safe)
action_text TEXT
priority INTEGER (1-4)
completed BOOLEAN
completed_at TIMESTAMP
display_order INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## Why Recall.ai is PRIMARY

1. **Automatic:** No user action required
2. **Reliable:** Recall.ai handles recording and transcription
3. **Scalable:** Works for all meetings with Google Calendar
4. **Consistent:** Same process for all users
5. **Professional:** High-quality transcripts and summaries
6. **Cost-effective:** Recall.ai handles infrastructure

---

## Why Manual Upload is FALLBACK

1. **Rare:** Only needed if Recall.ai fails
2. **Manual:** Requires user action
3. **Edge case:** External transcripts, manual meetings
4. **Backup:** Safety net for edge cases

---

## Monitoring & Logging

### Recall.ai Webhook Logs
```
✅ SVIX SIGNATURE VERIFICATION
✅ Signature verified successfully!
✅ Payload parsed
✅ New webhook (not a duplicate)
✅ Webhook event recorded
✅ Bot processing complete for {botId}
✅ Successfully saved summaries to database
✅ Saved {N} PENDING action items
```

### Manual Upload Logs
```
📝 Manual transcript upload for meeting {meetingId}
✅ Found meeting by numeric ID: {meetingId}
✅ Transcript updated for meeting {meetingId}
```

---

## Deployment Status

**Commit:** `390f965`
**Status:** ✅ Live on Render
**Last Updated:** 2025-10-31

---

## Next Steps

1. ✅ Verify Render deployment is live
2. ✅ Test Recall.ai webhook with real meeting
3. ✅ Test manual transcript upload (fallback)
4. ✅ Verify action items appear on Action Items page
5. ✅ Monitor Render logs for errors

