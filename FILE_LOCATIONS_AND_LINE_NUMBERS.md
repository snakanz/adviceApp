# File Locations and Line Numbers - Quick Reference

---

## PROBLEM 1: Client Emails Not Displaying

### Frontend Display Logic (Already Correct ✅)

**File**: `src/pages/Meetings.js`

| Location | Lines | Purpose |
|----------|-------|---------|
| extractAttendees() | 101-124 | Parse attendees JSON from meeting |
| AttendeeAvatars component | 154-199 | Display attendee avatars with tooltips |
| Meeting card display | 1529-1540 | Show client info from attendees |
| Meeting card fallback | 1773-1789 | Fallback to attendees if no linked client |
| Calendar view | 2130-2131 | Extract attendees for calendar display |
| Meeting detail panel | 2311-2322 | Show client email in detail view |
| Ask Advicly context | 2477-2495 | Extract client info for Ask Advicly |
| Summary section | 2935-2954 | Get client info from linked client or attendees |

### Backend Webhook (Already Fixed ✅)

**File**: `backend/src/services/googleCalendarWebhook.js`

| Location | Lines | Purpose |
|----------|-------|---------|
| transformEventToMeeting() | 430-447 | Transform Google Calendar event to meeting format |
| attendees field | 442 | **FIXED**: Now captures attendees JSON |

---

## PROBLEM 2: Action Items 500 Errors

### File 1: transcriptActionItems.js - 5 Locations to Fix

**File**: `backend/src/routes/transcriptActionItems.js`

| Location | Lines | Endpoint | Fix |
|----------|-------|----------|-----|
| 1 | 194 | POST /approve | Remove !inner |
| 2 | 350 | GET /action-items/by-client | Remove !inner |
| 3 | 464 | GET /action-items/by-client (2nd query) | Remove !inner |
| 4 | 544 | GET /action-items/by-client (3rd query) | Remove !inner |
| 5 | 645 | GET /pending/all | Remove !inner |

**Pattern to find**:
```javascript
meeting:meetings!inner(
```

**Replace with**:
```javascript
meeting:meetings(
```

### File 2: calendar.js - 1 Location to Fix

**File**: `backend/src/routes/calendar.js`

| Location | Lines | Endpoint | Fix |
|----------|-------|----------|-----|
| 1 | 1596-1597 | GET /meetings/starred | Add is_annual_review filter |

**Current code** (line 1596-1597):
```javascript
.eq('user_id', userId)
.order('starttime', { ascending: false });
```

**Add this line** after `.eq('user_id', userId)`:
```javascript
.eq('is_annual_review', true)
```

---

## Database Schema (Already Correct ✅)

### File 1: transcript_action_items table

**File**: `backend/migrations/012_transcript_action_items.sql`

| Item | Lines | Status |
|------|-------|--------|
| Table definition | 9-21 | ✅ Correct |
| advisor_id column | 13 | ✅ UUID (correct) |
| action_text column | 14 | ✅ Correct name |
| RLS policy | 34-36 | ✅ advisor_id = auth.uid() |
| Indexes | 24-28 | ✅ All present |

### File 2: pending_transcript_action_items table

**File**: `backend/migrations/013_pending_transcript_action_items.sql`

| Item | Lines | Status |
|------|-------|--------|
| Table definition | 9-19 | ✅ Correct |
| advisor_id column | 13 | ✅ UUID (correct) |
| action_text column | 14 | ✅ Correct name |
| RLS policy | 31-33 | ✅ advisor_id = auth.uid() |
| Indexes | 22-25 | ✅ All present |

---

## SQL Cleanup Query

**Location**: Run in Supabase SQL Editor

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

---

## Verification Queries

**Location**: Run in Supabase SQL Editor

### Query 1: Check attendees population
```sql
SELECT COUNT(*) as meetings_with_attendees
FROM meetings
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND attendees IS NOT NULL;
```

### Query 2: Check for orphaned records
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

### Query 3: Verify RLS policies
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items');
```

---

## API Endpoints to Test

### Endpoint 1: Pending action items
```
GET /api/transcript-action-items/pending/all
```
**File**: `backend/src/routes/transcriptActionItems.js` line 630-722

### Endpoint 2: Action items by client
```
GET /api/transcript-action-items/action-items/by-client
```
**File**: `backend/src/routes/transcriptActionItems.js` line 336-447

### Endpoint 3: Starred meetings
```
GET /api/calendar/meetings/starred
```
**File**: `backend/src/routes/calendar.js` line 1572-1626

---

## Documentation Files Created

| File | Purpose | Key Sections |
|------|---------|--------------|
| COMPLETE_ISSUE_SUMMARY_AND_FIXES.md | Executive summary | Problems, solutions, fixes |
| EXACT_CODE_CHANGES_NEEDED.md | Implementation guide | Before/after code for all changes |
| ROOT_CAUSE_ANALYSIS_COMPREHENSIVE.md | Technical deep dive | Root causes, data flows, debugging |
| DEBUGGING_COMMANDS_AND_SQL_QUERIES.md | Verification | 10 SQL queries, API tests |
| PRIORITIZED_FIXES_AND_IMPLEMENTATION.md | Implementation plan | Priority order, deployment checklist |
| DOCUMENTATION_INDEX.md | Navigation | Index of all documents |
| VISUAL_SUMMARY.txt | Quick reference | ASCII summary of all issues |
| FILE_LOCATIONS_AND_LINE_NUMBERS.md | This file | File locations and line numbers |

---

## Quick Navigation

### To understand the issues:
- Read: COMPLETE_ISSUE_SUMMARY_AND_FIXES.md
- Reference: ROOT_CAUSE_ANALYSIS_COMPREHENSIVE.md

### To verify the issues:
- Run: DEBUGGING_COMMANDS_AND_SQL_QUERIES.md

### To fix the issues:
- Follow: EXACT_CODE_CHANGES_NEEDED.md
- Reference: FILE_LOCATIONS_AND_LINE_NUMBERS.md (this file)

### To implement everything:
- Follow: PRIORITIZED_FIXES_AND_IMPLEMENTATION.md

---

## Summary

**Total files to modify**: 2
- `backend/src/routes/transcriptActionItems.js` (5 locations)
- `backend/src/routes/calendar.js` (1 location)

**Total SQL queries to run**: 1 cleanup + 3 verification

**Total API endpoints to test**: 3

**Estimated time**: 30 minutes for code fixes + deployment


