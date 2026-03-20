/**
 * One-time script to set up Microsoft Calendar webhook for existing users
 * Run this after deploying the webhook auto-setup changes
 * 
 * Usage: node backend/setup-microsoft-webhook-for-user.js <user_email>
 */

require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');
const MicrosoftCalendarService = require('./src/services/microsoftCalendar');

async function setupMicrosoftWebhookForUser(userEmail) {
  try {
    console.log(`🔍 Looking up user: ${userEmail}...`);

    // Get user by email
    const { data: user, error: userError } = await getSupabase()
      .from('users')
      .select('id, email')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userEmail);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Check if user has Microsoft Calendar connection
    const { data: connection, error: connError } = await getSupabase()
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      console.error('❌ No active Microsoft Calendar connection found for this user');
      process.exit(1);
    }

    console.log(`✅ Found active Microsoft Calendar connection`);
    console.log(`   - Provider account: ${connection.provider_account_email}`);
    console.log(`   - Sync enabled: ${connection.sync_enabled}`);
    console.log(`   - Existing webhook: ${connection.microsoft_subscription_id || 'None'}`);

    // Set up webhook
    console.log('\n📡 Setting up Microsoft Calendar webhook...');
    const microsoftService = new MicrosoftCalendarService();

    try {
      const subscription = await microsoftService.setupCalendarWatch(user.id);
      
      console.log('\n✅ Microsoft Calendar webhook set up successfully!');
      console.log(`   - Subscription ID: ${subscription.id}`);
      console.log(`   - Expiration: ${subscription.expirationDateTime}`);
      console.log(`   - Webhook URL: ${process.env.BACKEND_URL || 'https://adviceapp-9rgw.onrender.com'}/api/calendar/microsoft/webhook`);
      
      console.log('\n🎉 Done! New meetings added in Outlook will now sync automatically.');
      
    } catch (webhookError) {
      console.error('\n❌ Failed to set up webhook:', webhookError.message);
      console.error('   Error details:', webhookError);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Usage: node backend/setup-microsoft-webhook-for-user.js <user_email>');
  process.exit(1);
}

setupMicrosoftWebhookForUser(userEmail);

