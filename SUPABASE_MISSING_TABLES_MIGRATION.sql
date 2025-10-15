-- ============================================================================
-- SUPABASE MISSING TABLES MIGRATION
-- ============================================================================
-- Purpose: Create missing tables that are causing 500 errors in production
-- Date: 2025-10-15
-- Issue: Pipeline entry creation fails because pipeline_activities table doesn't exist
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard
-- 2. Navigate to your project
-- 3. Go to SQL Editor
-- 4. Copy and paste this entire file
-- 5. Click "Run" to execute
-- 6. Verify success by checking the Tables section
--
-- This migration creates:
-- - pipeline_activities table (for tracking client interactions)
-- - client_todos table (for task management per client)
-- - pipeline_templates table (for todo templates)
-- - pipeline_next_steps column in clients table
-- - pipeline_next_steps_generated_at column in clients table
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE PIPELINE_ACTIVITIES TABLE
-- ============================================================================
-- This table tracks all client interactions and pipeline changes
-- Used by: backend/src/routes/clients.js (lines 1029, 1088, 1448)

CREATE TABLE IF NOT EXISTS pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'stage_change', 'todo_completed')),
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}', -- Store additional activity-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_client_id ON pipeline_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_advisor_id ON pipeline_activities(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_type ON pipeline_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_date ON pipeline_activities(activity_date DESC);

-- Add RLS (Row Level Security) for security
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;

-- Create policy: Advisors can only see their own activities
CREATE POLICY pipeline_activities_advisor_policy ON pipeline_activities
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Add comment to document the table purpose
COMMENT ON TABLE pipeline_activities IS 'Tracks all client interactions and pipeline changes for activity history';
COMMENT ON COLUMN pipeline_activities.activity_type IS 'Type of activity: call, email, meeting, note, stage_change, todo_completed';
COMMENT ON COLUMN pipeline_activities.metadata IS 'Additional activity-specific data stored as JSON';

-- ============================================================================
-- PART 2: CREATE CLIENT_TODOS TABLE
-- ============================================================================
-- This table manages tasks/todos for each client
-- Used by: Pipeline management features

CREATE TABLE IF NOT EXISTS client_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1=highest, 5=lowest
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'follow_up', 'meeting', 'document', 'research', 'proposal'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_todos_client_id ON client_todos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_advisor_id ON client_todos(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_status ON client_todos(status);
CREATE INDEX IF NOT EXISTS idx_client_todos_due_date ON client_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_client_todos_priority ON client_todos(priority);

-- Add RLS for security
ALTER TABLE client_todos ENABLE ROW LEVEL SECURITY;

-- Create policy: Advisors can only see their own todos
CREATE POLICY client_todos_advisor_policy ON client_todos
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Add comment to document the table purpose
COMMENT ON TABLE client_todos IS 'Task management for each client with priority, status, and due dates';
COMMENT ON COLUMN client_todos.priority IS '1=highest priority, 5=lowest priority';
COMMENT ON COLUMN client_todos.status IS 'pending, in_progress, completed, or cancelled';
COMMENT ON COLUMN client_todos.category IS 'general, follow_up, meeting, document, research, or proposal';

-- ============================================================================
-- PART 3: CREATE PIPELINE_TEMPLATES TABLE
-- ============================================================================
-- This table stores reusable todo templates for different pipeline stages

CREATE TABLE IF NOT EXISTS pipeline_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    stage TEXT NOT NULL, -- Which pipeline stage this template applies to
    todos JSONB NOT NULL, -- Array of todo templates
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_advisor_id ON pipeline_templates(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_stage ON pipeline_templates(stage);

-- Add RLS for security
ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;

-- Create policy: Advisors can only see their own templates
CREATE POLICY pipeline_templates_advisor_policy ON pipeline_templates
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Add comment to document the table purpose
COMMENT ON TABLE pipeline_templates IS 'Reusable todo templates for different pipeline stages';
COMMENT ON COLUMN pipeline_templates.todos IS 'Array of todo templates stored as JSON';

-- ============================================================================
-- PART 4: ADD PIPELINE_NEXT_STEPS COLUMNS TO CLIENTS TABLE
-- ============================================================================
-- These columns store AI-generated next steps for pipeline management

-- Add pipeline_next_steps column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_next_steps TEXT;

-- Add timestamp column to track when the summary was generated
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_next_steps_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance when querying by generation timestamp
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_next_steps_generated_at 
ON clients(pipeline_next_steps_generated_at);

-- Add comments to document the column purpose
COMMENT ON COLUMN clients.pipeline_next_steps IS 'AI-generated summary of next steps to close the deal, generated from pipeline stage, business types, and recent meeting action points';
COMMENT ON COLUMN clients.pipeline_next_steps_generated_at IS 'Timestamp when the pipeline next steps summary was last generated';

-- ============================================================================
-- PART 5: CREATE TRIGGER FUNCTIONS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at on client_todos
DROP TRIGGER IF EXISTS update_client_todos_updated_at ON client_todos;
CREATE TRIGGER update_client_todos_updated_at BEFORE UPDATE ON client_todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for updated_at on pipeline_templates
DROP TRIGGER IF EXISTS update_pipeline_templates_updated_at ON pipeline_templates;
CREATE TRIGGER update_pipeline_templates_updated_at BEFORE UPDATE ON pipeline_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 6: ADD ADDITIONAL PIPELINE FIELDS TO CLIENTS TABLE (IF MISSING)
-- ============================================================================
-- These fields may already exist, but we add them if they don't

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5);

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS next_follow_up_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of tags for categorization

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS source TEXT; -- How the client was acquired

-- Create indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_clients_likely_close_month ON clients(likely_close_month);
CREATE INDEX IF NOT EXISTS idx_clients_priority_level ON clients(priority_level);
CREATE INDEX IF NOT EXISTS idx_clients_last_contact_date ON clients(last_contact_date);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after the migration to verify everything was created

-- Check if pipeline_activities table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_activities'
) AS pipeline_activities_exists;

-- Check if client_todos table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'client_todos'
) AS client_todos_exists;

-- Check if pipeline_templates table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_templates'
) AS pipeline_templates_exists;

-- Check if pipeline_next_steps column exists in clients table
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'pipeline_next_steps'
) AS pipeline_next_steps_column_exists;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- If you see this message, the migration completed successfully!

DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '✅ Created pipeline_activities table';
    RAISE NOTICE '✅ Created client_todos table';
    RAISE NOTICE '✅ Created pipeline_templates table';
    RAISE NOTICE '✅ Added pipeline_next_steps columns to clients table';
    RAISE NOTICE '✅ Created all necessary indexes and RLS policies';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '1. Wait for backend deployment to complete (~2-3 minutes)';
    RAISE NOTICE '2. Test creating a pipeline entry from the Clients page';
    RAISE NOTICE '3. Verify the pipeline entry appears in the Client Pipeline page';
    RAISE NOTICE '';
    RAISE NOTICE '📊 The backend will now successfully log pipeline activities!';
END $$;

