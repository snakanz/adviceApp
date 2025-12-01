/**
 * Utility functions to determine Recall bot status for meetings
 */

/**
 * Determine if Recall bot will join a meeting and provide reason
 * @param {Object} meeting - Meeting object from database
 * @param {Object} calendarConnection - Calendar connection object
 * @returns {Object} { willJoin: boolean, reason: string, status: 'success' | 'warning' | 'error' }
 */
export const getRecallBotStatus = (meeting, calendarConnection) => {
  // Check 1: Is transcription enabled for this calendar?
  if (!calendarConnection?.transcription_enabled) {
    return {
      willJoin: false,
      reason: 'Transcription disabled for your calendar',
      status: 'error',
      linkToSettings: true
    };
  }

  // Check 2: Is there an active calendar connection?
  if (!calendarConnection?.is_active) {
    return {
      willJoin: false,
      reason: 'Calendar connection inactive',
      status: 'error'
    };
  }

  // Check 3: Did the bot already join this meeting? (for past meetings)
  if (meeting?.recall_bot_id) {
    const endTime = meeting?.endtime ? new Date(meeting.endtime) : null;
    const isMeetingPast = endTime && endTime < new Date();

    if (isMeetingPast) {
      // Past meeting - bot already joined
      return {
        willJoin: true,
        reason: 'Bot successfully joined this call',
        status: 'success',
        isMeetingPast: true,
        showToggleButton: false
      };
    } else {
      // Future meeting - bot is scheduled to join (or disabled)
      if (meeting?.skip_transcription_for_meeting) {
        // Bot was scheduled but is now disabled for this meeting
        return {
          willJoin: false,
          reason: 'Bot disabled for this meeting',
          status: 'warning',
          isMeetingPast: false,
          showToggleButton: true
        };
      } else {
        // Bot is scheduled to join
        return {
          willJoin: true,
          reason: 'Bot scheduled to join this call',
          status: 'success',
          isMeetingPast: false,
          showToggleButton: true
        };
      }
    }
  }

  // Check 4: Is bot disabled for this specific meeting? (never scheduled)
  if (meeting?.skip_transcription_for_meeting) {
    return {
      willJoin: false,
      reason: 'Bot disabled for this meeting',
      status: 'warning',
      isMeetingPast: false,
      showToggleButton: true  // Allow user to re-enable the bot
    };
  }

  // Check 5: For future meetings without bot scheduled yet, check for valid URL
  const endTime = meeting?.endtime ? new Date(meeting.endtime) : null;
  const isMeetingPast = endTime && endTime < new Date();

  if (!isMeetingPast) {
    // Future meeting - check if it has a valid URL for bot to join
    const hasValidUrl = hasValidMeetingUrl(meeting);
    if (!hasValidUrl) {
      return {
        willJoin: false,
        reason: 'Add a video meeting link for the bot to join',
        status: 'error',
        isMeetingPast: false,
        showToggleButton: false
      };
    }

    // Future meeting with valid URL - bot will join
    return {
      willJoin: true,
      reason: 'Bot scheduled to join this call',
      status: 'success',
      isMeetingPast: false,
      showToggleButton: true
    };
  }

  // Past meeting without bot record - bot did not join
  return {
    willJoin: false,
    reason: 'Bot is not connected to join this meeting',
    status: 'warning',
    isMeetingPast: true,
    showToggleButton: false
  };
};

/**
 * Check if meeting has a valid meeting URL
 * @param {Object} meeting - Meeting object
 * @returns {boolean}
 */
export const hasValidMeetingUrl = (meeting) => {
  if (!meeting) return false;

  // Check for meeting_url field (primary method - stored in database)
  if (meeting.meeting_url) {
    return true;
  }

  // Fallback: Check for Google Meet in conferenceData (legacy support)
  if (meeting.conferenceData?.entryPoints) {
    const videoEntry = meeting.conferenceData.entryPoints.find(
      ep => ep.entryPointType === 'video'
    );
    if (videoEntry?.uri) return true;
  }

  // Fallback: Check for URL in location field
  if (meeting.location) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = meeting.location.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com') ||
        url.includes('gotomeeting.com')
      ) {
        return true;
      }
    }
  }

  // Fallback: Check for URL in description field
  if (meeting.description) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = meeting.description.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com') ||
        url.includes('gotomeeting.com')
      ) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Get the meeting URL from a meeting object
 * @param {Object} meeting - Meeting object
 * @returns {string|null} The meeting URL or null if not found
 */
export const getMeetingUrl = (meeting) => {
  if (!meeting) return null;

  // Check for meeting_url field (primary method - stored in database)
  if (meeting.meeting_url) {
    return meeting.meeting_url;
  }

  // Fallback: Check for Google Meet in conferenceData
  if (meeting.conferenceData?.entryPoints) {
    const videoEntry = meeting.conferenceData.entryPoints.find(
      ep => ep.entryPointType === 'video'
    );
    if (videoEntry?.uri) return videoEntry.uri;
  }

  // Fallback: Check for URL in location field
  if (meeting.location) {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    const urls = meeting.location.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com') ||
        url.includes('gotomeeting.com')
      ) {
        return url;
      }
    }
  }

  // Fallback: Check for URL in description field
  if (meeting.description) {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    const urls = meeting.description.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com') ||
        url.includes('gotomeeting.com')
      ) {
        return url;
      }
    }
  }

  return null;
};

/**
 * Get status badge color based on bot status
 * @param {string} status - Status type ('success', 'warning', 'error')
 * @returns {string} Tailwind color classes
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'success':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'warning':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'error':
      return 'bg-red-50 border-red-200 text-red-800';
    default:
      return 'bg-blue-50 border-blue-200 text-blue-800';
  }
};

/**
 * Get status icon based on bot status
 * @param {boolean} willJoin - Whether bot will join
 * @returns {string} Icon symbol
 */
export const getStatusIcon = (willJoin) => {
  return willJoin ? '✅' : '❌';
};

