-- Ask Advicly database schema for persistent conversations
-- This creates tables for client-scoped chat threads and messages

-- Create ask_threads table for conversation threads
CREATE TABLE IF NOT EXISTS ask_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE
);

-- Create ask_messages table for individual messages in threads
CREATE TABLE IF NOT EXISTS ask_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES ask_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ask_threads_advisor_id ON ask_threads(advisor_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_client_id ON ask_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_advisor_client ON ask_threads(advisor_id, client_id);
CREATE INDEX IF NOT EXISTS idx_ask_threads_updated_at ON ask_threads(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ask_messages_thread_id ON ask_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ask_messages_created_at ON ask_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ask_messages_thread_created ON ask_messages(thread_id, created_at);

-- Add avatar_url column to clients table for avatar upload feature
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create RLS policies for security
ALTER TABLE ask_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own threads
CREATE POLICY ask_threads_advisor_policy ON ask_threads
    FOR ALL USING (advisor_id = (auth.jwt() ->> 'sub')::integer);

-- Policy: Users can only access messages from their own threads
CREATE POLICY ask_messages_advisor_policy ON ask_messages
    FOR ALL USING (
        thread_id IN (
            SELECT id FROM ask_threads WHERE advisor_id = (auth.jwt() ->> 'sub')::integer
        )
    );

-- Policy: Users can only update their own client avatars
CREATE POLICY clients_avatar_policy ON clients
    FOR UPDATE USING (advisor_id = (auth.jwt() ->> 'sub')::integer);
