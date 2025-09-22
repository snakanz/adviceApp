-- Action Items Schema Migration
-- This migration creates tables for the comprehensive Action Items feature
-- including ad-hoc tasks and meeting action tracking

-- Create advisor_tasks table for ad-hoc tasks
CREATE TABLE IF NOT EXISTS advisor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1=Highest, 5=Lowest
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting_action_items table to track meeting-related actions
CREATE TABLE IF NOT EXISTS meeting_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('transcript_needed', 'email_pending', 'follow_up_required')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_summaries table to track email sending status
CREATE TABLE IF NOT EXISTS email_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_advisor_tasks_advisor_id ON advisor_tasks(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_tasks_status ON advisor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_advisor_tasks_due_date ON advisor_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_advisor_tasks_priority ON advisor_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_advisor_id ON meeting_action_items(advisor_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_action_type ON meeting_action_items(action_type);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status);

CREATE INDEX IF NOT EXISTS idx_email_summaries_meeting_id ON email_summaries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_email_summaries_advisor_id ON email_summaries(advisor_id);
CREATE INDEX IF NOT EXISTS idx_email_summaries_status ON email_summaries(status);

-- Create functions to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_advisor_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_meeting_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_email_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER trigger_update_advisor_tasks_updated_at
    BEFORE UPDATE ON advisor_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_advisor_tasks_updated_at();

CREATE TRIGGER trigger_update_meeting_action_items_updated_at
    BEFORE UPDATE ON meeting_action_items
    FOR EACH ROW
    EXECUTE FUNCTION update_meeting_action_items_updated_at();

CREATE TRIGGER trigger_update_email_summaries_updated_at
    BEFORE UPDATE ON email_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_email_summaries_updated_at();

-- Create a comprehensive view for action items dashboard
CREATE OR REPLACE VIEW action_items_dashboard AS
SELECT 
    'meeting_transcript' as item_type,
    m.id as item_id,
    m.id as meeting_id,
    NULL as task_id,
    m.title as title,
    CONCAT('Add transcript for meeting: ', m.title) as description,
    'high' as priority_level,
    'transcript_needed' as action_type,
    m.starttime as meeting_date,
    NULL as due_date,
    m.userid as advisor_id,
    'pending' as status,
    m.created_at,
    m.updated_at
FROM meetings m
WHERE m.transcript IS NULL 
    AND m.starttime < NOW()
    AND m.starttime > NOW() - INTERVAL '30 days' -- Only show recent meetings

UNION ALL

SELECT 
    'meeting_email' as item_type,
    m.id as item_id,
    m.id as meeting_id,
    NULL as task_id,
    m.title as title,
    CONCAT('Send email summary for meeting: ', m.title) as description,
    'medium' as priority_level,
    'email_pending' as action_type,
    m.starttime as meeting_date,
    NULL as due_date,
    m.userid as advisor_id,
    CASE 
        WHEN es.status = 'sent' THEN 'completed'
        WHEN es.status = 'failed' THEN 'failed'
        ELSE 'pending'
    END as status,
    m.created_at,
    COALESCE(es.updated_at, m.updated_at) as updated_at
FROM meetings m
LEFT JOIN email_summaries es ON m.id = es.meeting_id
WHERE m.transcript IS NOT NULL 
    AND m.starttime < NOW()
    AND m.starttime > NOW() - INTERVAL '30 days' -- Only show recent meetings
    AND (es.status IS NULL OR es.status != 'sent')

UNION ALL

SELECT 
    'advisor_task' as item_type,
    at.id as item_id,
    NULL as meeting_id,
    at.id as task_id,
    at.title as title,
    at.description as description,
    CASE at.priority
        WHEN 1 THEN 'urgent'
        WHEN 2 THEN 'high'
        WHEN 3 THEN 'medium'
        WHEN 4 THEN 'low'
        WHEN 5 THEN 'lowest'
    END as priority_level,
    'ad_hoc_task' as action_type,
    NULL as meeting_date,
    at.due_date,
    at.advisor_id,
    at.status,
    at.created_at,
    at.updated_at
FROM advisor_tasks at
WHERE at.status != 'completed' AND at.status != 'cancelled';

-- Add comments for documentation
COMMENT ON TABLE advisor_tasks IS 'Ad-hoc tasks created by advisors for general task management';
COMMENT ON TABLE meeting_action_items IS 'Action items related to specific meetings (transcript, email, follow-up)';
COMMENT ON TABLE email_summaries IS 'Email summaries sent to clients with tracking status';
COMMENT ON VIEW action_items_dashboard IS 'Comprehensive view combining all action items for dashboard display';

COMMENT ON COLUMN advisor_tasks.priority IS '1=Urgent, 2=High, 3=Medium, 4=Low, 5=Lowest';
COMMENT ON COLUMN meeting_action_items.action_type IS 'Type of action needed: transcript_needed, email_pending, follow_up_required';
COMMENT ON COLUMN email_summaries.status IS 'Email status: draft, sent, failed';
