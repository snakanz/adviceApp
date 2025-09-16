require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');

async function fixCalendlyDeletedStatus() {
  console.log('🔧 Fixing Calendly meetings is_deleted status...');
  
  const supabase = getSupabase();
  
  try {
    // 1. Check current status
    console.log('\n📊 Current status of Calendly meetings:');
    const { data: calendlyMeetings, error: queryError } = await supabase
      .from('meetings')
      .select('id, title, is_deleted, sync_status')
      .eq('userid', 1)
      .eq('meeting_source', 'calendly');
    
    if (queryError) {
      console.error('❌ Error querying Calendly meetings:', queryError);
      return;
    }
    
    console.log(`Found ${calendlyMeetings.length} Calendly meetings`);
    
    const deletedCount = calendlyMeetings.filter(m => m.is_deleted === true).length;
    const notDeletedCount = calendlyMeetings.filter(m => m.is_deleted !== true).length;
    
    console.log(`  - is_deleted=true: ${deletedCount}`);
    console.log(`  - is_deleted=false/null: ${notDeletedCount}`);
    
    if (deletedCount === 0) {
      console.log('✅ All Calendly meetings already have correct is_deleted status');
      return;
    }
    
    // 2. Update all Calendly meetings to is_deleted=false
    console.log('\n🔄 Updating Calendly meetings to is_deleted=false...');
    
    const { data: updateResult, error: updateError } = await supabase
      .from('meetings')
      .update({ 
        is_deleted: false,
        sync_status: 'active',
        last_calendar_sync: new Date().toISOString()
      })
      .eq('userid', 1)
      .eq('meeting_source', 'calendly')
      .eq('is_deleted', true)
      .select('id, title');
    
    if (updateError) {
      console.error('❌ Error updating Calendly meetings:', updateError);
      return;
    }
    
    console.log(`✅ Successfully updated ${updateResult.length} Calendly meetings`);
    
    // 3. Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const { data: verifyMeetings, error: verifyError } = await supabase
      .from('meetings')
      .select('id, title, is_deleted')
      .eq('userid', 1)
      .eq('meeting_source', 'calendly');
    
    if (verifyError) {
      console.error('❌ Error verifying fix:', verifyError);
      return;
    }
    
    const stillDeleted = verifyMeetings.filter(m => m.is_deleted === true).length;
    const nowActive = verifyMeetings.filter(m => m.is_deleted === false).length;
    
    console.log(`After fix:`);
    console.log(`  - is_deleted=true: ${stillDeleted}`);
    console.log(`  - is_deleted=false: ${nowActive}`);
    
    if (stillDeleted === 0) {
      console.log('🎉 All Calendly meetings are now active!');
    } else {
      console.log('⚠️  Some meetings still marked as deleted');
    }
    
    // 4. Test API response
    console.log('\n🧪 Testing API response after fix...');
    const { data: apiMeetings, error: apiError } = await supabase
      .from('meetings')
      .select('id, title, meeting_source')
      .eq('userid', 1)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false });
    
    if (apiError) {
      console.error('❌ Error testing API response:', apiError);
      return;
    }
    
    const apiBySource = apiMeetings.reduce((acc, meeting) => {
      const source = meeting.meeting_source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`API will now return ${apiMeetings.length} meetings:`);
    console.log('By source:', apiBySource);
    
    if (apiBySource.calendly > 0) {
      console.log('🎉 SUCCESS: Calendly meetings will now appear in the frontend!');
    } else {
      console.log('❌ Issue persists: Calendly meetings still not in API response');
    }
    
  } catch (error) {
    console.error('❌ Fix error:', error);
  }
}

fixCalendlyDeletedStatus();
