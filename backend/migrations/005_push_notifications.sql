-- Migration: Add push notifications support
-- This creates the necessary tables and functions for push notifications

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one subscription per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Meeting notifications
  meeting_reminders BOOLEAN DEFAULT true,
  meeting_summaries BOOLEAN DEFAULT true,
  meeting_updates BOOLEAN DEFAULT true,
  
  -- Client notifications
  client_updates BOOLEAN DEFAULT true,
  new_clients BOOLEAN DEFAULT true,
  
  -- Ask Advicly notifications
  ask_advicly_responses BOOLEAN DEFAULT true,
  
  -- General settings
  browser_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  
  -- Reminder timing (minutes before meeting)
  reminder_15_min BOOLEAN DEFAULT true,
  reminder_1_hour BOOLEAN DEFAULT false,
  reminder_1_day BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Create notification_log table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, delivered
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Related entities
  meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  thread_id INTEGER, -- For Ask Advicly threads
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification log
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_log_meeting_id ON notification_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_client_id ON notification_log(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at 
  BEFORE UPDATE ON push_subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
  BEFORE UPDATE ON notification_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Create function to get user notification preferences with defaults
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id INTEGER)
RETURNS notification_preferences AS $$
DECLARE
    prefs notification_preferences;
BEGIN
    SELECT * INTO prefs 
    FROM notification_preferences 
    WHERE user_id = p_user_id;
    
    -- If no preferences exist, create default ones
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO prefs;
    END IF;
    
    RETURN prefs;
END;
$$ LANGUAGE plpgsql;

-- Create function to log notifications
CREATE OR REPLACE FUNCTION log_notification(
    p_user_id INTEGER,
    p_notification_type VARCHAR(50),
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT NULL,
    p_meeting_id INTEGER DEFAULT NULL,
    p_client_id INTEGER DEFAULT NULL,
    p_thread_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO notification_log (
        user_id, notification_type, title, body, data,
        meeting_id, client_id, thread_id
    )
    VALUES (
        p_user_id, p_notification_type, p_title, p_body, p_data,
        p_meeting_id, p_client_id, p_thread_id
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update notification status
CREATE OR REPLACE FUNCTION update_notification_status(
    p_log_id INTEGER,
    p_status VARCHAR(20),
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notification_log 
    SET 
        status = p_status,
        error_message = p_error_message,
        sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
        delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END
    WHERE id = p_log_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON push_subscriptions TO postgres;
GRANT ALL ON notification_preferences TO postgres;
GRANT ALL ON notification_log TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
