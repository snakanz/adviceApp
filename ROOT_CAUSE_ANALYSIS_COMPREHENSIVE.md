# Comprehensive Root Cause Analysis: Advicly Platform Issues

**Date**: November 1, 2025  
**User**: Amelia Test (testamelia314@gmail.com, user_id: 9e031204-9367-4449-a75a-5cf429615db0)  
**Backend Status**: ✅ Running (health check passed)

---

## PROBLEM 1: Client Email Addresses Not Displaying on Meeting Cards

### Root Cause Analysis

**PRIMARY ISSUE**: Attendees field is NULL for existing meetings

**Evidence**:
- User's SQL data shows `attendees: null` for all meetings
- Google Calendar webhook fix (commit `ec1c1d2`) added attendees capture to `transformEventToMeeting()` function
- **BUT**: This fix only applies to NEW meetings synced AFTER deployment
- Existing meetings synced BEFORE the fix have `attendees: null` permanently

**Data Flow Breakdown**:

```
Google Calendar Event
    ↓
Google Calendar Webhook (googleCalendarWebhook.js:430-447)
    ↓
transformEventToMeeting() - NOW includes attendees field ✅
    ↓
meetings table - attendees column populated ✅ (for NEW meetings only)
    ↓
Frontend Meeting Card (Meetings.js:1773-1789)
    ↓
Parses attendees JSON and displays email ✅ (IF attendees exists)
```

**Why Existing Meetings Show "No client"**:
1. Existing meetings have `attendees: null` (synced before fix)
2. Frontend tries to parse: `JSON.parse(null)` → throws error
3. Error caught silently (line 1791: `catch (e) { return null; }`)
4. No client info displayed

### Debugging Steps

**Step 1: Check if attendees are populated**
```sql
-- For user 9e031204-9367-4449-a75a-5cf429615db0
SELECT id, title, attendees, created_at 
FROM meetings 
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
ORDER BY created_at DESC 
LIMIT 10;

-- Expected: attendees should be JSON array like: [{"email":"snaka1003@gmail.com",...}]
-- Actual: attendees is NULL for old meetings
```

**Step 2: Check webhook deployment**
```bash
# Verify commit ec1c1d2 is deployed
curl https://adviceapp-9rgw.onrender.com/api/health
# Should show recent deployment timestamp
```

**Step 3: Check if new meetings have attendees**
```sql
-- Check meetings created AFTER webhook fix deployment
SELECT id, title, attendees, created_at 
FROM meetings 
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND created_at > '2025-11-01 13:00:00'
ORDER BY created_at DESC;
```

### Solution

**Option A: Backfill Existing Meetings (Recommended)**
```sql
-- Fetch from Google Calendar API and update attendees
-- This requires calling Google Calendar API for each meeting's external_id
-- See: backend/src/services/calendar.js - getMeetingDetails()
```

**Option B: Manual Re-sync**
1. Delete existing meetings from database
2. Create new meetings in Google Calendar
3. Webhook will sync with attendees populated

**Option C: Frontend Fallback (Temporary)**
- Already implemented in Meetings.js (lines 1753-1769)
- Shows linked client if available
- Falls back to attendees if no linked client

---

## PROBLEM 2: Action Items System 500 Errors

### Root Cause Analysis

**THREE SEPARATE ISSUES**:

#### Issue 2A: `/api/transcript-action-items/pending/all` - 500 Error

**Location**: `backend/src/routes/transcriptActionItems.js:630-722`

**Root Cause**: Relationship join failure

```javascript
// Line 641-656: Joining with meetings and clients
const { data: pendingItems, error } = await req.supabase
  .from('pending_transcript_action_items')
  .select(`
    *,
    meeting:meetings!inner(  // ← !inner means REQUIRED relationship
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
  .eq('advisor_id', userId)
```

**Why It Fails**:
- `!inner` means meeting MUST exist for each pending item
- If `meeting_id` references non-existent meeting → 500 error
- OR if foreign key constraint broken → 500 error

**Debugging**:
```sql
-- Check for orphaned pending items
SELECT p.id, p.meeting_id, m.id as meeting_exists
FROM pending_transcript_action_items p
LEFT JOIN meetings m ON p.meeting_id = m.id
WHERE p.advisor_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND m.id IS NULL;  -- These are orphaned!
```

#### Issue 2B: `/api/transcript-action-items/action-items/by-client` - 500 Error

**Location**: `backend/src/routes/transcriptActionItems.js:336-447`

**Same Root Cause**: Relationship join failure with `!inner`

```javascript
// Line 346-361: Same issue
let query = req.supabase
  .from('transcript_action_items')
  .select(`
    *,
    meeting:meetings!inner(...),  // ← Fails if meeting doesn't exist
    client:clients(...)
  `)
  .eq('advisor_id', userId);
```

#### Issue 2C: `/api/calendar/meetings/starred` - 500 Error

**Location**: `backend/src/routes/calendar.js:1572-1626`

**Root Cause**: Incorrect relationship name

```javascript
// Line 1590: Wrong relationship name
client:clients (  // ← Should be client:clients (singular)
  id, name, email
)
```

**But wait** - the code shows `client:clients` which is correct. Let me check the actual error...

**Actual Issue**: The endpoint tries to fetch ALL meetings, not just starred ones!

```javascript
// Line 1596-1597: Missing filter for starred/annual_review
.eq('user_id', userId)
.order('starttime', { ascending: false });
// ← No filter for annual_review = true!
```

### Database Schema Issues

**Schema Mismatch Found**:

| Table | Migration 012/013 | Clean Schema Files | Actual DB |
|-------|-------------------|-------------------|-----------|
| `transcript_action_items.advisor_id` | UUID ✅ | UUID ✅ | ? |
| `pending_transcript_action_items.advisor_id` | UUID ✅ | UUID ✅ | ? |
| Column name | `action_text` | `action_item_text` | ? |

### Debugging Steps

**Step 1: Verify table schemas**
```sql
-- Check transcript_action_items
\d transcript_action_items;
-- Verify: advisor_id is UUID, action_text exists

-- Check pending_transcript_action_items
\d pending_transcript_action_items;
-- Verify: advisor_id is UUID, action_text exists
```

**Step 2: Check for orphaned records**
```sql
-- Orphaned pending items
SELECT COUNT(*) FROM pending_transcript_action_items p
LEFT JOIN meetings m ON p.meeting_id = m.id
WHERE m.id IS NULL;

-- Orphaned action items
SELECT COUNT(*) FROM transcript_action_items t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE m.id IS NULL;
```

**Step 3: Verify RLS policies**
```sql
SELECT * FROM pg_policies 
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items');
-- Should show: advisor_id = auth.uid()
```

### Solutions

**Fix 1: Remove `!inner` from relationships**
```javascript
// Change from:
meeting:meetings!inner(...)
// To:
meeting:meetings(...)
```

**Fix 2: Add annual_review filter to starred endpoint**
```javascript
.eq('annual_review', true)  // Add this filter
```

**Fix 3: Clean up orphaned records**
```sql
DELETE FROM pending_transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);

DELETE FROM transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);
```

---

## Deployment Status

- ✅ Backend running (health check passed)
- ✅ Commits deployed: ec1c1d2, 1e9c4c7, cfcf592
- ⏳ Frontend deploying (Cloudflare Pages)
- ⚠️ Existing meetings need backfill for attendees


