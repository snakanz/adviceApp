-- Clean Pipeline Enhancement Migration for Advicly
-- Only adds database structure - NO test data
-- Run this SQL in your Supabase SQL Editor

-- =====================================================
-- PART 1: Enhanced Client Pipeline Management Schema
-- =====================================================

-- Add additional pipeline fields to existing clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'unscheduled' CHECK (pipeline_stage IN ('unscheduled', 'prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS assigned_advisor INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create client_todos table for task management per client
CREATE TABLE IF NOT EXISTS client_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'follow_up', 'meeting', 'document', 'research', 'proposal'))
);

-- Create pipeline_activities table for tracking client interactions
CREATE TABLE IF NOT EXISTS pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'stage_change', 'todo_completed')),
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 2: Create Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_todos_client_id ON client_todos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_advisor_id ON client_todos(advisor_id);
CREATE INDEX IF NOT EXISTS idx_client_todos_status ON client_todos(status);
CREATE INDEX IF NOT EXISTS idx_client_todos_due_date ON client_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_client_todos_priority ON client_todos(priority);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_client_id ON pipeline_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_advisor_id ON pipeline_activities(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_type ON pipeline_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_date ON pipeline_activities(activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_clients_likely_close_month ON clients(likely_close_month);
CREATE INDEX IF NOT EXISTS idx_clients_priority_level ON clients(priority_level);
CREATE INDEX IF NOT EXISTS idx_clients_last_contact_date ON clients(last_contact_date);

-- =====================================================
-- PART 3: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE client_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;

-- Policies for client_todos
DROP POLICY IF EXISTS client_todos_advisor_policy ON client_todos;
CREATE POLICY client_todos_advisor_policy ON client_todos
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Policies for pipeline_activities  
DROP POLICY IF EXISTS pipeline_activities_advisor_policy ON pipeline_activities;
CREATE POLICY pipeline_activities_advisor_policy ON pipeline_activities
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- =====================================================
-- PART 4: Utility Functions and Triggers
-- =====================================================

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_client_todos_updated_at ON client_todos;
CREATE TRIGGER update_client_todos_updated_at BEFORE UPDATE ON client_todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 5: Verification Queries
-- =====================================================

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('client_todos', 'pipeline_activities')
ORDER BY table_name;

-- Verify columns were added to clients table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('pipeline_stage', 'priority_level', 'last_contact_date', 'next_follow_up_date', 'notes', 'tags', 'source', 'assigned_advisor')
ORDER BY column_name;

-- Success message
SELECT 'Clean pipeline migration completed successfully!' as status;
