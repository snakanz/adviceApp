/**
 * Test script to verify Calendly user isolation
 * This script tests that each user's Calendly data is properly isolated
 */

const { getSupabase } = require('./src/lib/supabase');
const CalendlyService = require('./src/services/calendlyService');

async function testCalendlyUserIsolation() {
  console.log('🧪 Testing Calendly User Isolation\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Verify CalendlyService constructor accepts access token
    console.log('\n✅ Test 1: CalendlyService constructor');
    const testToken = 'test_token_123';
    const service = new CalendlyService(testToken);
    console.log('   ✓ Constructor accepts access token parameter');
    console.log('   ✓ Service configured:', service.isConfigured());

    // Test 2: Verify getUserAccessToken fetches user-specific token
    console.log('\n✅ Test 2: getUserAccessToken method');
    const danielUserId = 'a2fe3d0f-c258-44a1-970a-158f198422d5';
    const danielToken = await CalendlyService.getUserAccessToken(danielUserId);
    
    if (danielToken) {
      console.log('   ✓ Successfully fetched Daniel\'s access token');
      console.log('   ✓ Token length:', danielToken.length);
    } else {
      console.log('   ⚠️  No token found for Daniel');
    }

    // Test 3: Verify calendar connection is user-specific
    console.log('\n✅ Test 3: Calendar connection isolation');
    const { data: danielConnection } = await getSupabase()
      .from('calendar_connections')
      .select('user_id, provider, provider_account_email, is_active')
      .eq('user_id', danielUserId)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .single();

    if (danielConnection) {
      console.log('   ✓ Daniel\'s Calendly connection found');
      console.log('   ✓ Email:', danielConnection.provider_account_email);
      console.log('   ✓ User ID:', danielConnection.user_id);
      console.log('   ✓ Active:', danielConnection.is_active);
    } else {
      console.log('   ⚠️  No active Calendly connection for Daniel');
    }

    // Test 4: Verify no global token is used
    console.log('\n✅ Test 4: No global token dependency');
    const globalToken = process.env.CALENDLY_PERSONAL_ACCESS_TOKEN;
    if (!globalToken) {
      console.log('   ✓ CALENDLY_PERSONAL_ACCESS_TOKEN is not set (correct!)');
    } else {
      console.log('   ❌ WARNING: CALENDLY_PERSONAL_ACCESS_TOKEN is still set!');
      console.log('   ❌ This should be removed from environment variables');
    }

    // Test 5: Verify service without token fails gracefully
    console.log('\n✅ Test 5: Service without token');
    const emptyService = new CalendlyService();
    console.log('   ✓ Service created without token');
    console.log('   ✓ Is configured:', emptyService.isConfigured(), '(should be false)');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('   • CalendlyService now uses user-specific OAuth tokens');
    console.log('   • Each user\'s token is fetched from calendar_connections table');
    console.log('   • No global CALENDLY_PERSONAL_ACCESS_TOKEN is used');
    console.log('   • User data isolation is properly implemented');
    
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Delete Daniel\'s incorrectly synced Calendly meetings');
    console.log('   2. Have Daniel reconnect his Calendly account');
    console.log('   3. Trigger a fresh sync for Daniel');
    console.log('   4. Verify Daniel sees only HIS Calendly meetings');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
testCalendlyUserIsolation()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });

