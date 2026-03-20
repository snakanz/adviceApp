-- Comprehensive Calendar-Database Sync Schema Migration
-- This migration adds all necessary columns and triggers for complete sync functionality

-- ============================================================================
-- PART 1: MEETINGS TABLE ENHANCEMENTS
-- ============================================================================

-- Add deletion tracking and sync status columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_calendar_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'deleted', 'orphaned', 'new'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_is_deleted ON meetings(is_deleted);
CREATE INDEX IF NOT EXISTS idx_meetings_sync_status ON meetings(sync_status);
CREATE INDEX IF NOT EXISTS idx_meetings_last_sync ON meetings(last_calendar_sync);
CREATE INDEX IF NOT EXISTS idx_meetings_deleted_at ON meetings(deleted_at);

-- ============================================================================
-- PART 2: CLIENTS TABLE ENHANCEMENTS  
-- ============================================================================

-- Add activity tracking columns to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_meeting_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_meeting_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_sync TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_last_meeting ON clients(last_meeting_date);
CREATE INDEX IF NOT EXISTS idx_clients_active_count ON clients(active_meeting_count);

-- ============================================================================
-- PART 3: AUTOMATIC STATUS UPDATE FUNCTIONS
-- ============================================================================

-- Function to update client active status based on meeting activity
CREATE OR REPLACE FUNCTION update_client_active_status()
RETURNS TRIGGER AS $$
DECLARE
    target_client_id UUID;
BEGIN
    -- Determine which client to update
    target_client_id := COALESCE(NEW.client_id, OLD.client_id);
    
    -- Skip if no client associated
    IF target_client_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Update client meeting counts and active status
    UPDATE clients 
    SET 
        meeting_count = (
            SELECT COUNT(*) FROM meetings 
            WHERE client_id = target_client_id
        ),
        active_meeting_count = (
            SELECT COUNT(*) FROM meetings 
            WHERE client_id = target_client_id 
            AND (is_deleted IS NULL OR is_deleted = FALSE)
        ),
        last_meeting_date = (
            SELECT MAX(starttime) FROM meetings 
            WHERE client_id = target_client_id
            AND (is_deleted IS NULL OR is_deleted = FALSE)
        ),
        is_active = (
            SELECT COUNT(*) > 0 FROM meetings 
            WHERE client_id = target_client_id 
            AND (is_deleted IS NULL OR is_deleted = FALSE)
        ),
        last_activity_sync = NOW()
    WHERE id = target_client_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: CASCADE DELETION HANDLING
-- ============================================================================

-- Function to handle meeting deletion cascades
CREATE OR REPLACE FUNCTION handle_meeting_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- If meeting is being marked as deleted
    IF NEW.is_deleted = TRUE AND (OLD.is_deleted IS NULL OR OLD.is_deleted = FALSE) THEN
        
        -- Archive related Ask Advicly threads if they exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
            UPDATE ask_threads 
            SET is_archived = TRUE,
                updated_at = NOW()
            WHERE client_id = NEW.client_id;
        END IF;
        
        -- Mark related summaries as inactive if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_summaries') THEN
            UPDATE meeting_summaries 
            SET is_active = FALSE,
                updated_at = NOW()
            WHERE meeting_id = NEW.id;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: CREATE TRIGGERS
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_client_status_trigger ON meetings;
DROP TRIGGER IF EXISTS meeting_deletion_cascade_trigger ON meetings;

-- Trigger to automatically update client status when meetings change
CREATE TRIGGER update_client_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_client_active_status();

-- Trigger to handle cascade operations when meetings are deleted
CREATE TRIGGER meeting_deletion_cascade_trigger
    AFTER UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION handle_meeting_deletion();

-- ============================================================================
-- PART 6: INITIAL DATA POPULATION
-- ============================================================================

-- Populate existing meetings with default values
UPDATE meetings 
SET 
    is_deleted = FALSE,
    sync_status = 'active',
    last_calendar_sync = NOW()
WHERE is_deleted IS NULL;

-- Update all client statuses based on current meeting data
DO $$
DECLARE
    client_record RECORD;
BEGIN
    FOR client_record IN SELECT id FROM clients LOOP
        UPDATE clients 
        SET 
            meeting_count = (
                SELECT COUNT(*) FROM meetings 
                WHERE client_id = client_record.id
            ),
            active_meeting_count = (
                SELECT COUNT(*) FROM meetings 
                WHERE client_id = client_record.id 
                AND (is_deleted IS NULL OR is_deleted = FALSE)
            ),
            last_meeting_date = (
                SELECT MAX(starttime) FROM meetings 
                WHERE client_id = client_record.id
                AND (is_deleted IS NULL OR is_deleted = FALSE)
            ),
            is_active = (
                SELECT COUNT(*) > 0 FROM meetings 
                WHERE client_id = client_record.id 
                AND (is_deleted IS NULL OR is_deleted = FALSE)
            ),
            last_activity_sync = NOW()
        WHERE id = client_record.id;
    END LOOP;
END $$;

-- ============================================================================
-- PART 7: VERIFICATION QUERIES
-- ============================================================================

-- Verify the migration
SELECT 'Migration completed successfully' as status;

-- Show updated schema
SELECT 
    'meetings table columns' as info,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('is_deleted', 'deleted_at', 'last_calendar_sync', 'sync_status')
ORDER BY column_name;

SELECT 
    'clients table columns' as info,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('is_active', 'last_meeting_date', 'meeting_count', 'active_meeting_count', 'last_activity_sync')
ORDER BY column_name;
