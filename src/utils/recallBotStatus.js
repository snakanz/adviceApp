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
      status: 'error'
    };
  }

  // Check 2: Is bot disabled for this specific meeting?
  if (meeting?.skip_transcription_for_meeting) {
    return {
      willJoin: false,
      reason: 'Bot disabled for this meeting',
      status: 'warning'
    };
  }

  // Check 3: Does the meeting have a valid URL?
  const hasValidUrl = hasValidMeetingUrl(meeting);
  if (!hasValidUrl) {
    return {
      willJoin: false,
      reason: 'No calendar meeting detected',
      status: 'error'
    };
  }

  // Check 4: Is the meeting in the past?
  if (meeting?.endtime) {
    const endTime = new Date(meeting.endtime);
    if (endTime < new Date()) {
      return {
        willJoin: false,
        reason: 'Meeting has ended',
        status: 'warning'
      };
    }
  }

  // Check 5: Is there an active calendar connection?
  if (!calendarConnection?.is_active) {
    return {
      willJoin: false,
      reason: 'Calendar connection inactive',
      status: 'error'
    };
  }

  // All checks passed - bot will join
  return {
    willJoin: true,
    reason: 'Advicly Bot will join this meeting',
    status: 'success'
  };
};

/**
 * Check if meeting has a valid meeting URL
 * @param {Object} meeting - Meeting object
 * @returns {boolean}
 */
export const hasValidMeetingUrl = (meeting) => {
  if (!meeting) return false;

  // Check for Google Meet in conferenceData (primary method)
  if (meeting.conferenceData?.entryPoints) {
    const videoEntry = meeting.conferenceData.entryPoints.find(
      ep => ep.entryPointType === 'video'
    );
    if (videoEntry?.uri) return true;
  }

  // Check for URL in location field
  if (meeting.location) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = meeting.location.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com')
      ) {
        return true;
      }
    }
  }

  // Check for URL in description field
  if (meeting.description) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = meeting.description.match(urlRegex) || [];
    for (const url of urls) {
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('webex.com') ||
        url.includes('meet.google.com')
      ) {
        return true;
      }
    }
  }

  return false;
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

