# Prioritized Fixes and Implementation Steps

---

## PRIORITY 1: Fix Action Items 500 Errors (CRITICAL)

### Issue: Orphaned Records Causing Relationship Join Failures

**Files to Fix**:
- `backend/src/routes/transcriptActionItems.js` (2 locations)
- `backend/src/routes/calendar.js` (1 location)

### Fix 1A: Remove `!inner` from pending items endpoint

**File**: `backend/src/routes/transcriptActionItems.js`  
**Line**: ~641-656

**Current Code**:
```javascript
const { data: pendingItems, error } = await req.supabase
  .from('pending_transcript_action_items')
  .select(`
    *,
    meeting:meetings!inner(
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
```

**Fixed Code**:
```javascript
const { data: pendingItems, error } = await req.supabase
  .from('pending_transcript_action_items')
  .select(`
    *,
    meeting:meetings(
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
```

**Why**: `!inner` requires meeting to exist. Removing it allows NULL meetings (graceful fallback).

---

### Fix 1B: Remove `!inner` from action items endpoint

**File**: `backend/src/routes/transcriptActionItems.js`  
**Line**: ~346-361

**Current Code**:
```javascript
let query = req.supabase
  .from('transcript_action_items')
  .select(`
    *,
    meeting:meetings!inner(
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
```

**Fixed Code**:
```javascript
let query = req.supabase
  .from('transcript_action_items')
  .select(`
    *,
    meeting:meetings(
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
```

---

### Fix 1C: Add annual_review filter to starred meetings

**File**: `backend/src/routes/calendar.js`  
**Line**: ~1596-1597

**Current Code**:
```javascript
.eq('user_id', userId)
.order('starttime', { ascending: false });
```

**Fixed Code**:
```javascript
.eq('user_id', userId)
.eq('annual_review', true)
.order('starttime', { ascending: false });
```

---

### Fix 1D: Clean up orphaned records

**SQL to run**:
```sql
-- Delete orphaned pending items
DELETE FROM pending_transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);

-- Delete orphaned action items
DELETE FROM transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);

-- Verify cleanup
SELECT 
  'pending_orphaned' as check_type,
  COUNT(*) as count
FROM pending_transcript_action_items p
LEFT JOIN meetings m ON p.meeting_id = m.id
WHERE m.id IS NULL

UNION ALL

SELECT 
  'action_items_orphaned' as check_type,
  COUNT(*) as count
FROM transcript_action_items t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE m.id IS NULL;
```

**Expected Result**: Both counts should be 0

---

## PRIORITY 2: Backfill Attendees for Existing Meetings

### Issue: Existing meetings have `attendees: NULL`

**Root Cause**: Meetings synced before webhook fix (commit ec1c1d2) don't have attendees

**Solution**: Fetch from Google Calendar API and update database

### Implementation Steps

**Step 1: Create migration script**

**File**: `backend/src/scripts/backfill-attendees.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

async function backfillAttendees() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get all meetings with NULL attendees
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, external_id, user_id, attendees')
    .is('attendees', null)
    .eq('meeting_source', 'google');

  if (error) {
    console.error('Error fetching meetings:', error);
    return;
  }

  console.log(`Found ${meetings.length} meetings to backfill`);

  for (const meeting of meetings) {
    try {
      // Get calendar token for user
      const { data: token } = await supabase
        .from('calendar_connections')
        .select('access_token')
        .eq('user_id', meeting.user_id)
        .eq('provider', 'google')
        .single();

      if (!token) {
        console.log(`No token for user ${meeting.user_id}`);
        continue;
      }

      // Fetch event from Google Calendar
      const calendar = google.calendar({ version: 'v3' });
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: meeting.external_id,
        auth: token.access_token
      });

      // Update meeting with attendees
      const attendees = JSON.stringify(event.data.attendees || []);
      await supabase
        .from('meetings')
        .update({ attendees })
        .eq('id', meeting.id);

      console.log(`✅ Updated meeting ${meeting.id}`);
    } catch (err) {
      console.error(`❌ Error updating meeting ${meeting.id}:`, err.message);
    }
  }

  console.log('Backfill complete!');
}

backfillAttendees();
```

**Step 2: Run the script**
```bash
cd backend
node src/scripts/backfill-attendees.js
```

**Step 3: Verify**
```sql
SELECT COUNT(*) as meetings_with_attendees
FROM meetings
WHERE attendees IS NOT NULL
AND user_id = '9e031204-9367-4449-a75a-5cf429615db0';
```

---

## PRIORITY 3: Verify Database Schema Consistency

### Check 1: Verify column types
```sql
-- Check advisor_id is UUID (not INTEGER)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('transcript_action_items', 'pending_transcript_action_items')
AND column_name = 'advisor_id';

-- Expected: data_type = 'uuid'
```

### Check 2: Verify action_text column exists
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('transcript_action_items', 'pending_transcript_action_items')
AND column_name LIKE 'action%';

-- Expected: action_text (not action_item_text)
```

### Check 3: Verify RLS policies
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items');

-- Expected: qual should contain "advisor_id = auth.uid()"
```

---

## PRIORITY 4: Test End-to-End Workflow

### Test 1: Create pending action item
```bash
curl -X POST "https://adviceapp-9rgw.onrender.com/api/transcript-action-items/create" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": 475,
    "action_text": "Test action item",
    "priority": 2
  }'
```

**Expected**: 200 OK with created item

---

### Test 2: Fetch pending items
```bash
curl -X GET "https://adviceapp-9rgw.onrender.com/api/transcript-action-items/pending/all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 OK with pending items

---

### Test 3: Approve action item
```bash
curl -X POST "https://adviceapp-9rgw.onrender.com/api/transcript-action-items/approve" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pending_ids": ["PENDING_ITEM_ID"]
  }'
```

**Expected**: 200 OK with approved items

---

## Implementation Order

1. **First**: Run SQL cleanup (Fix 1D) - removes orphaned records
2. **Second**: Apply code fixes (Fix 1A, 1B, 1C) - removes `!inner` and adds filter
3. **Third**: Deploy to Render - backend redeploy
4. **Fourth**: Verify database schema (Priority 3)
5. **Fifth**: Run backfill script (Priority 2) - populates attendees
6. **Sixth**: Test end-to-end workflow (Priority 4)

---

## Deployment Checklist

- [ ] SQL cleanup executed
- [ ] Code fixes applied to 3 locations
- [ ] Commit created and pushed
- [ ] Render backend redeployed
- [ ] Database schema verified
- [ ] Backfill script executed
- [ ] End-to-end tests passed
- [ ] Frontend verified showing client emails


