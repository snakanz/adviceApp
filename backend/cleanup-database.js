require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCleanup() {
  console.log('🧹 Starting database cleanup...\n');
  
  try {
    // Show what will be deleted first
    console.log('📊 BEFORE DELETION:');
    
    const { count: meetingsCount } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('userid', 1);
    console.log(`   Meetings to delete: ${meetingsCount || 0}`);
    
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', 1);
    console.log(`   Clients to delete: ${clientsCount || 0}\n`);
    
    // Delete Ask Advicly messages
    console.log('🗑️  Deleting Ask Advicly messages...');
    const { data: threads } = await supabase
      .from('ask_threads')
      .select('id')
      .eq('advisor_id', 1);
    
    if (threads && threads.length > 0) {
      const threadIds = threads.map(t => t.id);
      const { error: msgError } = await supabase
        .from('ask_messages')
        .delete()
        .in('thread_id', threadIds);
      if (msgError) console.log(`   ⚠️  ${msgError.message}`);
    }
    
    // Delete Ask Advicly threads
    console.log('🗑️  Deleting Ask Advicly threads...');
    const { error: threadsError } = await supabase
      .from('ask_threads')
      .delete()
      .eq('advisor_id', 1);
    if (threadsError) console.log(`   ⚠️  ${threadsError.message}`);
    
    // Delete all meetings
    console.log('🗑️  Deleting all meetings...');
    const { error: meetingsError } = await supabase
      .from('meetings')
      .delete()
      .eq('userid', 1);
    if (meetingsError) console.log(`   ⚠️  ${meetingsError.message}`);
    
    // Delete all clients
    console.log('🗑️  Deleting all clients...');
    const { error: clientsError } = await supabase
      .from('clients')
      .delete()
      .eq('advisor_id', 1);
    if (clientsError) console.log(`   ⚠️  ${clientsError.message}`);
    
    // Delete calendar tokens
    console.log('🗑️  Deleting calendar tokens...');
    const { error: tokenError } = await supabase
      .from('calendartoken')
      .delete()
      .eq('userid', '1');
    if (tokenError) console.log(`   ⚠️  ${tokenError.message}`);
    
    // Verify deletion
    console.log('\n📊 AFTER DELETION:');
    const { count: remainingMeetings } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('userid', 1);
    console.log(`   Remaining meetings: ${remainingMeetings || 0}`);
    
    const { count: remainingClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', 1);
    console.log(`   Remaining clients: ${remainingClients || 0}`);
    
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('id', 1);
    console.log(`   Your user account preserved: ${userCount || 0}\n`);
    
    console.log('🎉 DATA WIPE COMPLETE! Your database is now clean and ready for fresh data.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runCleanup();

