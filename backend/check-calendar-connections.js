require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnections() {
  try {
    const userId = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
    
    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('\n📊 Calendar Connections for user:', userId);
    console.log('='.repeat(80));
    
    if (connections && connections.length > 0) {
      connections.forEach((conn, idx) => {
        console.log(`\n${idx + 1}. ${conn.provider.toUpperCase()}`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Email: ${conn.provider_account_email || 'N/A'}`);
        console.log(`   is_active: ${conn.is_active}`);
        console.log(`   sync_enabled: ${conn.sync_enabled}`);
        console.log(`   last_sync_at: ${conn.last_sync_at || 'Never'}`);
        console.log(`   created_at: ${conn.created_at}`);
      });
    } else {
      console.log('No connections found');
    }
    
    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkConnections();
