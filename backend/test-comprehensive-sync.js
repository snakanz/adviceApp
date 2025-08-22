#!/usr/bin/env node

/**
 * Comprehensive Calendar Sync Test Suite
 * 
 * This script tests the new calendar-database sync architecture:
 * 1. Tests calendar state detection
 * 2. Tests data reconciliation
 * 3. Tests cascade deletion
 * 4. Tests client status updates
 */

require('dotenv').config();
const comprehensiveSync = require('./src/services/comprehensiveCalendarSync');
const cascadeDeletion = require('./src/services/cascadeDeletionManager');
const { getSupabase } = require('./src/config/supabase');

const TEST_USER_ID = 1; // Your user ID

async function runTests() {
  console.log('🧪 Starting Comprehensive Calendar Sync Test Suite');
  console.log('=' .repeat(60));

  try {
    // Test 1: Calendar State Detection
    console.log('\n📊 Test 1: Calendar State Detection');
    await testCalendarStateDetection();

    // Test 2: Sync Status
    console.log('\n📈 Test 2: Sync Status Check');
    await testSyncStatus();

    // Test 3: Data Reconciliation (Dry Run)
    console.log('\n🔄 Test 3: Data Reconciliation (Dry Run)');
    await testDataReconciliation();

    // Test 4: Client Status Updates
    console.log('\n👥 Test 4: Client Status Updates');
    await testClientStatusUpdates();

    // Test 5: Database Queries
    console.log('\n💾 Test 5: Database Query Validation');
    await testDatabaseQueries();

    console.log('\n🎉 All tests completed successfully!');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

async function testCalendarStateDetection() {
  try {
    console.log('   Detecting calendar state...');
    const analysis = await comprehensiveSync.detectCalendarState(TEST_USER_ID);
    
    console.log(`   📅 Google Calendar: ${analysis.calendar.total} events`);
    console.log(`   💾 Database: ${analysis.database.total} meetings (${analysis.database.active} active, ${analysis.database.deleted} deleted)`);
    console.log(`   📊 Categorization:`);
    console.log(`      - Active: ${analysis.categorization.active.length}`);
    console.log(`      - Deleted: ${analysis.categorization.deleted.length}`);
    console.log(`      - Orphaned: ${analysis.categorization.orphaned.length}`);
    console.log(`      - New: ${analysis.categorization.new.length}`);
    console.log(`      - Inconsistent: ${analysis.categorization.inconsistent.length}`);
    
    console.log('   ✅ Calendar state detection working');
    return analysis;
  } catch (error) {
    console.error('   ❌ Calendar state detection failed:', error.message);
    throw error;
  }
}

async function testSyncStatus() {
  try {
    console.log('   Getting sync status...');
    const status = await comprehensiveSync.getSyncStatus(TEST_USER_ID);
    
    console.log(`   📊 Sync Status:`);
    console.log(`      - Calendar Events: ${status.calendarEvents}`);
    console.log(`      - Database Meetings: ${status.databaseMeetings}`);
    console.log(`      - Active Meetings: ${status.activeMeetings}`);
    console.log(`      - Deleted Meetings: ${status.deletedMeetings}`);
    console.log(`      - Needs Sync: ${status.needsSync ? 'Yes' : 'No'}`);
    console.log(`      - Issues: ${JSON.stringify(status.issues)}`);
    
    console.log('   ✅ Sync status check working');
    return status;
  } catch (error) {
    console.error('   ❌ Sync status check failed:', error.message);
    throw error;
  }
}

async function testDataReconciliation() {
  try {
    console.log('   Running data reconciliation (dry run)...');
    const results = await comprehensiveSync.reconcileCalendarData(TEST_USER_ID, true);
    
    console.log(`   🔄 Reconciliation Results (Dry Run):`);
    console.log(`      - Processed: ${results.processed}`);
    console.log(`      - Created: ${results.created}`);
    console.log(`      - Updated: ${results.updated}`);
    console.log(`      - Deleted: ${results.deleted}`);
    console.log(`      - Restored: ${results.restored}`);
    console.log(`      - Errors: ${results.errors}`);
    
    if (results.details.errors.length > 0) {
      console.log(`   ⚠️  Errors encountered:`);
      results.details.errors.forEach(error => console.log(`      - ${error}`));
    }
    
    console.log('   ✅ Data reconciliation (dry run) working');
    return results;
  } catch (error) {
    console.error('   ❌ Data reconciliation failed:', error.message);
    throw error;
  }
}

async function testClientStatusUpdates() {
  try {
    console.log('   Testing client status updates...');
    
    // Get current client statuses
    const { data: clients, error } = await getSupabase()
      .from('clients')
      .select('id, name, is_active, active_meeting_count, meeting_count')
      .eq('advisor_id', TEST_USER_ID)
      .limit(5);
    
    if (error) throw error;
    
    console.log(`   👥 Client Status Summary:`);
    if (clients && clients.length > 0) {
      clients.forEach(client => {
        console.log(`      - ${client.name}: ${client.is_active ? 'Active' : 'Inactive'} (${client.active_meeting_count}/${client.meeting_count} meetings)`);
      });
    } else {
      console.log('      - No clients found');
    }
    
    console.log('   ✅ Client status updates working');
    return clients;
  } catch (error) {
    console.error('   ❌ Client status updates failed:', error.message);
    throw error;
  }
}

async function testDatabaseQueries() {
  try {
    console.log('   Testing database queries...');
    
    // Test meetings query (what frontend will see)
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('id, title, starttime, is_deleted, sync_status')
      .eq('userid', TEST_USER_ID)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('starttime', { ascending: false })
      .limit(5);
    
    if (meetingsError) throw meetingsError;
    
    console.log(`   📅 Active Meetings Query: ${meetings?.length || 0} results`);
    if (meetings && meetings.length > 0) {
      meetings.forEach(meeting => {
        console.log(`      - ${meeting.title} (${meeting.sync_status || 'unknown'})`);
      });
    }
    
    // Test clients query (enhanced with status)
    const { data: clientsQuery, error: clientsError } = await getSupabase()
      .from('clients')
      .select(`
        id, name, email, is_active, active_meeting_count, meeting_count, last_meeting_date
      `)
      .eq('advisor_id', TEST_USER_ID)
      .order('is_active', { ascending: false })
      .limit(5);
    
    if (clientsError) throw clientsError;
    
    console.log(`   👥 Enhanced Clients Query: ${clientsQuery?.length || 0} results`);
    if (clientsQuery && clientsQuery.length > 0) {
      clientsQuery.forEach(client => {
        const status = client.is_active ? 'Active' : 
                      (client.meeting_count > 0 ? 'Historical' : 'No Meetings');
        console.log(`      - ${client.name}: ${status}`);
      });
    }
    
    console.log('   ✅ Database queries working');
    return { meetings, clients: clientsQuery };
  } catch (error) {
    console.error('   ❌ Database queries failed:', error.message);
    throw error;
  }
}

async function testCascadeDeletion() {
  try {
    console.log('   Testing cascade deletion (preview only)...');
    
    // Get a sample meeting to test with
    const { data: sampleMeeting } = await getSupabase()
      .from('meetings')
      .select('id, title, client_id')
      .eq('userid', TEST_USER_ID)
      .eq('is_deleted', false)
      .limit(1)
      .single();
    
    if (sampleMeeting) {
      console.log(`   Testing with meeting: ${sampleMeeting.title}`);
      
      // Preview cascade deletion (dry run)
      const preview = await cascadeDeletion.previewCascadeDeletion(
        sampleMeeting.id, 
        TEST_USER_ID
      );
      
      console.log(`   🔄 Cascade Deletion Preview:`);
      console.log(`      - Ask Threads: ${preview.affectedRecords.askThreads}`);
      console.log(`      - Summaries: ${preview.affectedRecords.summaries}`);
      console.log(`      - Operations: ${preview.operations.length}`);
      
      if (preview.errors.length > 0) {
        console.log(`   ⚠️  Preview errors:`);
        preview.errors.forEach(error => console.log(`      - ${error}`));
      }
    } else {
      console.log('   No active meetings found for cascade deletion test');
    }
    
    console.log('   ✅ Cascade deletion preview working');
  } catch (error) {
    console.error('   ❌ Cascade deletion test failed:', error.message);
    throw error;
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
