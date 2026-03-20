# Complete Issue Summary and Fixes - Advicly Platform

**User**: Amelia Test (testamelia314@gmail.com)  
**User ID**: 9e031204-9367-4449-a75a-5cf429615db0  
**Date**: November 1, 2025

---

## EXECUTIVE SUMMARY

Two critical issues preventing the platform from working:

1. **Client emails not displaying on meeting cards** - Existing meetings have `attendees: NULL`
2. **Action items endpoints returning 500 errors** - Orphaned records + bad relationship joins

---

## PROBLEM 1: Client Emails Not Displaying

### What's Happening
- Meeting cards should show client email (e.g., "snaka1003@gmail.com")
- Instead showing "No client" or blank
- Frontend code is correct and ready to display emails
- **Root cause**: `attendees` field is NULL in database for existing meetings

### Why It's NULL
1. Google Calendar webhook fix (commit `ec1c1d2`) added attendees capture
2. **BUT** this only applies to NEW meetings synced AFTER the fix deployed
3. Existing meetings synced BEFORE the fix have `attendees: NULL` permanently
4. Frontend tries to parse NULL → error → displays nothing

### Frontend Code (Already Correct)
**File**: `src/pages/Meetings.js`

Lines 1773-1789 (meeting card display):
```javascript
if (meeting.attendees) {
  try {
    const attendees = JSON.parse(meeting.attendees);
    const clientAttendee = attendees.find(a => a.email && a.email !== user?.email);
    if (clientAttendee) {
      return (
        <div className="flex items-center gap-1 text-xs">
          <Mail className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
          <span className="font-medium text-muted-foreground truncate">
            {clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0]}
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="text-muted-foreground/80 truncate">
            {clientAttendee.email}
          </span>
        </div>
      );
    }
  } catch (e) {
    return null;
  }
}
```

### Backend Code (Already Fixed)
**File**: `backend/src/services/googleCalendarWebhook.js`

Line 442 (webhook sync):
```javascript
transformEventToMeeting(event, userId) {
  // ... other fields ...
  return {
    user_id: userId,
    external_id: event.id,
    title: event.summary || 'Untitled Meeting',
    starttime: startTime,
    endtime: endTime,
    location: event.location || null,
    description: event.description || null,
    attendees: JSON.stringify(event.attendees || []),  // ✅ FIXED - captures attendees
    meeting_source: 'google',
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
```

### Solution: Backfill Existing Meetings
Need to fetch attendees from Google Calendar API and update database for existing meetings.

---

## PROBLEM 2: Action Items 500 Errors

### What's Happening
Three endpoints returning 500 errors:
- `GET /api/transcript-action-items/pending/all`
- `GET /api/transcript-action-items/action-items/by-client`
- `GET /api/calendar/meetings/starred`

### Root Cause: `!inner` Relationship Joins

**File**: `backend/src/routes/transcriptActionItems.js`

**5 locations with `!inner` joins** (lines 194, 350, 464, 544, 645):

```javascript
// CURRENT CODE (BROKEN):
const { data: pendingItems, error } = await req.supabase
  .from('pending_transcript_action_items')
  .select(`
    *,
    meeting:meetings!inner(  // ← !inner = REQUIRED relationship
      id, title, starttime, googleeventid
    ),
    client:clients(
      id, name, email
    )
  `)
  .eq('advisor_id', userId)
```

**Why It Fails**:
- `!inner` means meeting MUST exist for each action item
- If any action item has orphaned `meeting_id` → 500 error
- Orphaned records exist from previous data migrations

### Database Schema (Correct)
**File**: `backend/migrations/012_transcript_action_items.sql`

```sql
CREATE TABLE transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- ✅ UUID
    action_text TEXT NOT NULL,  -- ✅ Correct column name
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy (Correct)
CREATE POLICY "Transcript action items for own advisor" ON transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());
```

**File**: `backend/migrations/013_pending_transcript_action_items.sql`

```sql
CREATE TABLE pending_transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- ✅ UUID
    action_text TEXT NOT NULL,  -- ✅ Correct column name
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy (Correct)
CREATE POLICY "Pending transcript action items for own advisor" ON pending_transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());
```

---

## THE FIXES NEEDED

### Fix 1: Remove `!inner` from 5 locations

**File**: `backend/src/routes/transcriptActionItems.js`

Change all 5 occurrences of:
```javascript
meeting:meetings!inner(
```

To:
```javascript
meeting:meetings(
```

**Locations**:
- Line 194 (approve endpoint)
- Line 350 (action-items/by-client endpoint)
- Line 464 (action-items/by-client endpoint - second query)
- Line 544 (action-items/by-client endpoint - third query)
- Line 645 (pending/all endpoint)

### Fix 2: Add annual_review filter

**File**: `backend/src/routes/calendar.js`

Line 1596-1597, change:
```javascript
.eq('user_id', userId)
.order('starttime', { ascending: false });
```

To:
```javascript
.eq('user_id', userId)
.eq('is_annual_review', true)  // ← ADD THIS LINE
.order('starttime', { ascending: false });
```

### Fix 3: Clean up orphaned records

Run this SQL:
```sql
-- Delete orphaned pending items
DELETE FROM pending_transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);

-- Delete orphaned action items
DELETE FROM transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);
```

---

## VERIFICATION QUERIES

### Check attendees population
```sql
SELECT COUNT(*) as meetings_with_attendees
FROM meetings
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND attendees IS NOT NULL;
```

### Check for orphaned records
```sql
SELECT COUNT(*) as orphaned_pending
FROM pending_transcript_action_items p
LEFT JOIN meetings m ON p.meeting_id = m.id
WHERE m.id IS NULL;

SELECT COUNT(*) as orphaned_action_items
FROM transcript_action_items t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE m.id IS NULL;
```

### Verify RLS policies
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items');
```

---

## DEPLOYMENT CHECKLIST

- [ ] Apply Fix 1: Remove `!inner` from 5 locations in transcriptActionItems.js
- [ ] Apply Fix 2: Add is_annual_review filter in calendar.js
- [ ] Run Fix 3: Clean up orphaned records (SQL)
- [ ] Commit and push to main
- [ ] Verify Render deployment
- [ ] Test endpoints return 200 OK
- [ ] Backfill attendees for existing meetings (separate task)


