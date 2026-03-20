# Debugging Commands and SQL Queries

**User ID**: 9e031204-9367-4449-a75a-5cf429615db0  
**Client Email**: snaka1003@gmail.com

---

## PROBLEM 1: Attendees Not Displaying

### SQL Queries to Run

**Query 1: Check attendees population**
```sql
SELECT 
  id,
  title,
  attendees,
  created_at,
  meeting_source
FROM meetings 
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
ORDER BY created_at DESC 
LIMIT 20;
```

**Expected**: `attendees` column should contain JSON like:
```json
[{"email":"snaka1003@gmail.com","displayName":"Snaka","responseStatus":"accepted"}]
```

**Actual**: Likely `NULL` for meetings created before Nov 1, 2025 13:00 UTC

---

**Query 2: Check for meetings with snaka1003@gmail.com**
```sql
SELECT 
  id,
  title,
  attendees,
  client_id,
  created_at
FROM meetings 
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND attendees::text ILIKE '%snaka1003%';
```

**Expected**: Should find meetings with snaka1003@gmail.com in attendees

---

**Query 3: Check if client extraction ran**
```sql
SELECT 
  id,
  email,
  name,
  user_id,
  created_at
FROM clients 
WHERE user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND email = 'snaka1003@gmail.com';
```

**Expected**: Should find client record for snaka1003@gmail.com

---

**Query 4: Check meeting-client links**
```sql
SELECT 
  m.id,
  m.title,
  m.client_id,
  c.email,
  c.name
FROM meetings m
LEFT JOIN clients c ON m.client_id = c.id
WHERE m.user_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND c.email = 'snaka1003@gmail.com';
```

**Expected**: Should show meetings linked to snaka1003@gmail.com client

---

## PROBLEM 2: Action Items 500 Errors

### SQL Queries to Run

**Query 5: Check for orphaned pending items**
```sql
SELECT 
  p.id,
  p.meeting_id,
  p.action_text,
  m.id as meeting_exists,
  p.advisor_id
FROM pending_transcript_action_items p
LEFT JOIN meetings m ON p.meeting_id = m.id
WHERE p.advisor_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND m.id IS NULL;
```

**Expected**: Should return 0 rows (no orphaned items)

**If returns rows**: These are causing the 500 error!

---

**Query 6: Check for orphaned action items**
```sql
SELECT 
  t.id,
  t.meeting_id,
  t.action_text,
  m.id as meeting_exists,
  t.advisor_id
FROM transcript_action_items t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE t.advisor_id = '9e031204-9367-4449-a75a-5cf429615db0'
AND m.id IS NULL;
```

**Expected**: Should return 0 rows

---

**Query 7: Check table schemas**
```sql
-- Check transcript_action_items columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transcript_action_items'
ORDER BY ordinal_position;
```

**Expected columns**:
- `id` (uuid)
- `meeting_id` (integer)
- `client_id` (uuid)
- `advisor_id` (uuid) ← MUST be UUID, not INTEGER
- `action_text` (text) ← MUST be action_text, not action_item_text
- `priority` (integer)
- `completed` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

**Query 8: Check pending_transcript_action_items columns**
```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_transcript_action_items'
ORDER BY ordinal_position;
```

**Expected columns**: Same as above, minus `completed` and `completed_at`

---

**Query 9: Check RLS policies**
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename IN ('transcript_action_items', 'pending_transcript_action_items')
ORDER BY tablename, policyname;
```

**Expected**: 
- Both tables should have RLS enabled
- Policies should check `advisor_id = auth.uid()`

---

**Query 10: Count action items for user**
```sql
SELECT 
  'pending' as type,
  COUNT(*) as count
FROM pending_transcript_action_items
WHERE advisor_id = '9e031204-9367-4449-a75a-5cf429615db0'

UNION ALL

SELECT 
  'approved' as type,
  COUNT(*) as count
FROM transcript_action_items
WHERE advisor_id = '9e031204-9367-4449-a75a-5cf429615db0';
```

**Expected**: Should show counts for both pending and approved items

---

## API Endpoint Tests

### Test 1: Check pending action items endpoint
```bash
curl -X GET "https://adviceapp-9rgw.onrender.com/api/transcript-action-items/pending/all" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected**: 200 OK with pending items

**If 500**: Check Query 5 for orphaned items

---

### Test 2: Check action items by client endpoint
```bash
curl -X GET "https://adviceapp-9rgw.onrender.com/api/transcript-action-items/action-items/by-client" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected**: 200 OK with action items grouped by client

**If 500**: Check Query 6 for orphaned items

---

### Test 3: Check starred meetings endpoint
```bash
curl -X GET "https://adviceapp-9rgw.onrender.com/api/calendar/meetings/starred" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected**: 200 OK with starred meetings

**If 500**: Check if meetings table has `annual_review` column

---

## Quick Fixes

### Fix Orphaned Pending Items
```sql
DELETE FROM pending_transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);
```

### Fix Orphaned Action Items
```sql
DELETE FROM transcript_action_items
WHERE meeting_id NOT IN (SELECT id FROM meetings);
```

### Verify Fixes
```sql
-- Run Query 5 and 6 again - should return 0 rows
```


