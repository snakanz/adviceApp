# Action Items Priority Workflow Implementation

## Overview
This implementation adds priority selection to the pending action items approval workflow, allowing users to set priorities BEFORE approving action items rather than after.

---

## 🎯 Key Changes

### 1. Database Schema Updates

#### Migration 018: Add Priority to Pending Table
**File:** `backend/migrations/018_add_pending_priority.sql`

Adds a `priority` column to the `pending_transcript_action_items` table:
- Type: INTEGER (1-4)
- Default: 3 (Medium)
- Constraint: CHECK (priority BETWEEN 1 AND 4)
- Index: For faster filtering

#### Migration 019: Move Approved Items Back to Pending
**File:** `backend/migrations/019_move_approved_to_pending.sql`

One-time migration that:
- Moves all **incomplete** action items from `transcript_action_items` back to `pending_transcript_action_items`
- Preserves existing priority values
- Keeps completed items in `transcript_action_items` for historical record
- Logs count of moved items

---

### 2. Backend API Updates

#### Modified Endpoint: Approve Action Items
**Route:** `POST /api/transcript-action-items/approve`
**File:** `backend/src/routes/transcriptActionItems.js`

**Changes:**
- Now preserves the `priority` field when moving items from pending to approved
- Priority is carried over from `pending_transcript_action_items` to `transcript_action_items`

**Request:**
```json
{
  "pendingItemIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "approvedCount": 3,
  "actionItems": [...]
}
```

#### New Endpoint: Update Pending Item Priority
**Route:** `PATCH /api/transcript-action-items/pending/:pendingItemId/priority`
**File:** `backend/src/routes/transcriptActionItems.js`

**Purpose:** Update the priority of a single pending action item

**Request:**
```json
{
  "priority": 1  // 1=Urgent, 2=High, 3=Medium, 4=Low
}
```

**Response:**
```json
{
  "success": true,
  "pendingItem": {
    "id": "uuid",
    "action_text": "Follow up with client",
    "priority": 1,
    ...
  }
}
```

**Validation:**
- Priority must be between 1 and 4
- User must own the pending item (advisor_id check)

---

### 3. Frontend Updates

#### Action Items Page (`src/pages/ActionItems.js`)

**New State:**
```javascript
const [pendingItemPriorities, setPendingItemPriorities] = useState({}); // { itemId: priority }
```

**New Function:**
```javascript
const updatePendingItemPriority = async (itemId, priority) => {
  // Calls PATCH endpoint to update priority
  // Updates local state immediately for responsive UI
}
```

**Modified Function:**
```javascript
const fetchPendingApprovalItems = async () => {
  // Now initializes pendingItemPriorities state with existing priorities
  // Default to 3 (Medium) if not set
}
```

**UI Changes:**
- Added priority dropdown to each pending action item
- Dropdown shows: 🔴 Urgent, 🟠 High, 🟡 Medium, 🟢 Low
- Priority is saved immediately when changed (no need to click save)
- Priority persists when user navigates away and comes back

**Visual Layout:**
```
┌─────────────────────────────────────────────────┐
│ ☑ Follow up with client about pension transfer │
│   Priority: [🟡 Medium ▼]                       │
└─────────────────────────────────────────────────┘
```

#### Meetings Page (`src/pages/Meetings.js`)

**Same changes as Action Items page:**
- Added `pendingItemPriorities` state
- Added `updatePendingItemPriority` function
- Modified `fetchPendingActionItems` to initialize priorities
- Added priority dropdown to each pending item in meeting detail view
- Imported Select components

---

## 🔄 Complete Workflow

### Step 1: Transcript Upload
1. User uploads a transcript
2. AI extracts action items
3. Action items are saved to `pending_transcript_action_items` with default priority = 3 (Medium)

### Step 2: Review & Prioritize
User can review pending items in two places:

**Option A: Action Items Page → "Pending Approval" Tab**
- See all pending items across all meetings
- Grouped by client and meeting
- Set priority for each item using dropdown
- Select which items to approve/reject

**Option B: Meetings Page → Meeting Detail View**
- See pending items for specific meeting
- Set priority for each item using dropdown
- Select which items to approve/reject

### Step 3: Set Priorities
- User clicks priority dropdown for each item
- Selects: Urgent (1), High (2), Medium (3), or Low (4)
- Priority is saved immediately to database
- No "Save" button needed - instant update

### Step 4: Approve Items
- User selects items to approve (checkboxes)
- Clicks "Approve Selected" button
- Items are moved from `pending_transcript_action_items` to `transcript_action_items`
- **Priority is preserved** during the move

### Step 5: Manage Approved Items
- Approved items appear in "Action Items" tab
- Can be filtered by priority
- Can be sorted by priority or date
- Can use AI to re-prioritize if needed
- Can edit inline
- Can mark as complete

---

## 🎨 Priority Levels

| Priority | Label  | Icon | Color  | Use Case                          |
|----------|--------|------|--------|-----------------------------------|
| 1        | Urgent | 🔴   | Red    | Immediate action required         |
| 2        | High   | 🟠   | Orange | Important, needs attention soon   |
| 3        | Medium | 🟡   | Yellow | Standard priority (default)       |
| 4        | Low    | 🟢   | Green  | Can be done when time permits     |

---

## 📋 Migration Instructions

### Step 1: Add Priority Column to Pending Table
```sql
-- Run in Supabase SQL Editor
-- File: backend/migrations/018_add_pending_priority.sql

ALTER TABLE pending_transcript_action_items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4);

COMMENT ON COLUMN pending_transcript_action_items.priority IS 'User-selected priority level before approval: 1=Urgent, 2=High, 3=Medium, 4=Low';

CREATE INDEX IF NOT EXISTS idx_pending_transcript_action_items_priority ON pending_transcript_action_items(priority);
```

### Step 2: Move Approved Items Back to Pending
```sql
-- Run in Supabase SQL Editor
-- File: backend/migrations/019_move_approved_to_pending.sql

-- Insert all incomplete approved items back into pending
INSERT INTO pending_transcript_action_items (
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    priority,
    created_at
)
SELECT 
    meeting_id,
    client_id,
    advisor_id,
    action_text,
    display_order,
    COALESCE(priority, 3) as priority,
    created_at
FROM transcript_action_items
WHERE completed = false
ON CONFLICT DO NOTHING;

-- Delete moved items from approved table
DELETE FROM transcript_action_items WHERE completed = false;
```

**Note:** Completed items are preserved in `transcript_action_items` for historical record.

---

## ✅ Testing Checklist

### Backend Testing
- [ ] Run migration 018 successfully
- [ ] Run migration 019 successfully
- [ ] Verify `pending_transcript_action_items` has `priority` column
- [ ] Verify incomplete items moved from `transcript_action_items` to `pending_transcript_action_items`
- [ ] Test PATCH `/pending/:id/priority` endpoint
- [ ] Test POST `/approve` endpoint preserves priority

### Frontend Testing - Action Items Page
- [ ] Navigate to Action Items → Pending Approval tab
- [ ] Verify pending items show priority dropdowns
- [ ] Change priority of an item - verify it saves
- [ ] Refresh page - verify priority persists
- [ ] Approve items - verify they appear in Action Items tab with correct priority
- [ ] Verify priority badges show correct colors

### Frontend Testing - Meetings Page
- [ ] Navigate to a meeting with pending items
- [ ] Verify pending items show priority dropdowns
- [ ] Change priority - verify it saves
- [ ] Approve items - verify they move to approved section with correct priority

### Integration Testing
- [ ] Upload a new transcript
- [ ] Verify action items appear in pending with default priority = 3
- [ ] Set different priorities for different items
- [ ] Approve some items, reject others
- [ ] Verify approved items have correct priorities
- [ ] Use AI priority assignment on approved items
- [ ] Verify it can re-prioritize items

---

## 🔧 Files Modified

### Backend
- `backend/migrations/018_add_pending_priority.sql` (NEW)
- `backend/migrations/019_move_approved_to_pending.sql` (NEW)
- `backend/src/routes/transcriptActionItems.js` (MODIFIED)
  - Line 707-716: Modified approve endpoint to preserve priority
  - Line 754-798: Added update pending priority endpoint

### Frontend
- `src/pages/ActionItems.js` (MODIFIED)
  - Line 48: Added `pendingItemPriorities` state
  - Line 163-201: Modified `fetchPendingApprovalItems` to initialize priorities
  - Line 238-268: Added `updatePendingItemPriority` function
  - Line 489-521: Added `priorityOptions` constant
  - Line 863-904: Updated pending items UI with priority dropdowns

- `src/pages/Meetings.js` (MODIFIED)
  - Line 48: Added Select component import
  - Line 52-58: Added `priorityOptions` constant
  - Line 314: Added `pendingItemPriorities` state
  - Line 1183-1192: Modified `fetchPendingActionItems` to initialize priorities
  - Line 1202-1233: Added `updatePendingItemPriority` function
  - Line 2503-2544: Updated pending items UI with priority dropdowns

---

## 🎉 Benefits

1. **Better Workflow:** Users set priority BEFORE approval, not after
2. **Clearer Intent:** Priority reflects user's assessment during review
3. **No Re-work:** Don't need to go back and prioritize after approval
4. **Flexible:** Can still use AI to re-prioritize approved items if needed
5. **Consistent:** Same priority selection UI in both Action Items and Meetings pages
6. **Instant Feedback:** Priority saves immediately when changed
7. **Data Preservation:** Existing priorities are preserved during migration

---

## 🚀 Deployment Status

- ✅ Backend migrations created
- ✅ Backend API updated
- ✅ Frontend Action Items page updated
- ✅ Frontend Meetings page updated
- ⏳ Awaiting database migration execution
- ⏳ Awaiting deployment

---

## 📝 Next Steps

1. Run migration 018 in Supabase SQL Editor
2. Run migration 019 in Supabase SQL Editor
3. Deploy backend changes to Render
4. Deploy frontend changes to Cloudflare Pages
5. Test the complete workflow
6. Verify all existing functionality still works

