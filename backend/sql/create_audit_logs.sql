-- Audit Logs table for tracking security-relevant events
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Row Level Security: users can only see their own audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: users see own logs
CREATE POLICY "Users see own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: service role can insert (backend inserts via service role client)
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);
