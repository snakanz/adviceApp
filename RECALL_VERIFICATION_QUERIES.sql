-- ============================================================================
-- RECALL.AI VERIFICATION QUERIES
-- Run these in Supabase SQL Editor to verify your setup
-- ============================================================================

-- ============================================================================
-- 1. VERIFY MEETINGS TABLE HAS ALL RECALL COLUMNS (RUN THIS FIRST!)
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'meetings'
AND column_name IN (
  'recall_bot_id',
  'recall_recording_id',
  'recall_status',
  'recall_error',
  'transcript_source'
)
ORDER BY column_name;

-- Expected output: 5 rows with all Recall columns
-- If you get 0 rows, the migration hasn't been applied yet!

-- ============================================================================
-- 2. VERIFY CALENDAR_CONNECTIONS HAS TRANSCRIPTION_ENABLED
-- ============================================================================
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calendar_connections' 
AND column_name = 'transcription_enabled';

-- Expected output: 1 row with transcription_enabled BOOLEAN DEFAULT false

-- ============================================================================
-- 3. VERIFY RECALL_WEBHOOK_EVENTS TABLE EXISTS
-- ============================================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'recall_webhook_events';

-- Expected output: 1 row with table_type = 'BASE TABLE'

-- ============================================================================
-- 4. VERIFY INDEXES ARE CREATED
-- ============================================================================
SELECT 
  indexname,
  tablename
FROM pg_indexes 
WHERE tablename IN ('meetings', 'recall_webhook_events', 'calendar_connections')
AND indexname LIKE '%recall%'
ORDER BY tablename, indexname;

-- Expected output: Multiple indexes for recall tracking

-- ============================================================================
-- 5. CHECK EXISTING MEETINGS (if any)
-- ============================================================================
SELECT 
  id,
  title,
  user_id,
  recall_bot_id,
  recall_status,
  transcript_source,
  created_at
FROM meetings 
WHERE recall_bot_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Expected output: Empty initially, will populate after testing

-- ============================================================================
-- 6. CHECK WEBHOOK EVENTS (if any)
-- ============================================================================
SELECT 
  id,
  webhook_id,
  bot_id,
  event_type,
  status,
  created_at
FROM recall_webhook_events 
ORDER BY created_at DESC
LIMIT 10;

-- Expected output: Empty initially, will populate after testing

-- ============================================================================
-- 7. CHECK CALENDAR CONNECTIONS WITH TRANSCRIPTION ENABLED
-- ============================================================================
SELECT 
  id,
  user_id,
  provider,
  transcription_enabled,
  created_at
FROM calendar_connections 
WHERE transcription_enabled = TRUE
ORDER BY created_at DESC
LIMIT 10;

-- Expected output: Empty initially, will populate when users enable transcription

-- ============================================================================
-- 8. VERIFY COLUMN CONSTRAINTS
-- ============================================================================
SELECT
  constraint_name,
  table_name,
  column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'meetings'
AND column_name IN ('recall_bot_id', 'recall_status', 'transcript_source');

-- Expected output: Constraints for Recall columns

-- ============================================================================
-- 9. CHECK MEETINGS TABLE STRUCTURE (FULL)
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Expected output: All columns including new Recall columns

-- ============================================================================
-- 10. QUICK HEALTH CHECK
-- ============================================================================
SELECT 
  'Meetings Table' as component,
  COUNT(*) as total_records,
  COUNT(CASE WHEN recall_bot_id IS NOT NULL THEN 1 END) as with_recall_bot
FROM meetings
UNION ALL
SELECT 
  'Webhook Events' as component,
  COUNT(*) as total_records,
  COUNT(*) as with_recall_bot
FROM recall_webhook_events
UNION ALL
SELECT 
  'Calendar Connections' as component,
  COUNT(*) as total_records,
  COUNT(CASE WHEN transcription_enabled = TRUE THEN 1 END) as with_recall_bot
FROM calendar_connections;

-- Expected output: 3 rows showing counts for each table

