-- Add free meetings tracking to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS free_meetings_limit INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS free_meetings_used INTEGER DEFAULT 0;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_free_meetings ON subscriptions(user_id, free_meetings_used);

-- Update existing subscriptions to have the free meetings limit
UPDATE subscriptions 
SET free_meetings_limit = 5, 
    free_meetings_used = 0 
WHERE free_meetings_limit IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.free_meetings_limit IS 'Number of free AI-transcribed meetings allowed before requiring subscription';
COMMENT ON COLUMN subscriptions.free_meetings_used IS 'Number of free AI-transcribed meetings used (meetings with successful Recall bot transcription)';

