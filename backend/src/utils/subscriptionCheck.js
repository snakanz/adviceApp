/**
 * Shared utility for checking user subscription/free trial access
 * Used across all services that schedule Recall bots
 */

const { getSupabase } = require('../lib/supabase');

/**
 * Check if user has access to transcription (5 free meetings or paid subscription)
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} - True if user has access, false otherwise
 */
async function checkUserHasTranscriptionAccess(userId) {
  try {
    // Get subscription
    const { data: subscription } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if user has active paid subscription
    const isPaid = subscription &&
                   (subscription.status === 'active' || subscription.status === 'trialing') &&
                   subscription.plan !== 'free';

    if (isPaid) {
      return true; // User has paid, unlimited access
    }

    // Count meetings with SUCCESSFUL Recall bot transcription (fair counting)
    // Only count meetings where user got actual value:
    // 1. Has recall_bot_id and completed status
    // 2. Has meaningful transcript content (100+ chars)
    // 3. Was NOT a waiting room timeout or no-participant failure
    const { data: transcribedMeetings } = await getSupabase()
      .from('meetings')
      .select('id, transcript, recall_error')
      .eq('user_id', userId)
      .not('recall_bot_id', 'is', null)
      .in('recall_status', ['completed', 'done']);

    // Filter to only count meetings with meaningful transcripts
    const fairCount = (transcribedMeetings || []).filter(meeting => {
      const transcriptLength = meeting.transcript?.length || 0;
      const recallError = meeting.recall_error?.toLowerCase() || '';

      // Must have meaningful transcript (100+ chars)
      if (transcriptLength < 100) return false;

      // Exclude waiting room timeouts and no-participant failures
      if (recallError.includes('waiting_room')) return false;
      if (recallError.includes('no_participant')) return false;
      if (recallError.includes('empty_call')) return false;

      return true;
    }).length;

    const meetingsTranscribed = fairCount;
    const freeLimit = subscription?.free_meetings_limit || 5;

    console.log(`📊 Subscription check for user ${userId}: ${meetingsTranscribed}/${freeLimit} free meetings used, isPaid: ${isPaid}`);

    return meetingsTranscribed < freeLimit;
  } catch (error) {
    console.error('Error checking transcription access:', error);
    return false; // Fail closed - don't schedule bot if we can't verify access
  }
}

module.exports = { checkUserHasTranscriptionAccess };

