# Manual Database Migrations

Since automated migrations are encountering issues, please run these SQL statements manually in your Supabase SQL editor.

## Migration 1: Performance Indexes and Summary Columns

```sql
-- Add summary persistence columns (if not already added)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS quick_summary TEXT,
ADD COLUMN IF NOT EXISTS email_summary_draft TEXT,
ADD COLUMN IF NOT EXISTS email_template_id TEXT,
ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMP WITH TIME ZONE;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_meetings_last_summarized_at ON meetings(last_summarized_at);
CREATE INDEX IF NOT EXISTS idx_meetings_email_template_id ON meetings(email_template_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_starttime_desc ON meetings(starttime DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_userid ON meetings(userid);
CREATE INDEX IF NOT EXISTS idx_meetings_userid_starttime ON meetings(userid, starttime DESC);

-- Add clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_advisor_id ON clients(advisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_advisor_email ON clients(advisor_id, email);
```

## Migration 2: Ask Advicly Schema

```sql
-- Create ask_threads table for conversation threads
CREATE TABLE IF NOT EXISTS ask_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
```

## Migration 3: Row Level Security (RLS) Policies

```sql
-- Enable RLS on new tables
ALTER TABLE ask_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own threads
CREATE POLICY IF NOT EXISTS ask_threads_advisor_policy ON ask_threads
    FOR ALL USING (advisor_id = auth.uid());

-- Policy: Users can only access messages from their own threads
CREATE POLICY IF NOT EXISTS ask_messages_advisor_policy ON ask_messages
    FOR ALL USING (
        thread_id IN (
            SELECT id FROM ask_threads WHERE advisor_id = auth.uid()
        )
    );

-- Policy: Users can only update their own client avatars
CREATE POLICY IF NOT EXISTS clients_avatar_policy ON clients
    FOR UPDATE USING (advisor_id = auth.uid());
```

## Migration 4: Storage Setup

```sql
-- Create storage bucket for avatars (run this in Supabase dashboard or via API)
-- This needs to be done through the Supabase dashboard:
-- 1. Go to Storage in your Supabase dashboard
-- 2. Create a new bucket called "avatars"
-- 3. Set it to public if you want direct access to avatar URLs
-- 4. Configure RLS policies for the bucket if needed
```

## Verification Queries

After running the migrations, verify they worked with these queries:

```sql
-- Check if new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('quick_summary', 'email_summary_draft', 'email_template_id', 'last_summarized_at');

-- Check if new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('ask_threads', 'ask_messages');

-- Check if indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('meetings', 'clients', 'ask_threads', 'ask_messages')
AND indexname LIKE 'idx_%';

-- Check if avatar_url column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name = 'avatar_url';
```

## Notes

- Run these migrations in order
- The `IF NOT EXISTS` clauses make them safe to re-run
- Some statements may show warnings if objects already exist - this is normal
- Make sure to create the "avatars" storage bucket through the Supabase dashboard
- Test the RLS policies by trying to access data with different user contexts
