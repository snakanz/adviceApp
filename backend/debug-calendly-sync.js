require('dotenv').config();
const CalendlyService = require('./src/services/calendlyService');
const { getSupabase } = require('./src/lib/supabase');

async function debugSync() {
  console.log('🔍 Debugging Calendly Sync Process...');
  
  const calendlyService = new CalendlyService();
  const supabase = getSupabase();
  
  try {
    // 1. Check existing Calendly meetings in database
    console.log('\n📊 Checking existing Calendly meetings in database...');
    const { data: existingMeetings, error: queryError } = await supabase
      .from('meetings')
      .select('id, title, meeting_source, calendly_event_uuid, googleeventid')
      .eq('userid', 1)
      .eq('meeting_source', 'calendly');
    
    if (queryError) {
      console.error('❌ Error querying existing meetings:', queryError);
    } else {
      console.log(`📋 Found ${existingMeetings.length} existing Calendly meetings in database`);
      if (existingMeetings.length > 0) {
        console.log('First few existing meetings:');
        existingMeetings.slice(0, 3).forEach(meeting => {
          console.log(`  - ${meeting.title} (UUID: ${meeting.calendly_event_uuid})`);
        });
      }
    }
    
    // 2. Get fresh Calendly events
    console.log('\n📅 Fetching fresh Calendly events...');
    const events = await calendlyService.fetchScheduledEvents();
    console.log(`✅ Found ${events.length} Calendly events from API`);
    
    if (events.length === 0) {
      console.log('❌ No events returned from Calendly API');
      return;
    }
    
    // 3. Check if events already exist in database
    console.log('\n🔍 Checking for duplicate events...');
    const eventUuids = events.map(event => event.uri.split('/').pop());
    
    const { data: existingUuids, error: uuidError } = await supabase
      .from('meetings')
      .select('calendly_event_uuid')
      .eq('userid', 1)
      .in('calendly_event_uuid', eventUuids);
    
    if (uuidError) {
      console.error('❌ Error checking existing UUIDs:', uuidError);
    } else {
      const existingUuidSet = new Set(existingUuids.map(row => row.calendly_event_uuid));
      const newEvents = events.filter(event => !existingUuidSet.has(event.uri.split('/').pop()));
      
      console.log(`📊 ${existingUuidSet.size} events already exist in database`);
      console.log(`📊 ${newEvents.length} new events to sync`);
      
      if (newEvents.length === 0) {
        console.log('ℹ️  All Calendly events are already synced to the database');
        return;
      }
    }
    
    // 4. Try to manually insert one event to test
    console.log('\n🧪 Testing manual event insertion...');
    const testEvent = events[0];
    const eventUuid = testEvent.uri.split('/').pop();
    
    // Get invitees for this event
    const invitees = await calendlyService.getEventInvitees(eventUuid);
    console.log(`👥 Found ${invitees.length} invitees for test event`);
    
    const attendees = invitees.map(invitee => ({
      email: invitee.email,
      displayName: invitee.name,
      responseStatus: 'accepted'
    }));
    
    const testMeetingData = {
      userid: 1,
      googleeventid: `calendly_${eventUuid}`,
      title: testEvent.name || 'Calendly Meeting',
      starttime: testEvent.start_time,
      endtime: testEvent.end_time,
      summary: `Calendly meeting: ${testEvent.name}`,
      attendees: JSON.stringify(attendees),
      meeting_source: 'calendly',
      calendly_event_uri: testEvent.uri,
      calendly_event_uuid: eventUuid,
      location: testEvent.location?.location || null,
      is_deleted: false,
      sync_status: 'active',
      last_calendar_sync: new Date().toISOString()
    };
    
    console.log('📝 Test meeting data:', {
      title: testMeetingData.title,
      starttime: testMeetingData.starttime,
      meeting_source: testMeetingData.meeting_source,
      calendly_event_uuid: testMeetingData.calendly_event_uuid
    });
    
    const { data: insertResult, error: insertError } = await supabase
      .from('meetings')
      .insert(testMeetingData)
      .select();
    
    if (insertError) {
      console.error('❌ Failed to insert test meeting:', insertError);
    } else {
      console.log('✅ Successfully inserted test meeting:', insertResult[0].id);
      console.log('🎉 Database schema is working correctly!');
      
      // Clean up test meeting
      await supabase
        .from('meetings')
        .delete()
        .eq('id', insertResult[0].id);
      console.log('🧹 Cleaned up test meeting');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugSync();
