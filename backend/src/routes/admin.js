const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');

/**
 * POST /api/admin/update-subscription
 * Temporary admin endpoint to manually update a subscription
 * 
 * SECURITY: This should be removed or properly secured in production
 */
router.post('/update-subscription', async (req, res) => {
  try {
    const { userId, plan, status } = req.body;
    
    if (!userId || !plan) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and plan are required' 
      });
    }
    
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }
    
    console.log(`🔄 Admin: Updating subscription for user ${userId} to plan: ${plan}`);
    
    // Update subscription
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .update({
        plan,
        status: status || 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('❌ Error updating subscription:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Subscription updated successfully');
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return res.status(500).json({ error: verifyError.message });
    }
    
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: verifyData
    });
    
  } catch (error) {
    console.error('❌ Error in update-subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

