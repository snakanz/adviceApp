-- =====================================================
-- Calendly Meeting Cleanup Script
-- =====================================================
-- Purpose: Clean up stale, duplicate, and outdated Calendly meetings
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: ANALYZE CURRENT STATE
-- =====================================================

-- Show current meeting distribution
SELECT 
  'Total Calendly Meetings' as metric,
  COUNT(*) as count
FROM meetings
WHERE meeting_source = 'calendly'

UNION ALL

SELECT 
  'Active Meetings' as metric,
  COUNT(*) as count
FROM meetings
WHERE meeting_source = 'calendly'
  AND is_deleted = false
  AND sync_status = 'active'

UNION ALL

SELECT 
  'Deleted Meetings' as metric,
  COUNT(*) as count
FROM meetings
WHERE meeting_source = 'calendly'
  AND is_deleted = true

UNION ALL

SELECT 
  'Synced via Webhook' as metric,
  COUNT(*) as count
FROM meetings
WHERE meeting_source = 'calendly'
  AND synced_via_webhook = true

UNION ALL

SELECT 
  'Duplicate UUIDs' as metric,
  COUNT(*) as count
FROM (
  SELECT calendly_event_uuid
  FROM meetings
  WHERE calendly_event_uuid IS NOT NULL
    AND meeting_source = 'calendly'
  GROUP BY calendly_event_uuid
  HAVING COUNT(*) > 1
) duplicates;

-- =====================================================
-- STEP 2: FIND DUPLICATE MEETINGS
-- =====================================================

-- Show duplicate meetings (same calendly_event_uuid)
SELECT 
  calendly_event_uuid,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as meeting_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM meetings
WHERE 
  calendly_event_uuid IS NOT NULL
  AND meeting_source = 'calendly'
GROUP BY calendly_event_uuid
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- =====================================================
-- STEP 3: REMOVE DUPLICATES (KEEP OLDEST)
-- =====================================================

-- Mark duplicate meetings as deleted (keep the oldest one)
WITH duplicates AS (
  SELECT 
    calendly_event_uuid,
    MIN(id) as keep_id,
    COUNT(*) as duplicate_count
  FROM meetings
  WHERE 
    calendly_event_uuid IS NOT NULL
    AND meeting_source = 'calendly'
    AND is_deleted = false
  GROUP BY calendly_event_uuid
  HAVING COUNT(*) > 1
)
UPDATE meetings m
SET 
  is_deleted = true,
  sync_status = 'duplicate',
  updatedat = NOW()
FROM duplicates d
WHERE 
  m.calendly_event_uuid = d.calendly_event_uuid
  AND m.id != d.keep_id
  AND m.is_deleted = false;

-- Show how many duplicates were removed
SELECT 
  'Duplicates Removed' as action,
  COUNT(*) as count
FROM meetings
WHERE 
  meeting_source = 'calendly'
  AND sync_status = 'duplicate'
  AND is_deleted = true;

-- =====================================================
-- STEP 4: ARCHIVE OLD MEETINGS (OPTIONAL)
-- =====================================================

-- Mark meetings older than 6 months as archived
-- (This is optional - only run if you want to archive old data)

-- UNCOMMENT TO RUN:
-- UPDATE meetings
-- SET 
--   sync_status = 'archived',
--   updatedat = NOW()
-- WHERE 
--   meeting_source = 'calendly'
--   AND starttime < NOW() - INTERVAL '6 months'
--   AND sync_status != 'archived'
--   AND is_deleted = false;

-- =====================================================
-- STEP 5: CLEAN UP ORPHANED WEBHOOK EVENTS
-- =====================================================

-- Find webhook events that don't have corresponding meetings
SELECT 
  'Orphaned Webhook Events' as metric,
  COUNT(*) as count
FROM calendly_webhook_events cwe
WHERE NOT EXISTS (
  SELECT 1 
  FROM meetings m 
  WHERE m.calendly_event_uuid = cwe.event_id
);

-- Optional: Delete orphaned webhook events older than 30 days
-- UNCOMMENT TO RUN:
-- DELETE FROM calendly_webhook_events
-- WHERE created_at < NOW() - INTERVAL '30 days'
--   AND NOT EXISTS (
--     SELECT 1 
--     FROM meetings m 
--     WHERE m.calendly_event_uuid = event_id
--   );

-- =====================================================
-- STEP 6: VERIFY CLEANUP RESULTS
-- =====================================================

-- Show final meeting distribution
SELECT 
  sync_status,
  is_deleted,
  COUNT(*) as count,
  MIN(starttime) as earliest_meeting,
  MAX(starttime) as latest_meeting
FROM meetings
WHERE meeting_source = 'calendly'
GROUP BY sync_status, is_deleted
ORDER BY sync_status, is_deleted;

-- Show meetings by month
SELECT 
  DATE_TRUNC('month', starttime) as month,
  COUNT(*) as total_meetings,
  SUM(CASE WHEN is_deleted = false THEN 1 ELSE 0 END) as active_meetings,
  SUM(CASE WHEN is_deleted = true THEN 1 ELSE 0 END) as deleted_meetings,
  SUM(CASE WHEN synced_via_webhook = true THEN 1 ELSE 0 END) as webhook_synced
FROM meetings
WHERE meeting_source = 'calendly'
  AND starttime >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', starttime)
ORDER BY month DESC;

-- =====================================================
-- STEP 7: WEBHOOK ACTIVITY SUMMARY
-- =====================================================

-- Show recent webhook activity
SELECT 
  event_type,
  COUNT(*) as total_events,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event,
  COUNT(DISTINCT event_id) as unique_events
FROM calendly_webhook_events
GROUP BY event_type
ORDER BY last_event DESC;

-- Show webhook events from last 24 hours
SELECT 
  event_type,
  event_id,
  created_at,
  user_id
FROM calendly_webhook_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- =====================================================
-- STEP 8: IDENTIFY MEETINGS NEEDING SYNC
-- =====================================================

-- Find meetings that haven't been synced recently
SELECT 
  id,
  title,
  starttime,
  last_calendar_sync,
  synced_via_webhook,
  sync_status,
  NOW() - last_calendar_sync as time_since_sync
FROM meetings
WHERE 
  meeting_source = 'calendly'
  AND is_deleted = false
  AND (
    last_calendar_sync IS NULL 
    OR last_calendar_sync < NOW() - INTERVAL '1 day'
  )
ORDER BY last_calendar_sync ASC NULLS FIRST
LIMIT 20;

-- =====================================================
-- STEP 9: CLIENT ASSOCIATION CHECK
-- =====================================================

-- Show meetings without client associations
SELECT 
  COUNT(*) as meetings_without_clients,
  COUNT(DISTINCT client_email) as unique_client_emails
FROM meetings
WHERE 
  meeting_source = 'calendly'
  AND is_deleted = false
  AND clientid IS NULL
  AND client_email IS NOT NULL;

-- Show top clients by meeting count
SELECT 
  c.name as client_name,
  c.email as client_email,
  COUNT(m.id) as meeting_count,
  MIN(m.starttime) as first_meeting,
  MAX(m.starttime) as last_meeting
FROM meetings m
LEFT JOIN clients c ON m.clientid = c.id
WHERE 
  m.meeting_source = 'calendly'
  AND m.is_deleted = false
GROUP BY c.id, c.name, c.email
ORDER BY meeting_count DESC
LIMIT 20;

-- =====================================================
-- STEP 10: FINAL SUMMARY
-- =====================================================

-- Comprehensive summary
SELECT 
  'Total Calendly Meetings' as metric,
  COUNT(*) as count,
  NULL as percentage
FROM meetings
WHERE meeting_source = 'calendly'

UNION ALL

SELECT 
  'Active Meetings',
  COUNT(*),
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM meetings WHERE meeting_source = 'calendly'), 0), 2)
FROM meetings
WHERE meeting_source = 'calendly' AND is_deleted = false

UNION ALL

SELECT 
  'Deleted Meetings',
  COUNT(*),
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM meetings WHERE meeting_source = 'calendly'), 0), 2)
FROM meetings
WHERE meeting_source = 'calendly' AND is_deleted = true

UNION ALL

SELECT 
  'Webhook Synced',
  COUNT(*),
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM meetings WHERE meeting_source = 'calendly'), 0), 2)
FROM meetings
WHERE meeting_source = 'calendly' AND synced_via_webhook = true

UNION ALL

SELECT 
  'With Client Association',
  COUNT(*),
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM meetings WHERE meeting_source = 'calendly' AND is_deleted = false), 0), 2)
FROM meetings
WHERE meeting_source = 'calendly' AND is_deleted = false AND clientid IS NOT NULL

UNION ALL

SELECT 
  'Total Webhook Events',
  COUNT(*),
  NULL
FROM calendly_webhook_events

UNION ALL

SELECT 
  'Webhook Events (24h)',
  COUNT(*),
  NULL
FROM calendly_webhook_events
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- =====================================================
-- CLEANUP COMPLETE!
-- =====================================================
-- Review the results above to verify cleanup was successful
-- If you need to run a full sync, use the Advicly app or API
-- =====================================================

