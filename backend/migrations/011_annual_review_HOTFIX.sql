-- HOTFIX for Annual Review Trigger Function
-- Fixes "column reference 'review_year' is ambiguous" error
-- 
-- This hotfix replaces the trigger function with corrected variable names
-- to avoid ambiguity between PL/pgSQL variables and table columns.
--
-- Run this in Supabase SQL Editor to fix the error.

-- Drop and recreate the trigger function with fixed variable names
CREATE OR REPLACE FUNCTION update_annual_review_on_meeting_flag()
RETURNS TRIGGER AS $$
DECLARE
    v_review_year INTEGER;
    v_client_uuid UUID;
BEGIN
    -- Only proceed if is_annual_review is being set to TRUE
    IF NEW.is_annual_review = TRUE AND (OLD.is_annual_review IS NULL OR OLD.is_annual_review = FALSE) THEN
        -- Get the year from the meeting start time
        v_review_year := EXTRACT(YEAR FROM NEW.starttime)::INTEGER;
        v_client_uuid := NEW.client_id;
        
        -- Only proceed if we have a client_id
        IF v_client_uuid IS NOT NULL THEN
            -- Insert or update the annual review record
            INSERT INTO client_annual_reviews (
                client_id,
                advisor_id,
                review_year,
                review_date,
                meeting_id,
                status
            ) VALUES (
                v_client_uuid,
                NEW.userid::INTEGER,
                v_review_year,
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

-- Verify the function was updated
SELECT 'Hotfix applied successfully - trigger function updated' as status;

