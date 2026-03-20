# Action Items Technical Reference - November 1, 2025

## 🔧 Problem Analysis

### Root Cause: Supabase Relationship Queries
All endpoints were using Supabase's relationship query syntax:
```javascript
.select('*, client:clients(...), meeting:meetings(...)')
```

**Why this failed:**
- PGRST200 error: "Could not find a relationship between tables"
- Supabase relationship queries require:
  1. Foreign key constraint to exist
  2. Relationship properly defined in schema
  3. No orphaned records
- Our schema had FKs but Supabase couldn't find them in schema cache

---

## ✅ Solution Pattern

### Step 1: Remove Relationship Queries
```javascript
// BEFORE (broken)
.select('*, client:clients(...), meeting:meetings(...)')

// AFTER (fixed)
.select('*')
```

### Step 2: Fetch Related Data Separately
```javascript
// Fetch meetings
const meetingIds = [...new Set(items.map(i => i.meeting_id))];
const { data: meetings } = await req.supabase
  .from('meetings')
  .select('id, title, starttime, external_id')
  .in('id', meetingIds);

// Fetch clients
const clientIds = [...new Set(items.map(i => i.client_id).filter(Boolean))];
const { data: clients } = await req.supabase
  .from('clients')
  .select('id, name, email')
  .in('id', clientIds);
```

### Step 3: Build Maps for Association
```javascript
const meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
const clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
```

### Step 4: Use Maps in Response Formatting
```javascript
const formattedItems = items.map(item => ({
  id: item.id,
  actionText: item.action_text,
  meeting: {
    id: item.meeting_id,
    title: meetingsMap[item.meeting_id]?.title || 'Unknown',
    startTime: meetingsMap[item.meeting_id]?.starttime || null
  },
  client: clientsMap[item.client_id] ? {
    id: clientsMap[item.client_id].id,
    name: clientsMap[item.client_id].name
  } : null
}));
```

---

## 📋 Endpoints Fixed

### 1. GET `/pending/all`
- **What it does**: Fetch all pending action items for advisor
- **Fixed**: Removed client/meeting relationships
- **Lines**: 640-720 in transcriptActionItems.js

### 2. GET `/action-items/by-client`
- **What it does**: Fetch action items grouped by client
- **Fixed**: Removed client/meeting relationships
- **Lines**: 345-437 in transcriptActionItems.js

### 3. GET `/action-items/all`
- **What it does**: Fetch all action items (not grouped)
- **Fixed**: Removed client/meeting relationships
- **Lines**: 469-562 in transcriptActionItems.js

### 4. GET `/clients/:clientId/action-items`
- **What it does**: Fetch action items for specific client
- **Fixed**: Removed meeting relationship
- **Lines**: 581-670 in transcriptActionItems.js

### 5. POST `/assign-priorities`
- **What it does**: AI-powered priority assignment
- **Fixed**: Removed client/meeting relationships
- **Lines**: 189-260 in transcriptActionItems.js

### 6. GET `/meetings/starred`
- **What it does**: Get starred meetings with transcripts
- **Fixed**: Removed is_annual_review filter, removed client relationship
- **Lines**: 573-623 in calendar.js

---

## 🔐 RLS Implementation

### Tables with RLS
- `transcript_action_items`
- `pending_transcript_action_items`

### RLS Policies
```sql
CREATE POLICY "Transcript action items for own advisor" ON transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());

CREATE POLICY "Pending transcript action items for own advisor" ON pending_transcript_action_items
    FOR ALL USING (advisor_id = auth.uid());
```

### Backend Usage
```javascript
// Using user-scoped Supabase client
const { data, error } = await req.supabase
  .from('transcript_action_items')
  .select('*')
  .eq('advisor_id', userId);  // Explicit filter + RLS
```

**Defense in depth:**
- RLS filters at database level
- Code explicitly filters by advisor_id
- If either fails, data is protected

---

## 🧪 Testing Queries

### Verify RLS Policies
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items');
```

### Check Foreign Keys
```sql
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name IN ('transcript_action_items', 'pending_transcript_action_items');
```

### Verify Indexes
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items')
ORDER BY tablename;
```

---

## 📊 Performance Considerations

### Indexes Present
- `idx_transcript_action_items_advisor_id` - Fast user filtering
- `idx_transcript_action_items_meeting_id` - Fast meeting lookup
- `idx_transcript_action_items_client_id` - Fast client lookup
- `idx_transcript_action_items_completed` - Fast completion filtering
- `idx_transcript_action_items_created_at` - Fast sorting

### Query Optimization
- Using `.in()` for batch fetches (efficient)
- Building maps instead of N+1 queries
- Indexes on all filter columns

---

## ✨ Key Takeaways

1. **Avoid Supabase relationship queries** when FK relationships are uncertain
2. **Use separate queries + maps** for more explicit control
3. **Always use user-scoped client** (`req.supabase`) for RLS
4. **Explicit filtering** + RLS = defense in depth
5. **Test with actual data** to catch orphaned records

---

## 📚 Related Files
- `backend/src/routes/transcriptActionItems.js` - Main fixes
- `backend/src/routes/calendar.js` - Starred meetings fix
- `src/pages/Clients.js` - Edit modal fix
- `backend/migrations/012_transcript_action_items.sql` - Schema
- `backend/migrations/013_pending_transcript_action_items.sql` - Schema

