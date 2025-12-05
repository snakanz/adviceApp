const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { checkUserHasTranscriptionAccess } = require('../utils/subscriptionCheck');

/**
 * Extract meeting URL from calendar event
 */
function extractMeetingUrl(event) {
  // Google Meet
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints
      .find(ep => ep.entryPointType === 'video');
    if (videoEntry) return videoEntry.uri;
  }

  // Zoom/Teams/Webex in location or description
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = (event.location || event.description || '').match(urlRegex) || [];
  
  for (const url of urls) {
    if (url.includes('zoom.us') || url.includes('teams.microsoft.com') ||
        url.includes('webex.com') || url.includes('meet.google.com')) {
      return url;
    }
  }

  return null;
}

/**
 * Create Recall bot for a meeting
 */
async function createRecallBot(meetingUrl, meetingId, userId) {
  try {
    const apiKey = process.env.RECALL_API_KEY;
    const baseUrl = 'https://us-west-2.recall.ai/api/v1';

    if (!apiKey) {
      console.error('❌ RECALL_API_KEY not configured');
      return null;
    }

    const response = await axios.post(`${baseUrl}/bot/`, {
      meeting_url: meetingUrl,
      recording_config: {
        transcript: {
          provider: {
            meeting_captions: {} // FREE transcription
          }
        }
      },
      metadata: {
        user_id: userId,
        meeting_id: meetingId,
        source: 'advicly'
      }
    }, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Recall bot created: ${response.data.id}`);
    return response.data;

  } catch (error) {
    console.error('Error creating Recall bot:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Schedule Recall bot for a meeting
 * Called when a meeting is detected and transcription is enabled
 */
router.post('/schedule-bot', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId, meetingUrl } = req.body;

    if (!meetingId || !meetingUrl) {
      return res.status(400).json({ error: 'Missing meetingId or meetingUrl' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const supabase = getSupabase();

    // Check if user has transcription access (paid or within free limit)
    const hasAccess = await checkUserHasTranscriptionAccess(userId);
    if (!hasAccess) {
      console.log(`🚫 User ${userId} has exceeded free meeting limit - rejecting bot scheduling request`);
      // Mark meeting as needing upgrade
      await supabase
        .from('meetings')
        .update({ recall_status: 'upgrade_required' })
        .eq('id', meetingId)
        .eq('user_id', userId);

      return res.status(403).json({
        error: 'Free meeting limit exceeded',
        code: 'UPGRADE_REQUIRED',
        message: 'You have used all 5 free transcribed meetings. Please upgrade to continue using meeting transcription.'
      });
    }

    // Create Recall bot
    const bot = await createRecallBot(meetingUrl, meetingId, userId);
    if (!bot) {
      return res.status(500).json({ error: 'Failed to create Recall bot' });
    }

    // Store bot ID in meeting
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        recall_bot_id: bot.id,
        recall_status: 'recording',
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating meeting with bot ID:', updateError);
      return res.status(500).json({ error: 'Failed to store bot ID' });
    }

    res.json({
      success: true,
      botId: bot.id,
      message: 'Recall bot scheduled successfully'
    });

  } catch (error) {
    console.error('Error scheduling Recall bot:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get bot status
 */
router.get('/bot/:botId', authenticateSupabaseUser, async (req, res) => {
  try {
    const { botId } = req.params;
    const apiKey = process.env.RECALL_API_KEY;
    const baseUrl = 'https://us-west-2.recall.ai/api/v1';

    if (!apiKey) {
      return res.status(500).json({ error: 'Recall API not configured' });
    }

    const response = await axios.get(`${baseUrl}/bot/${botId}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching bot status:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get transcript
 */
router.get('/transcript/:botId', authenticateSupabaseUser, async (req, res) => {
  try {
    const { botId } = req.params;
    const apiKey = process.env.RECALL_API_KEY;
    const baseUrl = 'https://us-west-2.recall.ai/api/v1';

    if (!apiKey) {
      return res.status(500).json({ error: 'Recall API not configured' });
    }

    const response = await axios.get(`${baseUrl}/transcript/${botId}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching transcript:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Recall calendar integration service is running'
  });
});

module.exports = router;

