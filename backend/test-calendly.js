require('dotenv').config();
const CalendlyService = require('./src/services/calendlyService');

async function testCalendly() {
  console.log('🧪 Testing Calendly Integration...');
  
  const calendlyService = new CalendlyService();
  
  // Check if configured
  console.log('📋 Configuration check:', calendlyService.isConfigured());
  
  if (!calendlyService.isConfigured()) {
    console.log('❌ Calendly not configured. Check CALENDLY_PERSONAL_ACCESS_TOKEN');
    return;
  }
  
  try {
    // Test getting current user
    console.log('👤 Getting current user...');
    const user = await calendlyService.getCurrentUser();
    console.log('✅ User:', user.name);
    console.log('📧 Email:', user.email);
    console.log('🔗 URI:', user.uri);
    
    // Test fetching events
    console.log('\n📅 Fetching scheduled events...');
    const events = await calendlyService.fetchScheduledEvents();
    console.log(`✅ Found ${events.length} events`);
    
    if (events.length > 0) {
      console.log('\n📋 First few events:');
      events.slice(0, 3).forEach((event, index) => {
        console.log(`${index + 1}. ${event.name}`);
        console.log(`   Start: ${event.start_time}`);
        console.log(`   Status: ${event.status}`);
        console.log(`   URI: ${event.uri}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No events found in the specified time range');
      console.log('   Time range: 3 months back to 6 months forward');
    }
    
    // Test sync to database
    console.log('🔄 Testing database sync...');
    const syncResult = await calendlyService.syncMeetingsToDatabase(1); // User ID 1
    console.log('✅ Sync result:', syncResult);
    
  } catch (error) {
    console.error('❌ Error testing Calendly:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCalendly();
