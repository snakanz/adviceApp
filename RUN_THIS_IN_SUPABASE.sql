-- =====================================================
-- RECALL.AI WEBHOOK FIXES - DATABASE MIGRATION
-- =====================================================
-- Run this in Supabase SQL Editor to complete the fixes
-- 
-- Steps:
-- 1. Go to https://app.supabase.com
-- 2. Select your Advicly project
-- 3. Click "SQL Editor" (left sidebar)
-- 4. Click "New Query"
-- 5. Copy and paste ALL the code below
-- 6. Click "Run" (blue button)
-- 7. Wait for success message
-- =====================================================

-- Add payload column to recall_webhook_events table
ALTER TABLE recall_webhook_events
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_recall_webhook_events_event_type 
ON recall_webhook_events(event_type);

-- Add documentation
COMMENT ON COLUMN recall_webhook_events.payload IS 'Full webhook payload data for debugging and audit purposes';

-- =====================================================
-- VERIFICATION QUERIES (run these to confirm it worked)
-- =====================================================

-- 1. Verify the payload column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'recall_webhook_events' 
  AND column_name IN ('payload', 'event_type')
ORDER BY column_name;

-- Expected output: 2 rows
-- - payload | jsonb | YES
-- - event_type | text | YES

-- 2. Verify the index was created
SELECT 
  indexname,
  tablename
FROM pg_indexes 
WHERE tablename = 'recall_webhook_events'
  AND indexname LIKE '%event_type%';

-- Expected output: 1 row
-- - idx_recall_webhook_events_event_type | recall_webhook_events

-- 3. Check current webhook events (if any)
SELECT 
  webhook_id,
  bot_id,
  event_type,
  status,
  payload,
  created_at
FROM recall_webhook_events 
ORDER BY created_at DESC
LIMIT 10;

-- Expected output: May be empty initially, will populate after webhooks are received

-- =====================================================
-- MONITORING QUERIES (use these to check status)
-- =====================================================

-- Check webhook events by type
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
  MAX(created_at) as latest_event
FROM recall_webhook_events 
GROUP BY event_type
ORDER BY latest_event DESC;

-- Check meetings with Recall bots
SELECT 
  id,
  title,
  recall_bot_id,
  recall_status,
  transcript_source,
  CASE WHEN transcript IS NOT NULL THEN 'Yes' ELSE 'No' END as has_transcript,
  CASE WHEN quick_summary IS NOT NULL THEN 'Yes' ELSE 'No' END as has_summary,
  created_at
FROM meetings 
WHERE recall_bot_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Check for specific bot
SELECT 
  webhook_id,
  event_type,
  status,
  payload,
  created_at
FROM recall_webhook_events 
WHERE bot_id = '1135ddc6-6116-490b-a88e-1f2e2e737c23'
ORDER BY created_at DESC;

-- =====================================================
-- TROUBLESHOOTING QUERIES
-- =====================================================

-- If webhooks aren't being received, check for errors
SELECT 
  bot_id,
  event_type,
  status,
  payload,
  created_at
FROM recall_webhook_events 
WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 10;

-- Check if meetings table has all required columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name IN (
    'recall_bot_id',
    'recall_status',
    'recall_recording_id',
    'recall_error',
    'transcript_source'
  )
ORDER BY column_name;

-- Expected output: 5 rows with all columns present

-- =====================================================
-- SUCCESS INDICATORS
-- =====================================================
-- After running this migration, you should see:
-- 
-- 1. ✅ payload column added to recall_webhook_events
-- 2. ✅ Index created on event_type
-- 3. ✅ No errors in the output
-- 
-- Then:
-- 1. Wait for Render to deploy the code changes
-- 2. Check Render logs for "Recall V2 routes mounted successfully"
-- 3. Run the verification queries above
-- 4. Test with a new meeting to verify end-to-end flow
-- =====================================================

