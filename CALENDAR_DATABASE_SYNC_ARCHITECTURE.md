# Calendar-Database Sync Architecture

## Core Principle
**The database is the single source of truth, but must accurately reflect the current state of the Google Calendar account.**

## Current Problem Analysis

### Issues Identified:
1. **Empty Google Calendar**: snaka1003@gmail.com has no meetings
2. **Historical Database Data**: Database contains orphaned client and meeting data
3. **Data Inconsistency**: Frontend shows no meetings (correct) but clients page shows historical clients (incorrect)
4. **Missing Deletion Detection**: No proper cascade deletion when meetings are removed from Google Calendar

## Proposed Architecture

### 1. Data Synchronization Strategy

**Hybrid Approach**: Maintain historical records but clearly distinguish between active and historical data.

```sql
-- Enhanced meetings table structure
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_calendar_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'deleted', 'orphaned'));

-- Enhanced clients table structure  
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_meeting_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_meeting_count INTEGER DEFAULT 0;
```

### 2. Calendar Sync Process

#### Phase 1: Calendar State Detection
1. **Fetch Current Calendar State**: Get all events from Google Calendar
2. **Compare with Database**: Identify discrepancies between calendar and database
3. **Categorize Data**:
   - `active`: Exists in both calendar and database
   - `deleted`: Exists in database but not in calendar
   - `orphaned`: Historical data with no calendar reference
   - `new`: Exists in calendar but not in database

#### Phase 2: Data Reconciliation
```javascript
// Sync process logic
async function syncCalendarWithDatabase(userId) {
  const calendarEvents = await fetchGoogleCalendarEvents(userId);
  const databaseMeetings = await fetchDatabaseMeetings(userId);
  
  // Mark meetings as deleted if not in calendar
  for (const meeting of databaseMeetings) {
    if (!calendarEvents.find(e => e.id === meeting.googleeventid)) {
      await markMeetingAsDeleted(meeting.id);
      await updateClientActiveStatus(meeting.client_id);
    }
  }
  
  // Add new meetings from calendar
  for (const event of calendarEvents) {
    if (!databaseMeetings.find(m => m.googleeventid === event.id)) {
      await createMeetingFromCalendarEvent(event, userId);
    }
  }
}
```

### 3. Client Management Strategy

**Smart Client Persistence**: Clients persist but show accurate activity status.

```sql
-- Update client active status based on meeting activity
CREATE OR REPLACE FUNCTION update_client_active_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update client meeting counts and active status
  UPDATE clients 
  SET 
    meeting_count = (
      SELECT COUNT(*) FROM meetings 
      WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
    ),
    active_meeting_count = (
      SELECT COUNT(*) FROM meetings 
      WHERE client_id = COALESCE(NEW.client_id, OLD.client_id) 
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ),
    last_meeting_date = (
      SELECT MAX(starttime) FROM meetings 
      WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ),
    is_active = (
      SELECT COUNT(*) > 0 FROM meetings 
      WHERE client_id = COALESCE(NEW.client_id, OLD.client_id) 
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    )
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update client status
CREATE TRIGGER update_client_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_client_active_status();
```

### 4. Cascade Deletion Rules

**Soft Deletion with Cascade Updates**:

1. **Meeting Deletion**: Mark as `is_deleted = true`, update `deleted_at`
2. **Client Status Update**: Recalculate `active_meeting_count` and `is_active`
3. **Related Data**: Update Ask Advicly threads, summaries, etc.

```sql
-- Cascade deletion function
CREATE OR REPLACE FUNCTION handle_meeting_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- If meeting is being marked as deleted
  IF NEW.is_deleted = TRUE AND (OLD.is_deleted IS NULL OR OLD.is_deleted = FALSE) THEN
    -- Archive related Ask Advicly threads
    UPDATE ask_threads 
    SET is_archived = TRUE 
    WHERE client_id = NEW.client_id;
    
    -- Mark related summaries as inactive
    UPDATE meeting_summaries 
    SET is_active = FALSE 
    WHERE meeting_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meeting_deletion_cascade_trigger
  AFTER UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION handle_meeting_deletion();
```

### 5. Data Cleanup Strategy

**Immediate Cleanup for Current Situation**:

```sql
-- Step 1: Mark all existing meetings as deleted (since Google Calendar is empty)
UPDATE meetings 
SET 
  is_deleted = TRUE,
  deleted_at = NOW(),
  last_calendar_sync = NOW(),
  sync_status = 'orphaned'
WHERE userid = 1 
AND (is_deleted IS NULL OR is_deleted = FALSE);

-- Step 2: Update all clients to inactive status
UPDATE clients 
SET 
  is_active = FALSE,
  active_meeting_count = 0,
  last_meeting_date = (
    SELECT MAX(starttime) FROM meetings 
    WHERE client_id = clients.id
  )
WHERE advisor_id = 1;
```

### 6. Frontend Query Updates

**Modified Queries for Accurate Data Display**:

```sql
-- Meetings page: Only show active meetings
SELECT * FROM meetings
WHERE userid = ?
AND (is_deleted IS NULL OR is_deleted = FALSE)
ORDER BY starttime DESC;

-- Clients page: Show clients with activity status
SELECT
  c.*,
  c.is_active,
  c.active_meeting_count,
  c.last_meeting_date,
  CASE
    WHEN c.is_active THEN 'Active'
    WHEN c.meeting_count > 0 THEN 'Historical'
    ELSE 'No Meetings'
  END as status
FROM clients c
WHERE c.advisor_id = ?
ORDER BY c.is_active DESC, c.last_meeting_date DESC;
```

### 7. API Endpoint Updates

**Enhanced Calendar Sync Endpoint**:

```javascript
// POST /api/calendar/sync-comprehensive
app.post('/api/calendar/sync-comprehensive', async (req, res) => {
  try {
    const userId = req.user.id;

    // Phase 1: Detect calendar state
    const calendarEvents = await fetchGoogleCalendarEvents(userId);
    const databaseMeetings = await fetchDatabaseMeetings(userId);

    // Phase 2: Reconcile data
    const syncResults = await reconcileCalendarData(
      userId,
      calendarEvents,
      databaseMeetings
    );

    // Phase 3: Update client statuses
    await updateAllClientStatuses(userId);

    res.json({
      success: true,
      results: syncResults,
      message: 'Calendar sync completed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 8. Implementation Plan

#### Phase 1: Database Schema Updates
1. Add deletion tracking columns to meetings table
2. Add activity tracking columns to clients table
3. Create triggers for automatic status updates

#### Phase 2: Sync Logic Implementation
1. Implement comprehensive calendar sync service
2. Add cascade deletion handling
3. Update API endpoints

#### Phase 3: Frontend Updates
1. Modify queries to respect deletion flags
2. Update client display to show activity status
3. Add sync status indicators

#### Phase 4: Data Cleanup
1. Run cleanup scripts for current historical data
2. Mark orphaned data appropriately
3. Update client statuses

### 9. Benefits of This Architecture

1. **Data Integrity**: Database accurately reflects calendar state
2. **Historical Preservation**: Past data is preserved but clearly marked
3. **Automatic Maintenance**: Triggers handle status updates automatically
4. **Flexible Display**: Frontend can show active, historical, or all data as needed
5. **Cascade Consistency**: Related data is properly updated when meetings change

### 10. Monitoring and Maintenance

```sql
-- Health check queries
SELECT
  'Database Health' as metric,
  COUNT(*) as total_meetings,
  COUNT(CASE WHEN is_deleted = TRUE THEN 1 END) as deleted_meetings,
  COUNT(CASE WHEN is_deleted IS NULL OR is_deleted = FALSE THEN 1 END) as active_meetings
FROM meetings WHERE userid = ?;

SELECT
  'Client Health' as metric,
  COUNT(*) as total_clients,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_clients,
  COUNT(CASE WHEN is_active = FALSE AND meeting_count > 0 THEN 1 END) as historical_clients
FROM clients WHERE advisor_id = ?;
```

This architecture ensures your database stays synchronized with Google Calendar while preserving historical data and maintaining referential integrity across all related tables.

-- Step 3: Archive related Ask Advicly threads
UPDATE ask_threads 
SET is_archived = TRUE 
WHERE advisor_id = 1;
```
