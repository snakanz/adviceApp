-- Annual Review Tracking Migration
-- Adds support for marking meetings as annual reviews and tracking annual review status per client

-- ============================================================================
-- PART 1: ADD ANNUAL REVIEW FLAG TO MEETINGS TABLE
-- ============================================================================

-- Add is_annual_review column to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_annual_review BOOLEAN DEFAULT FALSE;

-- Create index for performance when filtering annual reviews
CREATE INDEX IF NOT EXISTS idx_meetings_is_annual_review ON meetings(is_annual_review);

-- Add comment for documentation
COMMENT ON COLUMN meetings.is_annual_review IS 'Flag to mark meetings as annual review meetings';

-- ============================================================================
-- PART 2: CREATE ANNUAL REVIEW TRACKING TABLE
-- ============================================================================

-- Create table to track annual review status per client
CREATE TABLE IF NOT EXISTS client_annual_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_year INTEGER NOT NULL, -- Year of the annual review (e.g., 2025)
    review_date DATE, -- Date when the annual review was completed
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL, -- Link to the meeting if applicable
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'overdue')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, review_year) -- One annual review per client per year
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_annual_reviews_client_id ON client_annual_reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_client_annual_reviews_advisor_id ON client_annual_reviews(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_annual_reviews_status ON client_annual_reviews(status);
CREATE INDEX IF NOT EXISTS idx_client_annual_reviews_review_year ON client_annual_reviews(review_year);

-- Add comments for documentation
COMMENT ON TABLE client_annual_reviews IS 'Tracks annual review status for each client';
COMMENT ON COLUMN client_annual_reviews.review_year IS 'Year of the annual review (e.g., 2025)';
COMMENT ON COLUMN client_annual_reviews.status IS 'Status: pending, scheduled, completed, overdue';

-- ============================================================================
-- PART 3: CREATE TRIGGER FOR AUTOMATIC UPDATED_AT
-- ============================================================================

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_annual_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_client_annual_reviews_updated_at
    BEFORE UPDATE ON client_annual_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_client_annual_reviews_updated_at();

-- ============================================================================
-- PART 4: CREATE VIEW FOR ANNUAL REVIEW DASHBOARD
-- ============================================================================

-- Create view to show annual review status for all clients
CREATE OR REPLACE VIEW annual_review_dashboard AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.pipeline_stage,
    car.id as review_id,
    car.review_year,
    car.review_date,
    car.status as review_status,
    car.notes as review_notes,
    m.id as meeting_id,
    m.title as meeting_title,
    m.starttime as meeting_date,
    CASE 
        WHEN car.status = 'completed' THEN 'completed'
        WHEN car.status = 'scheduled' THEN 'scheduled'
        WHEN car.review_year < EXTRACT(YEAR FROM NOW()) THEN 'overdue'
        ELSE 'pending'
    END as computed_status,
    car.created_at,
    car.updated_at
FROM clients c
LEFT JOIN client_annual_reviews car ON c.id = car.client_id 
    AND car.review_year = EXTRACT(YEAR FROM NOW())::INTEGER
LEFT JOIN meetings m ON car.meeting_id = m.id
ORDER BY 
    CASE 
        WHEN car.status = 'overdue' THEN 1
        WHEN car.status = 'pending' THEN 2
        WHEN car.status = 'scheduled' THEN 3
        WHEN car.status = 'completed' THEN 4
        ELSE 5
    END,
    c.name;

-- Add comment for the view
COMMENT ON VIEW annual_review_dashboard IS 'Dashboard view showing annual review status for all clients';

-- ============================================================================
-- PART 5: FUNCTION TO AUTO-CREATE ANNUAL REVIEW RECORDS
-- ============================================================================

-- Function to automatically create annual review records for all clients for the current year
CREATE OR REPLACE FUNCTION create_annual_review_records_for_year(target_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    records_created INTEGER := 0;
    client_record RECORD;
BEGIN
    -- Loop through all clients and create annual review records if they don't exist
    FOR client_record IN 
        SELECT DISTINCT c.id as client_id, c.userid as advisor_id
        FROM clients c
        WHERE NOT EXISTS (
            SELECT 1 FROM client_annual_reviews car 
            WHERE car.client_id = c.id 
            AND car.review_year = target_year
        )
    LOOP
        INSERT INTO client_annual_reviews (
            client_id,
            advisor_id,
            review_year,
            status
        ) VALUES (
            client_record.client_id,
            client_record.advisor_id,
            target_year,
            'pending'
        );
        records_created := records_created + 1;
    END LOOP;
    
    RETURN records_created;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION create_annual_review_records_for_year IS 'Creates annual review records for all clients for a specific year';

-- ============================================================================
-- PART 6: TRIGGER TO AUTO-CREATE ANNUAL REVIEW WHEN MEETING IS MARKED
-- ============================================================================

-- Function to automatically update annual review status when a meeting is marked as annual review
CREATE OR REPLACE FUNCTION update_annual_review_on_meeting_flag()
RETURNS TRIGGER AS $$
DECLARE
    review_year INTEGER;
    client_uuid UUID;
BEGIN
    -- Only proceed if is_annual_review is being set to TRUE
    IF NEW.is_annual_review = TRUE AND (OLD.is_annual_review IS NULL OR OLD.is_annual_review = FALSE) THEN
        -- Get the year from the meeting start time
        review_year := EXTRACT(YEAR FROM NEW.starttime)::INTEGER;
        client_uuid := NEW.client_id;
        
        -- Only proceed if we have a client_id
        IF client_uuid IS NOT NULL THEN
            -- Insert or update the annual review record
            INSERT INTO client_annual_reviews (
                client_id,
                advisor_id,
                review_year,
                review_date,
                meeting_id,
                status
            ) VALUES (
                client_uuid,
                NEW.userid::INTEGER,
                review_year,
                NEW.starttime::DATE,
                NEW.id,
                'completed'
            )
            ON CONFLICT (client_id, review_year) 
            DO UPDATE SET
                review_date = NEW.starttime::DATE,
                meeting_id = NEW.id,
                status = 'completed',
                updated_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update annual review when meeting is flagged
CREATE TRIGGER trigger_update_annual_review_on_meeting_flag
    AFTER INSERT OR UPDATE OF is_annual_review ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_annual_review_on_meeting_flag();

-- ============================================================================
-- PART 7: INITIALIZE ANNUAL REVIEW RECORDS FOR CURRENT YEAR
-- ============================================================================

-- Create annual review records for all existing clients for the current year
SELECT create_annual_review_records_for_year(EXTRACT(YEAR FROM NOW())::INTEGER) as records_created;

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

-- Verify new column was added to meetings table
SELECT 'meetings.is_annual_review column' as info, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name = 'is_annual_review';

-- Verify new table was created
SELECT 'client_annual_reviews table' as table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'client_annual_reviews';

-- Show sample of annual review records
SELECT 'annual review records sample' as info, COUNT(*) as total_records
FROM client_annual_reviews;

-- Show annual review dashboard sample
SELECT 'annual review dashboard sample' as info, COUNT(*) as total_clients
FROM annual_review_dashboard;

SELECT 'Migration completed successfully' as status;

