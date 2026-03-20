-- Complete Pipeline Enhancement Migration for Advicly
-- Run this SQL in your Supabase SQL Editor or via psql

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
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags for categorization
ADD COLUMN IF NOT EXISTS source TEXT, -- How the client was acquired
ADD COLUMN IF NOT EXISTS assigned_advisor TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Create client_todos table for task management per client
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

-- Create pipeline_activities table for tracking client interactions
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

-- Create pipeline_templates table for todo templates
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

CREATE INDEX IF NOT EXISTS idx_pipeline_templates_advisor_id ON pipeline_templates(advisor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_stage ON pipeline_templates(stage);

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
ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;

-- Policies for client_todos
DROP POLICY IF EXISTS client_todos_advisor_policy ON client_todos;
CREATE POLICY client_todos_advisor_policy ON client_todos
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Policies for pipeline_activities  
DROP POLICY IF EXISTS pipeline_activities_advisor_policy ON pipeline_activities;
CREATE POLICY pipeline_activities_advisor_policy ON pipeline_activities
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Policies for pipeline_templates
DROP POLICY IF EXISTS pipeline_templates_advisor_policy ON pipeline_templates;
CREATE POLICY pipeline_templates_advisor_policy ON pipeline_templates
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

DROP TRIGGER IF EXISTS update_pipeline_templates_updated_at ON pipeline_templates;
CREATE TRIGGER update_pipeline_templates_updated_at BEFORE UPDATE ON pipeline_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 5: Insert Default Pipeline Templates
-- =====================================================

-- Insert default pipeline templates (only if they don't exist)
INSERT INTO pipeline_templates (advisor_id, name, description, stage, todos) 
SELECT 1, 'New Client Onboarding', 'Standard tasks for new prospective clients', 'prospecting', 
 '[
   {"title": "Send welcome email", "description": "Send initial welcome and information gathering email", "priority": 2, "category": "follow_up"},
   {"title": "Schedule discovery call", "description": "Book initial consultation meeting", "priority": 1, "category": "meeting"},
   {"title": "Prepare client questionnaire", "description": "Create and send client information form", "priority": 3, "category": "document"},
   {"title": "Research client background", "description": "Research client business and financial situation", "priority": 3, "category": "research"}
 ]'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_templates 
    WHERE advisor_id = 1 AND name = 'New Client Onboarding'
);

INSERT INTO pipeline_templates (advisor_id, name, description, stage, todos)
SELECT 1, 'Proposal Stage', 'Tasks for clients in proposal stage', 'proposal',
 '[
   {"title": "Prepare proposal document", "description": "Create detailed financial proposal", "priority": 1, "category": "document"},
   {"title": "Schedule proposal presentation", "description": "Book meeting to present proposal", "priority": 1, "category": "meeting"},
   {"title": "Follow up on proposal", "description": "Check client feedback on proposal", "priority": 2, "category": "follow_up"},
   {"title": "Address client questions", "description": "Respond to any proposal questions or concerns", "priority": 2, "category": "general"}
 ]'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_templates 
    WHERE advisor_id = 1 AND name = 'Proposal Stage'
);

-- =====================================================
-- PART 6: Verification Queries
-- =====================================================

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('client_todos', 'pipeline_activities', 'pipeline_templates')
ORDER BY table_name;

-- Verify columns were added to clients table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('pipeline_stage', 'priority_level', 'last_contact_date', 'next_follow_up_date', 'notes', 'tags', 'source', 'assigned_advisor')
ORDER BY column_name;

-- Check if templates were inserted
SELECT name, stage, jsonb_array_length(todos) as todo_count 
FROM pipeline_templates 
WHERE advisor_id = 1;

-- Success message
SELECT 'Pipeline enhancement migration completed successfully!' as status;
