require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');

async function debugAPIFiltering() {
  console.log('🔍 Debugging API Filtering for Calendly Meetings...');
  
  const supabase = getSupabase();
  const userId = 1;
  
  try {
    // 1. Check all meetings without filtering
    console.log('\n📊 All meetings for user (no filtering):');
    const { data: allMeetings, error: allError } = await supabase
      .from('meetings')
      .select('id, title, meeting_source, is_deleted, sync_status')
      .eq('userid', userId);
    
    if (allError) {
      console.error('❌ Error querying all meetings:', allError);
      return;
    }
    
    console.log(`Total meetings: ${allMeetings.length}`);
    
    const bySource = allMeetings.reduce((acc, meeting) => {
      const source = meeting.meeting_source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('By source:', bySource);
    
    // 2. Check is_deleted values for Calendly meetings
    console.log('\n🔍 Calendly meetings is_deleted status:');
    const calendlyMeetings = allMeetings.filter(m => m.meeting_source === 'calendly');
    
    const deletedStatus = calendlyMeetings.reduce((acc, meeting) => {
      const status = meeting.is_deleted === null ? 'null' : 
                    meeting.is_deleted === true ? 'true' : 
                    meeting.is_deleted === false ? 'false' : 'other';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Calendly is_deleted values:', deletedStatus);
    
    // Show some examples
    console.log('\nFirst 3 Calendly meetings:');
    calendlyMeetings.slice(0, 3).forEach(meeting => {
      console.log(`  - ${meeting.title}: is_deleted=${meeting.is_deleted}, sync_status=${meeting.sync_status}`);
    });
    
    // 3. Test the exact API filtering
    console.log('\n🧪 Testing API filtering logic:');
    const { data: filteredMeetings, error: filterError } = await supabase
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false });
    
    if (filterError) {
      console.error('❌ Error with API filtering:', filterError);
      return;
    }
    
    console.log(`Filtered meetings: ${filteredMeetings.length}`);
    
    const filteredBySource = filteredMeetings.reduce((acc, meeting) => {
      const source = meeting.meeting_source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Filtered by source:', filteredBySource);
    
    // 4. Check if there are any Calendly meetings that pass the filter
    const filteredCalendly = filteredMeetings.filter(m => m.meeting_source === 'calendly');
    console.log(`\n📅 Calendly meetings passing filter: ${filteredCalendly.length}`);
    
    if (filteredCalendly.length === 0 && calendlyMeetings.length > 0) {
      console.log('\n❌ ISSUE FOUND: Calendly meetings exist but are being filtered out!');
      
      // Check what's filtering them out
      const blockedCalendly = calendlyMeetings.filter(meeting => 
        meeting.is_deleted === true
      );
      
      console.log(`Calendly meetings with is_deleted=true: ${blockedCalendly.length}`);
      
      if (blockedCalendly.length > 0) {
        console.log('Examples of blocked meetings:');
        blockedCalendly.slice(0, 3).forEach(meeting => {
          console.log(`  - ${meeting.title}: is_deleted=${meeting.is_deleted}`);
        });
      }
    }
    
    // 5. Test alternative filtering
    console.log('\n🔧 Testing alternative filtering (only is_deleted != true):');
    const { data: altFiltered, error: altError } = await supabase
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .neq('is_deleted', true)
      .order('starttime', { ascending: false });
    
    if (!altError) {
      const altBySource = altFiltered.reduce((acc, meeting) => {
        const source = meeting.meeting_source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`Alternative filter results: ${altFiltered.length} meetings`);
      console.log('Alternative by source:', altBySource);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugAPIFiltering();
