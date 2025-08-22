-- ADD MISSING COLUMNS - Copy and paste this into Supabase SQL Editor
-- This adds the enhanced columns needed for the new client/meeting features
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Add enhanced columns to clients table
DO $$ 
BEGIN
    -- Add meeting_count column (total meetings for this client)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clients' AND column_name = 'meeting_count') THEN
        ALTER TABLE clients ADD COLUMN meeting_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added meeting_count column to clients table';
    END IF;

    -- Add active_meeting_count column (meetings in last 90 days)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clients' AND column_name = 'active_meeting_count') THEN
        ALTER TABLE clients ADD COLUMN active_meeting_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added active_meeting_count column to clients table';
    END IF;

    -- Add is_active column (has meetings in last 90 days)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clients' AND column_name = 'is_active') THEN
        ALTER TABLE clients ADD COLUMN is_active BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_active column to clients table';
    END IF;

    -- Add last_meeting_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clients' AND column_name = 'last_meeting_date') THEN
        ALTER TABLE clients ADD COLUMN last_meeting_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_meeting_date column to clients table';
    END IF;
END $$;

-- Add enhanced columns to meetings table
DO $$ 
BEGIN
    -- Add is_deleted column for soft deletion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'is_deleted') THEN
        ALTER TABLE meetings ADD COLUMN is_deleted BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_deleted column to meetings table';
    END IF;

    -- Add deleted_at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'deleted_at') THEN
        ALTER TABLE meetings ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added deleted_at column to meetings table';
    END IF;

    -- Add calendar_sync_status for tracking sync state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'calendar_sync_status') THEN
        ALTER TABLE meetings ADD COLUMN calendar_sync_status VARCHAR(20) DEFAULT 'synced';
        RAISE NOTICE 'Added calendar_sync_status column to meetings table';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_last_meeting_date ON clients(last_meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_is_deleted ON meetings(is_deleted);
CREATE INDEX IF NOT EXISTS idx_meetings_calendar_sync ON meetings(calendar_sync_status);

-- Create function to automatically update client statistics
CREATE OR REPLACE FUNCTION update_client_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats for the affected client
    WITH client_stats AS (
        SELECT 
            COUNT(*) as total_meetings,
            COUNT(CASE WHEN starttime >= NOW() - INTERVAL '90 days' THEN 1 END) as recent_meetings,
            MAX(starttime) as last_meeting
        FROM meetings 
        WHERE clientname = COALESCE(NEW.clientname, OLD.clientname)
        AND (is_deleted IS NULL OR is_deleted = false)
    )
    UPDATE clients 
    SET 
        meeting_count = client_stats.total_meetings,
        active_meeting_count = client_stats.recent_meetings,
        is_active = (client_stats.recent_meetings > 0),
        last_meeting_date = client_stats.last_meeting
    FROM client_stats
    WHERE name = COALESCE(NEW.clientname, OLD.clientname);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically maintain client statistics
DROP TRIGGER IF EXISTS trigger_update_client_stats_insert ON meetings;
DROP TRIGGER IF EXISTS trigger_update_client_stats_update ON meetings;
DROP TRIGGER IF EXISTS trigger_update_client_stats_delete ON meetings;

CREATE TRIGGER trigger_update_client_stats_insert
    AFTER INSERT ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stats();

CREATE TRIGGER trigger_update_client_stats_update
    AFTER UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stats();

CREATE TRIGGER trigger_update_client_stats_delete
    AFTER DELETE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stats();

-- Verify the columns were added
SELECT 'VERIFICATION - New columns added:' as info;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('meeting_count', 'active_meeting_count', 'is_active', 'last_meeting_date')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('is_deleted', 'deleted_at', 'calendar_sync_status')
ORDER BY column_name;

SELECT '🎉 SCHEMA UPDATE COMPLETE! Your database now has all the enhanced columns.' as result;
