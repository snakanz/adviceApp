require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('🔄 Creating calendar_watch_channels table...\n');
  
  try {
    // Try to query the table first to see if it exists
    const { data: existingData, error: existingError } = await supabase
      .from('calendar_watch_channels')
      .select('*')
      .limit(1);
    
    if (!existingError) {
      console.log('✅ Table already exists and is accessible');
      return;
    }
    
    console.log('⚠️  Table does not exist or is not accessible');
    console.log('📝 Please run the following SQL in Supabase SQL Editor:\n');
    console.log('-----------------------------------------------------------');
    console.log(`
CREATE TABLE IF NOT EXISTS calendar_watch_channels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMP NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS calendar_watch_channels_user_id_idx ON calendar_watch_channels(user_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_channel_id_idx ON calendar_watch_channels(channel_id);
CREATE INDEX IF NOT EXISTS calendar_watch_channels_expiration_idx ON calendar_watch_channels(expiration);

COMMENT ON TABLE calendar_watch_channels IS 'Stores Google Calendar webhook channel information for push notifications';
    `);
    console.log('-----------------------------------------------------------\n');
    console.log('📍 Go to: https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/sql/new');
    console.log('📋 Copy and paste the SQL above');
    console.log('▶️  Click "Run" to create the table\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTable();

