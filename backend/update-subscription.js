require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSubscription() {
  const userId = '1051f768-57ce-45d2-8963-3ba04d23ef65';
  
  console.log('🔄 Updating subscription for user:', userId);
  
  try {
    // Update subscription to professional plan
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan: 'professional',
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('❌ Error updating subscription:', error);
      process.exit(1);
    }
    
    console.log('✅ Subscription updated successfully!');
    console.log('Updated data:', JSON.stringify(data, null, 2));
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      process.exit(1);
    }
    
    console.log('\n📊 Current subscription status:');
    console.log('  User ID:', verifyData.user_id);
    console.log('  Plan:', verifyData.plan);
    console.log('  Status:', verifyData.status);
    console.log('  Stripe Subscription ID:', verifyData.stripe_subscription_id || 'null');
    console.log('  Updated At:', verifyData.updated_at);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

updateSubscription();

