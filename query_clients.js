const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials from the MCP setup
const SUPABASE_URL = 'https://xjqjzievgepqpgtggcjx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sbp_6d2c0277984b21d4c876e5251e6cc4a9f7639146';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getClientCount() {
  try {
    console.log('🔍 Querying Supabase database...\n');
    
    // Get client details
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, pipeline_stage, is_active, created_at')
      .order('created_at', { ascending: false });
    
    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError.message);
      return;
    }
    
    console.log(`✅ Total Clients: ${clients?.length || 0}\n`);
    
    if (clients && clients.length > 0) {
      console.log('📋 Client Details:');
      console.log('─'.repeat(80));
      clients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.name || 'N/A'}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Pipeline Stage: ${client.pipeline_stage}`);
        console.log(`   Status: ${client.is_active ? '✅ Active' : '❌ Inactive'}`);
        console.log(`   Created: ${new Date(client.created_at).toLocaleDateString()}`);
        console.log('');
      });
    } else {
      console.log('📭 No clients found in your database.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getClientCount();
