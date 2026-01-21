import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

import { cn } from '../lib/utils';
import {
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Upload,
  Check,
  Mail,
  Edit,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Edit2,
  Plus,
  Save,
  Sparkles,
  Video,
  ExternalLink,
  Bot,
  AlertCircle,
  Copy,
  Eye,
  Send
} from 'lucide-react';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';
import CalendlyIcon from '../components/CalendlyIcon';
import DocumentsTab from '../components/DocumentsTab';
import { getRecallBotStatus, getStatusColor, getStatusIcon, getMeetingUrl, hasValidMeetingUrl, getMeetingPlatform, getPlatformDisplayName, VIDEO_PLATFORM_LOGOS } from '../utils/recallBotStatus';
import EditMeetingDialog from '../components/EditMeetingDialog';
import LinkClientDialog from '../components/LinkClientDialog';

import DataImport from '../components/DataImport';
import InlineChatWidget from '../components/InlineChatWidget';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

// Priority options for dropdown
const priorityOptions = [
  { value: 1, label: 'Urgent', icon: '🔴' },
  { value: 2, label: 'High', icon: '🟠' },
  { value: 3, label: 'Medium', icon: '🟡' },
  { value: 4, label: 'Low', icon: '🟢' }
];

const formatDate = (dateTimeStr) => {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

function getMeetingSource(meeting) {
  // Check the source field directly (simplified)
  if (meeting.source) {
    switch (meeting.source.toLowerCase()) {
      case 'google':
        return 'Google Calendar';
      case 'calendly':
        return 'Calendly';
      case 'outlook':
        return 'Outlook';
      case 'manual':
        return 'Manual Upload';
      default:
        return meeting.source;
    }
  }

  // For now, default to Calendly since we're focusing on that
  return 'Calendly';
}

function formatMeetingTime(meeting) {
  const start = new Date(meeting.start?.dateTime || meeting.startTime || meeting.starttime);
  return start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Extract attendee information from meeting data
function extractAttendees(meeting, currentUserEmail) {
  try {
    let attendees = meeting.attendees;
    if (typeof attendees === 'string') {
      attendees = JSON.parse(attendees);
    }

    if (!Array.isArray(attendees)) {
      return [];
    }

    // Filter out the current user and return attendee info
    return attendees
      .filter(attendee => attendee.email && attendee.email !== currentUserEmail)
      .map(attendee => ({
        email: attendee.email,
        name: attendee.displayName || attendee.name || attendee.email,
        initials: getInitials(attendee.displayName || attendee.name || attendee.email)
      }));
  } catch (e) {
    console.log('Could not parse attendees for meeting:', meeting.id);
    return [];
  }
}

// Get initials from a name or email
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';

  // If it's an email, extract the part before @
  if (nameOrEmail.includes('@')) {
    nameOrEmail = nameOrEmail.split('@')[0];
  }

  // Split by spaces and take first letter of each word
  const words = nameOrEmail.split(/[\s._-]+/).filter(word => word.length > 0);
  if (words.length === 0) return '?';

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// Helper function to get meeting card glow style - NO GLOW anymore
function getMeetingCardGlowStyle(meeting) {
  // Removed all glow effects per user request
  return '';
}

// Helper function to get bot status badge for past meetings
// Returns: { label, color, bgColor, icon } or null for future meetings
function getBotStatusBadge(meeting, calendarConnection) {
  const endTime = meeting?.endtime ? new Date(meeting.endtime) : null;
  const calendarEndTimePassed = endTime && endTime < new Date();

  // For Recall meetings, check if the call has actually completed
  // (has recall_bot_id AND either status is 'completed' or has transcript)
  const hasRecallCompleted = meeting?.recall_bot_id &&
    (meeting?.recall_status === 'completed' || !!meeting?.transcript);

  // Meeting is "past" if calendar end time passed OR Recall has completed
  const isMeetingPast = calendarEndTimePassed || hasRecallCompleted;

  // Only show badges for past/completed meetings
  if (!isMeetingPast) {
    return null;
  }

  // Check for manual transcript upload (has transcript but no recall_bot_id OR transcript_source is 'manual')
  if (meeting?.transcript && (!meeting?.recall_bot_id || meeting?.transcript_source === 'manual')) {
    return {
      label: 'Manual Upload',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      status: 'manual'
    };
  }

  // Check if transcription was enabled for this calendar connection
  const transcriptionEnabled = calendarConnection?.transcription_enabled !== false;

  // If bot wasn't connected/enabled for this meeting
  if (!meeting?.recall_bot_id && !transcriptionEnabled) {
    return {
      label: 'Bot Not Connected',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100 dark:bg-gray-800/30',
      status: 'not_connected'
    };
  }

  // If meeting has no recall_bot_id but transcription is enabled, bot wasn't scheduled
  if (!meeting?.recall_bot_id) {
    return {
      label: 'Bot Not Connected',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100 dark:bg-gray-800/30',
      status: 'not_connected'
    };
  }

  // Bot was scheduled - check recall_status and recall_error for outcome
  const recallStatus = meeting?.recall_status?.toLowerCase() || '';
  const recallError = meeting?.recall_error?.toLowerCase() || '';

  // Check for waiting room timeout or no participants first (before checking transcript)
  // This catches cases where bot was stuck in waiting room and never admitted
  const isWaitingRoomTimeout = recallError.includes('waiting_room') || recallStatus === 'waiting_room_timeout';
  const isNoParticipants = recallStatus.includes('no_participant') || recallStatus === 'empty_call' || recallError.includes('no_participant');

  if (isWaitingRoomTimeout || isNoParticipants) {
    return {
      label: 'No Participants',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
      status: 'no_participants'
    };
  }

  // Successful completion with transcript
  if (meeting?.transcript && (recallStatus === 'completed' || recallStatus === 'done')) {
    return {
      label: 'Complete',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      status: 'complete'
    };
  }

  // No recording captured
  if (recallStatus.includes('no_recording') || recallStatus === 'recording_failed' || recallStatus === 'no_audio') {
    return {
      label: 'No Recording',
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      status: 'no_recording'
    };
  }

  // Bot was scheduled but failed (has recall_bot_id but no transcript and not successful status)
  if (!meeting?.transcript) {
    // Check for specific failure statuses
    if (recallStatus === 'failed' || recallStatus === 'error' || recallStatus === 'timeout') {
      return {
        label: 'Bot Failed',
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        status: 'failed'
      };
    }
    // Generic no transcript case
    return {
      label: 'No Transcript',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100 dark:bg-gray-800/30',
      status: 'no_transcript'
    };
  }

  // Fallback - has transcript from Recall
  return {
    label: 'Complete',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    status: 'complete'
  };
}

// Helper function to determine if bot toggle should be shown
// Hide toggle if meeting is completed with transcript, or if meeting is in the past
function shouldShowBotToggle(meeting) {
  const endTime = meeting?.endtime ? new Date(meeting.endtime) : null;
  const isFutureMeeting = endTime && endTime > new Date();

  // Only show toggle for future meetings
  if (!isFutureMeeting) {
    return false;
  }

  // Don't show toggle if meeting already has a transcript (completed with Recall)
  if (meeting?.transcript) {
    return false;
  }

  // Must have a valid meeting URL
  return hasValidMeetingUrl(meeting);
}

// AttendeeAvatars component to display meeting attendees
function AttendeeAvatars({ meeting, currentUserEmail, maxVisible = 3 }) {
  const attendees = extractAttendees(meeting, currentUserEmail);

  if (attendees.length === 0) {
    return null;
  }

  const visibleAttendees = attendees.slice(0, maxVisible);
  const remainingCount = attendees.length - maxVisible;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {visibleAttendees.map((attendee, index) => (
          <Tooltip key={attendee.email}>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-medium text-primary cursor-help">
                {attendee.initials}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-medium">{attendee.name}</div>
                <div className="text-xs text-muted-foreground">{attendee.email}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-medium text-muted-foreground cursor-help">
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {attendees.slice(maxVisible).map((attendee) => (
                  <div key={attendee.email} className="text-center">
                    <div className="font-medium">{attendee.name}</div>
                    <div className="text-xs text-muted-foreground">{attendee.email}</div>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// Group meetings by month/year for better organization
function groupMeetingsByDate(meetings, sortOrder = 'desc') {
  const groups = {};

  meetings.forEach(meeting => {
    const startTime = meeting.start?.dateTime || meeting.startTime || meeting.starttime;
    if (!startTime) return;

    const date = new Date(startTime);
    const monthYear = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(meeting);
  });

  // Sort groups by date based on the sortOrder parameter
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const dateA = new Date(a + ' 1');
    const dateB = new Date(b + ' 1');
    if (sortOrder === 'asc') {
      return dateA - dateB; // Oldest first (for future meetings)
    } else {
      return dateB - dateA; // Most recent first (for past meetings)
    }
  });

  // Sort meetings within each group to maintain proper order
  sortedGroups.forEach(([monthYear, monthMeetings]) => {
    monthMeetings.sort((a, b) => {
      const dateA = new Date(a.start?.dateTime || a.startTime || a.starttime);
      const dateB = new Date(b.start?.dateTime || b.startTime || b.starttime);
      if (sortOrder === 'asc') {
        return dateA - dateB; // Soonest first for future meetings
      } else {
        return dateB - dateA; // Most recent first for past meetings
      }
    });
  });

  return sortedGroups;
}

// Fallback templates (only used if API fails)
const fallbackTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI prompt for generating professional plain-text email summaries from meeting transcripts',
    prompt_content: `Role: You are a professional financial advisor's assistant helping {advisorName} write a follow-up email to a client after a meeting.

Goal: Generate a clear, professional plain-text email that summarises the key discussion points and next steps. This email should be ready to copy-paste and send with minimal editing.

CRITICAL FORMAT RULES:
1. NO markdown symbols whatsoever - no asterisks (*), no hashes (#), no underscores (_), or formatting characters
2. Use plain text only with proper spacing and line breaks
3. Use numbered lists (1. 2. 3.) or simple dashes (-) for bullet points
4. Keep paragraphs short and separated by blank lines

Instructions:
1. Start with a friendly greeting using the client's name
2. Thank them for taking the time to meet
3. Summarise the main discussion points in a clear, organised manner
4. List any action items or next steps with clear ownership
5. End with an appropriate sign-off using the advisor's name

Use {transcript} as the source for the meeting content.
Use {clientName} for the client's name.
Use {advisorName} for the financial advisor's name.`
  }
];

export default function Meetings() {
  const [meetings, setMeetings] = useState({ future: [], past: [] });
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [summaryContent, setSummaryContent] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [meetingView, setMeetingView] = useState('past');
  const [calendarConnection, setCalendarConnection] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [togglingBot, setTogglingBot] = useState(false);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start from the beginning of the current week (Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });

  const selectedMeetingIdRef = useRef(null);
  selectedMeetingIdRef.current = selectedMeetingId;

  const [transcriptUpload, setTranscriptUpload] = useState('');
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);
  const [deletingTranscript, setDeletingTranscript] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingAISummaries, setGeneratingAISummaries] = useState(false);

  // Add template selection state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [currentSummaryTemplate, setCurrentSummaryTemplate] = useState(null);

  // Add new state for auto-generated summaries
  const [quickSummary, setQuickSummary] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [emailSummary, setEmailSummary] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Template selection modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Streaming text state for typewriter effect
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingComplete, setStreamingComplete] = useState(false); // Track when streaming just finished
  const [emailViewMode, setEmailViewMode] = useState('preview'); // 'preview' or 'plain'
  const [copiedEmail, setCopiedEmail] = useState(false); // For copy feedback

  // Add import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Add action items state
  const [actionItems, setActionItems] = useState([]);
  const [loadingActionItems, setLoadingActionItems] = useState(false);

  // Add pending action items state (for approval workflow)
  const [pendingActionItems, setPendingActionItems] = useState([]);
  const [loadingPendingItems, setLoadingPendingItems] = useState(false);
  const [selectedPendingItems, setSelectedPendingItems] = useState([]);
  const [pendingItemPriorities, setPendingItemPriorities] = useState({}); // { itemId: priority }

  // Pending item editing state
  const [editingPendingItemId, setEditingPendingItemId] = useState(null);
  const [editingPendingText, setEditingPendingText] = useState('');
  const [savingPendingEdit, setSavingPendingEdit] = useState(false);

  // Adding new pending item state
  const [addingPendingItem, setAddingPendingItem] = useState(false);
  const [newPendingItemText, setNewPendingItemText] = useState('');
  const [newPendingItemPriority, setNewPendingItemPriority] = useState(3);
  const [savingNewPendingItem, setSavingNewPendingItem] = useState(false);

  // Link client dialog state
  const [showLinkClientDialog, setShowLinkClientDialog] = useState(false);
  const [linkClientMeeting, setLinkClientMeeting] = useState(null);

  console.log('Meetings component render:', { activeTab, selectedMeetingId });

  const selectedMeeting = React.useMemo(() => {
    return (
      meetings.past.find(m => m.id === selectedMeetingId) ||
      meetings.future.find(m => m.id === selectedMeetingId) ||
      null
    );
  }, [meetings, selectedMeetingId]);

  // Calendar view helper functions
  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    setCurrentWeekStart(weekStart);
  };

  const getMeetingsForDay = (day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const allMeetings = [...meetings.past, ...meetings.future];
    const meetingsOnDay = [];

    allMeetings.forEach(meeting => {
      const startTime = meeting.start?.dateTime || meeting.startTime || meeting.starttime;
      if (!startTime) return;

      const meetingDate = new Date(startTime);
      if (meetingDate >= dayStart && meetingDate <= dayEnd) {
        meetingsOnDay.push(meeting);
      }
    });

    // Sort by time
    return meetingsOnDay.sort((a, b) => {
      const aTime = new Date(a.start?.dateTime || a.startTime || a.starttime);
      const bTime = new Date(b.start?.dateTime || b.startTime || b.starttime);
      return aTime - bTime;
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Load templates on component mount - fetch from API
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const fetchedTemplates = await api.get('/templates');
        if (fetchedTemplates && fetchedTemplates.length > 0) {
          setTemplates(fetchedTemplates);
          // Default to Advicly Summary template (auto-template)
          const adviclyTemplate = fetchedTemplates.find(t => t.id === 'auto-template' || t.title === 'Advicly Summary') || fetchedTemplates[0];
          setSelectedTemplate(adviclyTemplate);
        } else {
          // Use fallback templates if API returns empty
          setTemplates(fallbackTemplates);
          setSelectedTemplate(fallbackTemplates[0]);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
        // Use fallback templates on error
        setTemplates(fallbackTemplates);
        setSelectedTemplate(fallbackTemplates[0]);
      }
    };
    fetchTemplates();
  }, []);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      console.log('🔑 Using access token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

      if (!token) {
        console.error('❌ No access token found in session');
        setShowSnackbar(true);
        setSnackbarMessage('Authentication required. Please log in again.');
        setSnackbarSeverity('error');
        return;
      }

      // 🔥 RESTORED: Use full database endpoint with real meeting data
      const url = `${API_URL}/api/dev/meetings`;
      console.log('🌐 Fetching from URL:', url);

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        console.error('❌ API Error:', res.status, res.statusText);
        const errorText = await res.text();
        console.error('❌ Error details:', errorText);

        if (res.status === 401) {
          setShowSnackbar(true);
          setSnackbarMessage('Authentication expired. Please log in again.');
          setSnackbarSeverity('error');
          // Clear invalid token
          localStorage.removeItem('jwt');
          return;
        }

        setShowSnackbar(true);
        setSnackbarMessage(`Failed to load meetings: ${res.status} ${res.statusText}`);
        setSnackbarSeverity('error');
        return;
      }

      const data = await res.json();
      console.log('✅ Raw meetings data from API:', data);
      console.log(`📊 API returned ${data.length} meetings`);

      if (!Array.isArray(data)) {
        console.error('❌ API returned non-array data:', data);
        setShowSnackbar(true);
        setSnackbarMessage('Invalid data format received from server');
        setSnackbarSeverity('error');
        return;
      }

      // 🔥 SIMPLIFIED: Handle Calendly meetings with database ID
      const now = new Date();
      const meetingsData = { past: [], future: [] };

      // Debug: Check September 2025 meetings in API response
      const sept2025InAPI = data.filter(m => {
        const startTime = m.starttime || m.startTime;
        if (!startTime) return false;
        const date = new Date(startTime);
        return date.getFullYear() === 2025 && date.getMonth() === 8;
      });
      console.log(`🎯 September 2025 meetings in API response: ${sept2025InAPI.length}`);

      data.forEach(m => {
        // Handle simplified Calendly data structure
        const startTime = m.starttime || m.startTime;
        const meetingId = m.id; // Use the database ID directly

        if (startTime && meetingId) {
          const start = new Date(startTime);
          const meetingData = {
            ...m,
            // Normalise joined client relation so UI can always use .client
            client: m.client || m.clients || null,
            id: meetingId, // Use database ID
            startTime: startTime, // Ensure consistent naming
          };

          if (start < now) {
            meetingsData.past.push(meetingData);
          } else {
            meetingsData.future.push(meetingData);
          }
        }
      });

      // Debug: Check September 2025 meetings in processed data
      const sept2025InPast = meetingsData.past.filter(m => {
        const date = new Date(m.startTime);
        return date.getFullYear() === 2025 && date.getMonth() === 8;
      });
      const sept2025InFuture = meetingsData.future.filter(m => {
        const date = new Date(m.startTime);
        return date.getFullYear() === 2025 && date.getMonth() === 8;
      });
      console.log(`🎯 September 2025 meetings in past array: ${sept2025InPast.length}`);
      console.log(`🎯 September 2025 meetings in future array: ${sept2025InFuture.length}`);

      // Sort meetings properly:
      // - Future meetings: soonest first (ascending order)
      // - Past meetings: most recent first (descending order)
      meetingsData.future.sort((a, b) => {
        const dateA = new Date(a.starttime || a.startTime);
        const dateB = new Date(b.starttime || b.startTime);
        return dateA - dateB; // Ascending: soonest first
      });

      meetingsData.past.sort((a, b) => {
        const dateA = new Date(a.starttime || a.startTime);
        const dateB = new Date(b.starttime || b.startTime);
        return dateB - dateA; // Descending: most recent first
      });

      setMeetings(meetingsData);
      // Don't auto-select first meeting - let users see the default state
      // if (selectedMeetingIdRef.current === null) {
      //   if (meetingsData.past.length > 0) {
      //     setSelectedMeetingId(meetingsData.past[0].id);
      //     setSummaryContent(meetingsData.past[0].meetingSummary);
      //   } else if (meetingsData.future.length > 0) {
      //     setSelectedMeetingId(meetingsData.future[0].id);
      //     setSummaryContent(meetingsData.future[0].meetingSummary);
      //   }
      // }
    } catch (error) {
      console.error('❌ Error fetching meetings:', error);
      setShowSnackbar(true);
      setSnackbarMessage(`Failed to load meetings: ${error.message}`);
      setSnackbarSeverity('error');

      // Set empty meetings data to prevent undefined errors
      setMeetings({ past: [], future: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMeetings();
    }
  }, [isAuthenticated, fetchMeetings]);

  // Update local state when selectedMeeting changes (e.g., after data refresh)
  useEffect(() => {
    if (selectedMeeting) {
      setQuickSummary(selectedMeeting.quick_summary || '');
      setEmailSummary(selectedMeeting.email_summary_draft || '');
      setSummaryContent(selectedMeeting.email_summary_draft || selectedMeeting.meetingSummary || '');
    }
  }, [selectedMeeting]);

  // Refresh when page becomes visible (user switches back to tab)
  // Removed 30-second polling - relying on webhooks for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page visible - refreshing meetings...');
        fetchMeetings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, fetchMeetings]);

  // Auto-refresh when selected meeting is awaiting summary generation
  // Only triggers a single refresh after 5 seconds, not continuous polling
  const lastRefreshRef = useRef(null);
  useEffect(() => {
    if (!isAuthenticated || !selectedMeeting) return;

    // Only refresh if selected meeting has transcript but no summary
    // AND recall_status is 'completed' (meaning bot just finished)
    const needsSummary = selectedMeeting.transcript &&
      selectedMeeting.transcript.trim() &&
      selectedMeeting.recall_status === 'completed' &&
      (!selectedMeeting.quick_summary || !selectedMeeting.quick_summary.trim());

    if (!needsSummary) return;

    // Prevent duplicate refreshes for the same meeting
    if (lastRefreshRef.current === selectedMeeting.id) return;

    console.log(`🔄 Meeting ${selectedMeeting.id} has transcript but no summary - will refresh once in 5s`);
    lastRefreshRef.current = selectedMeeting.id;

    const timeoutId = setTimeout(() => {
      console.log('🔄 Refreshing to check for generated summary...');
      fetchMeetings();
      // Reset after refresh so it can trigger again if still missing
      setTimeout(() => {
        lastRefreshRef.current = null;
      }, 10000); // Wait 10s before allowing another refresh for same meeting
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedMeeting?.id, selectedMeeting?.quick_summary, selectedMeeting?.recall_status, fetchMeetings]);

  // Handle URL parameter to auto-select a meeting
  useEffect(() => {
    const selectedParam = searchParams.get('selected');
    if (selectedParam && (meetings.past.length > 0 || meetings.future.length > 0)) {
      // Try to find the meeting by ID (database ID)
      let meeting = meetings.past.find(m => m.id === parseInt(selectedParam));

      // If not found by ID, try by googleeventid
      if (!meeting) {
        meeting = meetings.past.find(m => m.googleeventid === selectedParam);
      }

      // If not found in past, check future meetings
      if (!meeting && meetings.future.length > 0) {
        meeting = meetings.future.find(m => m.id === parseInt(selectedParam));
        if (!meeting) {
          meeting = meetings.future.find(m => m.googleeventid === selectedParam);
        }
      }

      if (meeting) {
        // Just set the selected meeting ID - the handleMeetingSelect will be called when user interaction happens
        setSelectedMeetingId(meeting.id);
        setActiveTab('summary');

        // Set existing summaries if available
        setQuickSummary(meeting.quick_summary || '');
        setEmailSummary(meeting.email_summary_draft || '');
        setSummaryContent(meeting.email_summary_draft || meeting.meetingSummary || '');

        // Clear the URL parameter after selecting
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('selected');
        navigate({ search: newSearchParams.toString() }, { replace: true });
      }
    }
  }, [meetings, searchParams, navigate, setSelectedMeetingId, setActiveTab, setQuickSummary, setEmailSummary, setSummaryContent]);

  // Fetch calendar connection for bot status with real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const fetchCalendarConnection = async () => {
      try {
        const { data } = await supabase
          .from('calendar_connections')
          .select('id, provider, provider_account_email, transcription_enabled, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (data) {
          setCalendarConnection(data);
        }
      } catch (err) {
        console.error('Error fetching calendar connection:', err);
      }
    };

    // Initial fetch
    fetchCalendarConnection();

    // Subscribe to real-time updates on calendar_connections table
    const subscription = supabase
      .channel(`calendar_connections:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_connections',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Update on ANY change to the connection (transcription_enabled, is_active, etc.)
          if (payload.new) {
            setCalendarConnection(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Subscribe to real-time updates on meetings table for bot status changes
  useEffect(() => {
    if (!user?.id) return;

    const meetingsSubscription = supabase
      .channel(`meetings:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // When a meeting is updated (e.g., bot joins, transcript generated)
          if (payload.new) {
            console.log('🔄 Meeting updated via real-time:', payload.new.id, payload.new.recall_bot_id);
            // Refresh meetings to get updated data
            fetchMeetings();
          }
        }
      )
      .subscribe();

    return () => {
      meetingsSubscription.unsubscribe();
    };
  }, [user?.id, fetchMeetings]);

  // Update bot status when meeting is selected
  useEffect(() => {
    if (selectedMeetingId && calendarConnection) {
      const selectedMeeting = [...meetings.past, ...meetings.future].find(m => m.id === selectedMeetingId);
      if (selectedMeeting) {
        const status = getRecallBotStatus(selectedMeeting, calendarConnection);
        setBotStatus(status);
      }
    }
  }, [selectedMeetingId, calendarConnection, meetings]);

  const handleMeetingSelect = async (meeting) => {
    console.log('Meeting selected:', meeting); // Debug log
    setSelectedMeetingId(meeting.id);
    setActiveTab('summary');

    // Reset streaming state when selecting a new meeting
    setStreamingComplete(false);
    setStreamingContent('');
    setIsStreaming(false);

    // Set existing summaries if available (using current database schema)
    setQuickSummary(meeting.quick_summary || '');
    setEmailSummary(meeting.email_summary_draft || '');
    setSummaryContent(meeting.email_summary_draft || meeting.meetingSummary || '');

    // Set template info
    if (meeting.templateId) {
      const template = templates.find(t => t.id === meeting.templateId);
      setCurrentSummaryTemplate(template);
      setSelectedTemplate(template);
    } else {
      // Default to Advicly Summary template when no template is set
      const adviclyTemplate = templates.find(t => t.id === 'auto-template') || templates[0];
      setCurrentSummaryTemplate(null);
      setSelectedTemplate(adviclyTemplate);
    }

    // Auto-generate summaries if transcript exists but summaries don't
    // Only generate if we don't have BOTH quick summary AND email summary
    const hasQuickSummary = meeting.quickSummary && meeting.quickSummary.trim();
    const hasEmailSummary = meeting.emailSummary && meeting.emailSummary.trim();

    console.log('Summary check:', {
      hasTranscript: !!meeting.transcript,
      hasQuickSummary,
      hasEmailSummary,
      quickSummary: meeting.quickSummary,
      emailSummary: meeting.emailSummary
    }); // Debug log

    if (meeting.transcript && (!hasQuickSummary || !hasEmailSummary)) {
      console.log('Auto-generating summaries...'); // Debug log
      // Use googleeventid for API calls (backend expects this field)
      await autoGenerateSummaries(meeting.googleeventid || meeting.id);
    }
  };

  const handleEditMeeting = (meeting, event) => {
    event.stopPropagation(); // Prevent meeting selection
    setEditingMeeting(meeting);
    setShowEditDialog(true);
  };

  const handleMeetingUpdated = (updatedMeeting) => {
    // Refresh meetings list
    fetchMeetings();

    // Update selected meeting if it's the one being edited
    if (selectedMeetingId === updatedMeeting.id) {
      setSelectedMeetingId(updatedMeeting.id);
    }

    setShowSnackbar(true);
    setSnackbarMessage('Meeting updated successfully');
    setSnackbarSeverity('success');
    setTimeout(() => setShowSnackbar(false), 3000);
  };

  const autoGenerateSummaries = async (meetingId, forceRegenerate = false) => {
    setAutoGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/auto-generate-summaries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ forceRegenerate })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to auto-generate summaries');
      }

      const data = await response.json();

      // Update state with generated summaries
      setQuickSummary(data.quickSummary);
      setEmailSummary(data.emailSummary);
      setSummaryContent(data.emailSummary);

      // Update the meetings state to reflect the new data
      setMeetings(prevMeetings => {
        const updateMeeting = (meeting) => {
          if (meeting.id === meetingId) {
            return {
              ...meeting,
              quick_summary: data.quickSummary,
              email_summary_draft: data.emailSummary,
              action_points: data.actionPoints,
              last_summarized_at: data.lastSummarizedAt
            };
          }
          return meeting;
        };

        return {
          past: prevMeetings.past.map(updateMeeting),
          future: prevMeetings.future.map(updateMeeting)
        };
      });

      // Update template info
      const template = templates.find(t => t.id === data.templateId);
      setCurrentSummaryTemplate(template);
      setSelectedTemplate(template);

      // Refresh action items to show newly generated action points
      // This ensures the action points section updates immediately
      if (selectedMeetingId) {
        await fetchActionItems(selectedMeetingId);
        await fetchPendingActionItems(selectedMeetingId);
      }

      if (data.generated) {
        setShowSnackbar(true);
        setSnackbarMessage('Summaries generated successfully');
        setSnackbarSeverity('success');
      }
    } catch (error) {
      console.error('Error auto-generating summaries:', error);
      setShowSnackbar(true);
      setSnackbarMessage(error.message || 'Failed to generate summaries');
      setSnackbarSeverity('error');
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleAIAdjustment = async (adjustmentPrompt) => {
    if (!selectedMeeting) return;

    try {
      const result = await adjustMeetingSummary(selectedMeeting.id, adjustmentPrompt);
      setSummaryContent(result.summary);
      setShowSnackbar(true);
      setSnackbarMessage('Summary adjusted successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error adjusting summary:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to adjust summary');
      setSnackbarSeverity('error');
    }
  };

  const handleTranscriptUpload = async () => {
    if (!transcriptUpload?.trim() || !selectedMeeting) return;

    setUploadingTranscript(true);
    setGeneratingAISummaries(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Show generating summaries state after a brief delay
      setTimeout(() => {
        if (uploadingTranscript) {
          setGeneratingAISummaries(true);
        }
      }, 1000);

      // Use numeric meeting ID for the API call
      const meetingIdentifier = selectedMeeting.id;
      console.log('📤 Uploading transcript for meeting:', meetingIdentifier);

      const res = await fetch(`${API_URL}/api/calendar/meetings/${meetingIdentifier}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript: transcriptUpload.trim() })
      });

      if (!res.ok) throw new Error('Failed to upload transcript');

      const responseData = await res.json();
      console.log('📥 Transcript upload response:', responseData);

      // Update local state with transcript and any auto-generated summaries
      const meetingUpdate = {
        transcript: transcriptUpload.trim()
      };

      // If summaries were auto-generated, include them
      if (responseData.summaries) {
        meetingUpdate.quick_summary = responseData.summaries.quickSummary;
        meetingUpdate.email_summary_draft = responseData.summaries.emailSummary;

        // Include action points if they were generated
        if (responseData.summaries.actionPoints) {
          meetingUpdate.action_points = responseData.summaries.actionPoints;
          console.log('✅ Action points extracted:', responseData.summaries.actionPoints);
        }

        // Also update the local state variables immediately
        // Use detailedSummary from response for Meetings page display (not saved to DB yet)
        setQuickSummary(responseData.summaries.detailedSummary || responseData.summaries.quickSummary || '');
        setEmailSummary(responseData.summaries.emailSummary || '');
        setSummaryContent(responseData.summaries.emailSummary || '');
      }

      const updatedMeetings = {
        ...meetings,
        past: meetings.past.map(m =>
          m.id === selectedMeeting.id
            ? { ...m, ...meetingUpdate }
            : m
        ),
        future: meetings.future.map(m =>
          m.id === selectedMeeting.id
            ? { ...m, ...meetingUpdate }
            : m
        )
      };
      setMeetings(updatedMeetings);

      // The selectedMeeting will be automatically updated via useMemo when meetings state changes

      setTranscriptUpload('');
      setShowTranscriptUpload(false);

      // Force a refresh from the database to ensure transcript is persisted
      // This prevents the transcript from disappearing on auto-refresh
      await fetchMeetings();

      // Refresh action items to show newly generated action points
      // This ensures the action points section updates without requiring panel close/reopen
      if (selectedMeetingId) {
        await fetchActionItems(selectedMeetingId);
        await fetchPendingActionItems(selectedMeetingId);
      }

      setShowSnackbar(true);

      // Show different message based on whether summaries were generated
      if (responseData.autoGenerated && responseData.summaries) {
        setSnackbarMessage('Transcript uploaded and AI summaries generated successfully!');
      } else {
        setSnackbarMessage('Transcript uploaded successfully');
      }
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error uploading transcript:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to upload transcript');
      setSnackbarSeverity('error');
    } finally {
      setUploadingTranscript(false);
      setGeneratingAISummaries(false);
    }
  };



  const handleDeleteTranscript = async () => {
    if (!selectedMeeting) return;

    setDeletingTranscript(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/calendar/meetings/${selectedMeeting.id}/transcript`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete transcript');

      // Update local state - clear transcript and all related summaries
      const updatedMeetings = {
        ...meetings,
        past: meetings.past.map(m =>
          m.id === selectedMeeting.id
            ? {
                ...m,
                transcript: null,
                quick_summary: null,
                email_summary_draft: null
              }
            : m
        ),
        future: meetings.future.map(m =>
          m.id === selectedMeeting.id
            ? {
                ...m,
                transcript: null,
                quick_summary: null,
                email_summary_draft: null
              }
            : m
        )
      };
      setMeetings(updatedMeetings);

      // Clear local summary state as well
      setQuickSummary('');
      setEmailSummary('');
      setSummaryContent('');

      setShowSnackbar(true);
      setSnackbarMessage('Transcript and summaries deleted successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error deleting transcript:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to delete transcript');
      setSnackbarSeverity('error');
    } finally {
      setDeletingTranscript(false);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!selectedMeeting?.transcript) return;

    setGeneratingSummary(true);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingComplete(false); // Reset completion state for new generation
    setSummaryContent(''); // Clear existing content to show streaming

    try {
      // Get the template prompt
      let templatePrompt;
      let templateToUse;

      if (selectedTemplate) {
        templatePrompt = selectedTemplate.prompt_content || selectedTemplate.content;
        templateToUse = selectedTemplate;
        if (!templatePrompt) {
          throw new Error('Template has no prompt content');
        }
      } else {
        templateToUse = templates.find(t => t.id === 'auto-template') || templates[0];
        templatePrompt = templateToUse.prompt_content || templateToUse.content;
        if (!templatePrompt) {
          throw new Error('Auto template has no prompt content');
        }
      }

      setCurrentSummaryTemplate(templateToUse);
      const prompt = templatePrompt.replace('{transcript}', selectedMeeting.transcript);

      // Use streaming endpoint for typewriter effect
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/calendar/generate-summary-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript: selectedMeeting.transcript,
          prompt,
          meetingId: selectedMeeting.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI summary');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                setSummaryContent(fullContent);
              }
              if (data.done) {
                setIsStreaming(false);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      setEmailSummary(fullContent);
      setIsStreaming(false);
      setStreamingComplete(true); // Mark streaming as just completed to prevent flash

      // Save the generated summary to database
      try {
        const templateId = templateToUse?.id || 'auto-template';
        await fetch(`${API_URL}/api/calendar/meetings/${selectedMeeting.id}/update-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            emailSummary: fullContent,
            templateId: templateId
          })
        });

        // Update the meetings state to persist the email summary
        setMeetings(prevMeetings => ({
          ...prevMeetings,
          past: prevMeetings.past.map(meeting =>
            meeting.id === selectedMeeting.id
              ? {
                  ...meeting,
                  email_summary_draft: fullContent,
                  templateId: templateId
                }
              : meeting
          ),
          future: prevMeetings.future.map(meeting =>
            meeting.id === selectedMeeting.id
              ? {
                  ...meeting,
                  email_summary_draft: fullContent,
                  templateId: templateId
                }
              : meeting
          )
        }));

      } catch (saveError) {
        console.error('Error saving template summary:', saveError);
        setShowSnackbar(true);
        setSnackbarMessage(`Email generated but failed to auto-save. Please try again.`);
        setSnackbarSeverity('warning');
        return;
      }

      setShowSnackbar(true);
      setSnackbarMessage(`✓ Email generated and auto-saved using ${templateToUse?.title || 'Advicly Summary'}`);
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setShowSnackbar(true);
      setSnackbarMessage(error.message || 'Failed to generate AI summary');
      setSnackbarSeverity('error');
      setIsStreaming(false);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // NOTE: Calendar sync is now handled automatically via webhooks
  // Manual sync buttons have been removed from the UI



  // Fetch action items for a meeting
  const fetchActionItems = async (meetingId) => {
    if (!meetingId) return;

    setLoadingActionItems(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/meetings/${meetingId}/action-items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch action items');
      }

      const data = await response.json();
      setActionItems(data.actionItems || []);
    } catch (error) {
      console.error('Error fetching action items:', error);
      setActionItems([]);
    } finally {
      setLoadingActionItems(false);
    }
  };

  // Fetch pending action items for a meeting (awaiting approval)
  const fetchPendingActionItems = async (meetingId) => {
    if (!meetingId) return;

    setLoadingPendingItems(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/meetings/${meetingId}/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending action items');
      }

      const data = await response.json();
      setPendingActionItems(data.pendingItems || []);
      // Select all by default and initialize priorities
      const items = data.pendingItems || [];
      setSelectedPendingItems(items.map(item => item.id));
      const priorities = {};
      items.forEach(item => {
        priorities[item.id] = item.priority || 3; // Default to Medium if not set
      });
      setPendingItemPriorities(priorities);
    } catch (error) {
      console.error('Error fetching pending action items:', error);
      setPendingActionItems([]);
      setSelectedPendingItems([]);
    } finally {
      setLoadingPendingItems(false);
    }
  };

  // Update priority of a pending action item
  const updatePendingItemPriority = async (itemId, priority) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending/${itemId}/priority`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority })
      });

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      // Update local state
      setPendingItemPriorities(prev => ({
        ...prev,
        [itemId]: priority
      }));
    } catch (error) {
      console.error('Error updating pending item priority:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to update priority');
      setSnackbarSeverity('error');
    }
  };

  // Edit pending item text
  const startEditingPendingItem = (item) => {
    setEditingPendingItemId(item.id);
    setEditingPendingText(item.action_text);
  };

  const cancelEditingPendingItem = () => {
    setEditingPendingItemId(null);
    setEditingPendingText('');
  };

  const savePendingItemEdit = async (itemId) => {
    if (!editingPendingText.trim()) {
      setShowSnackbar(true);
      setSnackbarMessage('Action text cannot be empty');
      setSnackbarSeverity('error');
      return;
    }

    try {
      setSavingPendingEdit(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending/${itemId}/text`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionText: editingPendingText.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to update pending item');
      }

      setShowSnackbar(true);
      setSnackbarMessage('Action item updated successfully!');
      setSnackbarSeverity('success');

      // Refresh pending items
      if (selectedMeetingId) {
        await fetchPendingActionItems(selectedMeetingId);
      }
      setEditingPendingItemId(null);
      setEditingPendingText('');
    } catch (error) {
      console.error('Error updating pending item:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to update action item');
      setSnackbarSeverity('error');
    } finally {
      setSavingPendingEdit(false);
    }
  };

  // Add new pending item
  const startAddingPendingItem = () => {
    setAddingPendingItem(true);
    setNewPendingItemText('');
    setNewPendingItemPriority(3);
  };

  const cancelAddingPendingItem = () => {
    setAddingPendingItem(false);
    setNewPendingItemText('');
    setNewPendingItemPriority(3);
  };

  // Toggle Recall bot for this specific meeting
  const handleToggleBotForMeeting = async () => {
    if (!selectedMeetingId || !selectedMeeting) return;

    try {
      setTogglingBot(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const newSkipValue = !selectedMeeting.skip_transcription_for_meeting;

      const response = await fetch(`${API_URL}/api/calendar/meetings/${selectedMeetingId}/toggle-bot`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ skip_transcription_for_meeting: newSkipValue })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bot');
      }

      // Update local state
      const updatedMeeting = { ...selectedMeeting, skip_transcription_for_meeting: newSkipValue };
      setMeetings(prev => ({
        ...prev,
        past: prev.past.map(m => m.id === selectedMeetingId ? updatedMeeting : m),
        future: prev.future.map(m => m.id === selectedMeetingId ? updatedMeeting : m)
      }));

      // Update bot status
      const newStatus = getRecallBotStatus(updatedMeeting, calendarConnection);
      setBotStatus(newStatus);

      setShowSnackbar(true);
      setSnackbarMessage(newSkipValue ? 'Advicly Assistant disabled for this meeting' : 'Advicly Assistant enabled for this meeting');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error toggling bot:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to toggle Advicly Assistant');
      setSnackbarSeverity('error');
    } finally {
      setTogglingBot(false);
    }
  };

  // Toggle bot for any meeting (used in meeting cards)
  const handleToggleBotForAnyMeeting = async (meeting, e) => {
    if (e) {
      e.stopPropagation(); // Prevent card click
    }
    if (!meeting?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const newSkipValue = !meeting.skip_transcription_for_meeting;

      const response = await fetch(`${API_URL}/api/calendar/meetings/${meeting.id}/toggle-bot`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ skip_transcription_for_meeting: newSkipValue })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bot');
      }

      // Update local state
      const updatedMeeting = { ...meeting, skip_transcription_for_meeting: newSkipValue };
      setMeetings(prev => ({
        ...prev,
        past: prev.past.map(m => m.id === meeting.id ? updatedMeeting : m),
        future: prev.future.map(m => m.id === meeting.id ? updatedMeeting : m)
      }));

      // Update bot status if this is the selected meeting
      if (selectedMeetingId === meeting.id) {
        const newStatus = getRecallBotStatus(updatedMeeting, calendarConnection);
        setBotStatus(newStatus);
      }

      setShowSnackbar(true);
      setSnackbarMessage(newSkipValue ? 'Advicly Assistant disabled for this meeting' : 'Advicly Assistant enabled for this meeting');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error toggling bot:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to toggle Advicly Assistant');
      setSnackbarSeverity('error');
    }
  };

  const saveNewPendingItem = async () => {
    if (!newPendingItemText.trim()) {
      setShowSnackbar(true);
      setSnackbarMessage('Action text cannot be empty');
      setSnackbarSeverity('error');
      return;
    }

    if (!selectedMeetingId || !selectedMeeting) {
      setShowSnackbar(true);
      setSnackbarMessage('No meeting selected');
      setSnackbarSeverity('error');
      return;
    }

    try {
      setSavingNewPendingItem(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingId: selectedMeetingId,
          clientId: selectedMeeting.client_id,
          actionText: newPendingItemText.trim(),
          priority: newPendingItemPriority
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create pending item');
      }

      setShowSnackbar(true);
      setSnackbarMessage('Action item added successfully!');
      setSnackbarSeverity('success');

      // Refresh pending items
      await fetchPendingActionItems(selectedMeetingId);
      setAddingPendingItem(false);
      setNewPendingItemText('');
      setNewPendingItemPriority(3);
    } catch (error) {
      console.error('Error creating pending item:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to add action item');
      setSnackbarSeverity('error');
    } finally {
      setSavingNewPendingItem(false);
    }
  };

  // Approve selected pending action items
  const approvePendingActionItems = async () => {
    if (selectedPendingItems.length === 0) {
      setShowSnackbar(true);
      setSnackbarMessage('Please select at least one action item to approve');
      setSnackbarSeverity('warning');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_URL}/api/transcript-action-items/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pendingItemIds: selectedPendingItems })
      });

      if (!response.ok) {
        throw new Error('Failed to approve action items');
      }

      const data = await response.json();

      setShowSnackbar(true);
      setSnackbarMessage(`Successfully approved ${data.approvedCount} action item${data.approvedCount > 1 ? 's' : ''}`);
      setSnackbarSeverity('success');

      // Refresh both pending and approved action items
      if (selectedMeetingId) {
        await fetchPendingActionItems(selectedMeetingId);
        await fetchActionItems(selectedMeetingId);
      }
    } catch (error) {
      console.error('Error approving action items:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to approve action items');
      setSnackbarSeverity('error');
    }
  };

  // Reject/delete pending action items
  const rejectPendingActionItems = async () => {
    if (selectedPendingItems.length === 0) {
      setShowSnackbar(true);
      setSnackbarMessage('Please select at least one action item to reject');
      setSnackbarSeverity('warning');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_URL}/api/transcript-action-items/pending`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pendingItemIds: selectedPendingItems })
      });

      if (!response.ok) {
        throw new Error('Failed to reject action items');
      }

      const data = await response.json();

      setShowSnackbar(true);
      setSnackbarMessage(`Rejected ${data.rejectedCount} action item${data.rejectedCount > 1 ? 's' : ''}`);
      setSnackbarSeverity('success');

      // Refresh pending action items
      if (selectedMeetingId) {
        await fetchPendingActionItems(selectedMeetingId);
      }
    } catch (error) {
      console.error('Error rejecting action items:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to reject action items');
      setSnackbarSeverity('error');
    }
  };

  // Toggle selection of a pending action item
  const togglePendingItemSelection = (itemId) => {
    setSelectedPendingItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Select/deselect all pending items
  const toggleSelectAllPending = () => {
    if (selectedPendingItems.length === pendingActionItems.length) {
      setSelectedPendingItems([]);
    } else {
      setSelectedPendingItems(pendingActionItems.map(item => item.id));
    }
  };

  // Toggle action item completion
  const toggleActionItem = async (actionItemId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/transcript-action-items/action-items/${actionItemId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle action item');
      }

      const data = await response.json();

      // Update local state
      setActionItems(prevItems =>
        prevItems.map(item =>
          item.id === actionItemId ? data.actionItem : item
        )
      );

      setShowSnackbar(true);
      setSnackbarMessage(data.actionItem.completed ? 'Action item completed' : 'Action item reopened');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error toggling action item:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to update action item');
      setSnackbarSeverity('error');
    }
  };

  // Fetch action items and pending items when selected meeting changes
  useEffect(() => {
    if (selectedMeetingId) {
      fetchActionItems(selectedMeetingId);
      fetchPendingActionItems(selectedMeetingId);
    } else {
      setActionItems([]);
      setPendingActionItems([]);
      setSelectedPendingItems([]);
    }
  }, [selectedMeetingId]);

  const renderMeetingsTable = (meetings, title) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Transcript</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>AI Summary</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Email Draft</span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Meeting</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date & Time</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Source</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => {
                // const isComplete = meeting.transcript && (meeting.quick_summary || meeting.brief_summary) && meeting.email_summary_draft;
                // const hasPartialData = meeting.transcript || (meeting.quick_summary || meeting.brief_summary) || meeting.email_summary_draft;

                let clientInfo = null;
                if (meeting.attendees) {
                  try {
                    const attendees = JSON.parse(meeting.attendees);
                    const clientAttendee = attendees.find(a => a.email && a.email !== user?.email);
                    if (clientAttendee) {
                      clientInfo = {
                        name: clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0],
                        email: clientAttendee.email
                      };
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }

                return (
                  <tr
                    key={meeting.id}
                    onClick={() => handleMeetingSelect(meeting)}
                    className={cn(
                      "cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/50 last:border-b-0",
                      selectedMeetingId === meeting.id && "bg-primary/10 ring-2 ring-inset ring-primary"
                    )}
                  >
                    <td className="p-3">
                      <div className="font-medium text-sm text-foreground line-clamp-2">
                        {meeting.title || 'Untitled Meeting'}
                      </div>
                    </td>
                    <td className="p-3">
                      {clientInfo ? (
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{clientInfo.name}</div>
                          <div className="text-xs text-muted-foreground">{clientInfo.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No client</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">
                          {formatDate(meeting.start?.dateTime || meeting.startTime || meeting.starttime)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMeetingTime(meeting)}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center">
                        {getMeetingSource(meeting) === 'Google Calendar' ?
                          <GoogleIcon size={20} /> :
                          getMeetingSource(meeting) === 'Calendly' ?
                          <CalendlyIcon size={20} /> :
                          <OutlookIcon size={20} />
                        }
                      </div>
                    </td>
                    <td className="p-3">
                      {/* Smart Bot Status Badge */}
                      {(() => {
                        const badge = getBotStatusBadge(meeting, calendarConnection);
                        if (!badge) {
                          return <span className="text-xs text-muted-foreground">Upcoming</span>;
                        }
                        return (
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                            badge.color,
                            badge.bgColor
                          )}>
                            {badge.status === 'complete' && <CheckCircle2 className="w-3 h-3" />}
                            {badge.status === 'manual' && <FileText className="w-3 h-3" />}
                            {badge.status === 'no_participants' && <AlertCircle className="w-3 h-3" />}
                            {badge.status === 'no_recording' && <AlertCircle className="w-3 h-3" />}
                            {badge.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                            {badge.status === 'no_transcript' && <FileText className="w-3 h-3" />}
                            {badge.status === 'not_connected' && <Bot className="w-3 h-3" />}
                            <span>{badge.label}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* Bot Toggle - Only show for future meetings without transcript */}
                        {shouldShowBotToggle(meeting) && (() => {
                          const isBotEnabled = !meeting.skip_transcription_for_meeting;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                      checked={isBotEnabled}
                                      onCheckedChange={() => handleToggleBotForAnyMeeting(meeting)}
                                      className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400 h-5 w-9"
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{isBotEnabled ? 'Advicly Assistant will join - Click to disable' : 'Assistant disabled - Click to enable'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                        {hasValidMeetingUrl(meeting) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = getMeetingUrl(meeting);
                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="h-8 px-2 text-xs text-primary hover:text-primary"
                                >
                                  <Video className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Join Meeting</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditMeeting(meeting, e)}
                          className="h-8 px-2 text-xs"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMeetingsList = (meetings, title) => {
    if (viewMode === 'table') {
      return renderMeetingsTable(meetings, title);
    }

    // Determine sort order based on meeting type
    const sortOrder = title.includes('Past') ? 'desc' : 'asc';
    const groupedMeetings = groupMeetingsByDate(meetings, sortOrder);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {meetings.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 flex items-center justify-center">
                  <Check className="w-2 h-2 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Transcript</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 flex items-center justify-center">
                  <Check className="w-2 h-2 text-green-600 dark:text-green-400" />
                </div>
                <span>AI Summary</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 flex items-center justify-center">
                  <Check className="w-2 h-2 text-purple-600 dark:text-purple-400" />
                </div>
                <span>Email Draft</span>
              </div>
            </div>
          )}
        </div>

        {/* Render grouped meetings by date */}
        {groupedMeetings.map(([monthYear, monthMeetings]) => (
          <div key={monthYear} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground border-b border-border/30 pb-1">
              {monthYear}
            </h3>
            <div className="space-y-3">
              {monthMeetings.map((meeting) => {
        // Get bot status badge for smart left border coloring
        const badge = getBotStatusBadge(meeting, calendarConnection);
        const getBorderColor = () => {
          if (!badge) return "border-l-gray-300 dark:border-l-gray-600"; // future meeting
          if (badge.status === 'complete') return "border-l-green-500";
          if (badge.status === 'manual') return "border-l-blue-500";
          if (badge.status === 'no_participants' || badge.status === 'no_recording' || badge.status === 'failed') return "border-l-red-500";
          return "border-l-gray-300 dark:border-l-gray-600";
        };

        return (
          <Card
            key={meeting.id}
            onClick={() => handleMeetingSelect(meeting)}
            className={cn(
              "cursor-pointer hover:bg-muted/50 transition-colors relative border-l-4",
              // Prominent selection indicator - takes priority over status colors
              selectedMeetingId === meeting.id
                ? "ring-2 ring-primary !border-l-primary bg-primary/10 shadow-lg shadow-primary/20"
                : getBorderColor()
            )}
          >
            <CardContent className="p-3">
              {/* Top Row: Calendar Icon, Title, and Bot Toggle */}
            <div className="flex items-center gap-2 mb-2">
              {/* Source Icon */}
              <div className="flex-shrink-0">
                {getMeetingSource(meeting) === 'Google Calendar' ?
                  <GoogleIcon size={16} /> :
                  getMeetingSource(meeting) === 'Calendly' ?
                  <CalendlyIcon size={16} /> :
                  <OutlookIcon size={16} />
                }
              </div>

              {/* Title */}
              <h3 className="text-sm font-medium text-foreground line-clamp-1 break-words flex-1 min-w-0">
                {meeting.title || 'Untitled Meeting'}
              </h3>

              {/* Bot Toggle - Inline with title for future meetings */}
              {shouldShowBotToggle(meeting) && (() => {
                const isBotEnabled = !meeting.skip_transcription_for_meeting;
                return (
                  <div
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={isBotEnabled}
                      onCheckedChange={() => handleToggleBotForAnyMeeting(meeting)}
                      className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400 h-5 w-9"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">

                {/* Meeting Details Row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(meeting.start?.dateTime || meeting.startTime || meeting.starttime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatMeetingTime(meeting)}</span>
                    </div>
                  </div>

                </div>

                {/* Client Information - Enhanced to show linked client or attendee */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    {(() => {
                      // First, check if there's a linked client from the database
                      if (meeting.client) {
                        return (
                          <div className="flex items-center gap-1 text-xs">
                            <Mail className="w-3 h-3 text-primary/60 flex-shrink-0" />
                            <span className="font-medium text-primary truncate">
                              {meeting.client.name || meeting.client.email}
                            </span>
                            {meeting.client.name && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground truncate">
                                  {meeting.client.email}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      }

                      // Fallback to attendees if no linked client
                      if (meeting.attendees) {
                        try {
                          const attendees = JSON.parse(meeting.attendees);
                          const clientAttendee = attendees.find(a => a.email && a.email !== user?.email);
                          if (clientAttendee) {
                            return (
                              <div className="flex items-center gap-1 text-xs">
                                <Mail className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                                <span className="font-medium text-muted-foreground truncate">
                                  {clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0]}
                                </span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="text-muted-foreground/80 truncate">
                                  {clientAttendee.email}
                                </span>
                              </div>
                            );
                          }
                        } catch (e) {
                          return null;
                        }
                      }

                      // Show "No client linked" with inline button if neither exists
                      return (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="italic">No client linked</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setLinkClientMeeting(meeting);
                              setShowLinkClientDialog(true);
                            }}
                            className="h-5 px-2 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"
                          >
                            Link
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Bottom Row: Status Badge and Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Smart Bot Status Badge for Past Meetings */}
                    {(() => {
                      const badge = getBotStatusBadge(meeting, calendarConnection);
                      if (!badge) return null;
                      return (
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                          badge.color,
                          badge.bgColor
                        )}>
                          {badge.status === 'complete' && <CheckCircle2 className="w-3 h-3" />}
                          {badge.status === 'manual' && <FileText className="w-3 h-3" />}
                          {badge.status === 'no_participants' && <AlertCircle className="w-3 h-3" />}
                          {badge.status === 'no_recording' && <AlertCircle className="w-3 h-3" />}
                          {badge.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                          {badge.status === 'no_transcript' && <FileText className="w-3 h-3" />}
                          {badge.status === 'not_connected' && <Bot className="w-3 h-3" />}
                          <span>{badge.label}</span>
                        </div>
                      );
                    })()}

                    {/* Attendee Avatars */}
                    <AttendeeAvatars
                      meeting={meeting}
                      currentUserEmail={user?.email}
                      maxVisible={2}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {hasValidMeetingUrl(meeting) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = getMeetingUrl(meeting);
                                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                              }}
                              className="h-6 px-2 text-xs text-primary hover:text-primary"
                              title="Join meeting"
                            >
                              <Video className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Join Meeting</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEditMeeting(meeting, e)}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="Edit meeting"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span className="text-muted-foreground">Loading meetings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background relative">
      {/* Main Content - Meetings List */}
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 p-4 sm:p-6 bg-card/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Meetings</h1>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background">
                <Button
                  onClick={() => setViewMode('calendar')}
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar View</span>
                </Button>
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List View</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border border-border/50 rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
            />
          </div>

          {/* Segmented Control - Only show in List View */}
          {viewMode === 'list' && (
            <div className="flex bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => setMeetingView('past')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                  meetingView === 'past'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Past
              </button>
              <button
                onClick={() => setMeetingView('today')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                  meetingView === 'today'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Today
              </button>
              <button
                onClick={() => setMeetingView('upcoming')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                  meetingView === 'upcoming'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upcoming
              </button>
            </div>
          )}
        </div>

        {/* Meetings List */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'list' ? (
            <div className="p-4 sm:p-6">
          {meetingView === 'past' && (
            <div className="space-y-6">
              {meetings.past.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No past meetings found</h3>
                  <p className="text-muted-foreground mb-4">
                    {loading ? 'Loading meetings...' : 'No past meetings are currently visible.'}
                  </p>
                  {!loading && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        If you expect to see meetings here, try:
                      </p>

                    </div>
                  )}
                </div>
              ) : (
                renderMeetingsList(meetings.past, 'Past Meetings')
              )}
            </div>
          )}

          {meetingView === 'today' && (
            <div className="space-y-6">
              {(() => {
                const today = new Date();
                const todayMeetings = meetings.future.filter(meeting => {
                  const meetingDate = new Date(meeting.start?.dateTime || meeting.startTime || meeting.starttime);
                  return meetingDate.toDateString() === today.toDateString();
                });

                if (todayMeetings.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Looks like you don't have any meetings today!</h3>
                      <p className="text-muted-foreground">Check the <strong>Upcoming</strong> tab to see future meetings, or click <strong>New</strong> to create one.</p>
                    </div>
                  );
                }

                return renderMeetingsList(todayMeetings, 'Today');
              })()}
            </div>
          )}

          {meetingView === 'upcoming' && (
            <div className="space-y-6">
              {meetings.future.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No upcoming meetings</h3>
                  <p className="text-muted-foreground">You don't have any upcoming meetings.</p>
                </div>
              ) : (
                renderMeetingsList(meetings.future, 'Upcoming Meetings')
              )}
            </div>
          )}
          </div>
          ) : (
            /* Calendar View */
            <div className="p-4 sm:p-6">
              {/* Calendar Header */}
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-4">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <Button onClick={goToToday} variant="outline" size="sm">
                    Today
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={goToPreviousWeek} variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button onClick={goToNextWeek} variant="outline" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Calendar Grid - Scrollable on mobile */}
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <div className="grid grid-cols-7 gap-2 sm:gap-4 min-w-[700px] sm:min-w-0">
                {getWeekDays().map((day, index) => {
                  const meetingsOnDay = getMeetingsForDay(day);
                  const dayIsToday = isToday(day);

                  return (
                    <div key={index} className="flex flex-col">
                      {/* Day Header */}
                      <div className={cn(
                        "text-center p-3 border-b-2 mb-3",
                        dayIsToday ? "border-primary bg-primary/5" : "border-border"
                      )}>
                        <div className="text-xs font-medium text-muted-foreground uppercase">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={cn(
                          "text-2xl font-bold mt-1",
                          dayIsToday ? "text-primary" : "text-foreground"
                        )}>
                          {day.getDate()}
                        </div>
                      </div>

                      {/* Meetings for this day */}
                      <div className="space-y-2 min-h-[200px]">
                        {meetingsOnDay.length > 0 ? (
                          meetingsOnDay.map((meeting) => {
                            const attendees = extractAttendees(meeting, user?.email);
                            const clientName = attendees.length > 0 ? attendees[0].name : null;

                            return (
                              <Card
                                key={meeting.id}
                                className={cn(
                                  "border-border/50 hover:border-primary/50 cursor-pointer transition-all hover:shadow-md",
                                  // Prominent selection indicator
                                  selectedMeetingId === meeting.id && "ring-2 ring-primary border-primary shadow-lg shadow-primary/20 bg-primary/5",
                                  getMeetingCardGlowStyle(meeting)
                                )}
                                onClick={() => setSelectedMeetingId(meeting.id)}
                              >
                                <CardContent className="p-3 space-y-2">
                                  {/* Time */}
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <div className="text-xs text-muted-foreground font-medium">
                                      {formatMeetingTime(meeting)}
                                    </div>
                                  </div>

                                  {/* Title */}
                                  <div className="font-semibold text-sm text-foreground line-clamp-2">
                                    {meeting.title || 'Untitled Meeting'}
                                  </div>

                                  {/* Client Name with Avatar */}
                                  {clientName && (
                                    <div className="flex items-center gap-2">
                                      <Avatar className="w-5 h-5 flex-shrink-0">
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                          {getInitials(clientName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {clientName}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bot Toggle - Only show for future meetings without transcript */}
                                  {shouldShowBotToggle(meeting) && (() => {
                                    const isBotEnabled = !meeting.skip_transcription_for_meeting;
                                    const platform = getMeetingPlatform(meeting);
                                    const platformLogo = platform ? VIDEO_PLATFORM_LOGOS[platform] : null;
                                    return (
                                      <div
                                        className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg bg-muted/30 border border-border/30"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center gap-2">
                                          {platformLogo && (
                                            <img src={platformLogo} alt={getPlatformDisplayName(platform)} className="w-5 h-5 object-contain" />
                                          )}
                                        </div>
                                        <Switch
                                          checked={isBotEnabled}
                                          onCheckedChange={() => handleToggleBotForAnyMeeting(meeting)}
                                          className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400 h-5 w-9"
                                        />
                                      </div>
                                    );
                                  })()}

                                  {/* Smart Bot Status Badge for Past Meetings */}
                                  {(() => {
                                    const badge = getBotStatusBadge(meeting, calendarConnection);
                                    if (!badge) return null;
                                    return (
                                      <div className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                                        badge.color,
                                        badge.bgColor
                                      )}>
                                        {badge.status === 'complete' && <CheckCircle2 className="w-3 h-3" />}
                                        {badge.status === 'manual' && <FileText className="w-3 h-3" />}
                                        {badge.status === 'no_participants' && <AlertCircle className="w-3 h-3" />}
                                        {badge.status === 'no_recording' && <AlertCircle className="w-3 h-3" />}
                                        {badge.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                                        {badge.status === 'no_transcript' && <FileText className="w-3 h-3" />}
                                        {badge.status === 'not_connected' && <Bot className="w-3 h-3" />}
                                        <span>{badge.label}</span>
                                      </div>
                                    );
                                  })()}
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No meetings
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Detail Panel - Full Screen Overlay */}
      {selectedMeeting && (
        <>
          {/* Mobile Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSelectedMeetingId(null)}
          />

          {/* Detail Panel - Expanded Width */}
          <div className="fixed right-0 top-0 h-full w-full lg:w-[45%] xl:w-[40%] bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border/50 p-4 sm:p-6 flex-shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getMeetingSource(selectedMeeting) === 'Google Calendar' ?
                    <GoogleIcon size={18} className="flex-shrink-0" /> :
                    getMeetingSource(selectedMeeting) === 'Calendly' ?
                    <CalendlyIcon size={18} className="flex-shrink-0" /> :
                    <OutlookIcon size={18} className="flex-shrink-0" />
                  }
                  <h1 className="text-base lg:text-lg font-bold text-foreground line-clamp-2 break-words">
                    {selectedMeeting.summary || selectedMeeting.title || 'Untitled Meeting'}
                  </h1>
                </div>

                {/* Client info display - Enhanced to show linked client or attendee with navigation */}
                {(() => {
                  // First, check if there's a linked client from the database
                  if (selectedMeeting.client) {
                    return (
                      <div
                        className="flex items-center mb-2 text-sm cursor-pointer hover:bg-primary/5 -mx-2 px-2 py-1 rounded transition-colors group"
                        onClick={() => {
                          // Navigate to Clients page with client parameter (using React Router for SPA navigation)
                          navigate(`/clients?client=${encodeURIComponent(selectedMeeting.client.email)}`);
                        }}
                        title="Click to view client profile"
                      >
                        <Mail className="h-4 w-4 mr-2 text-primary/60 group-hover:text-primary" />
                        <span className="font-medium text-primary group-hover:underline">{selectedMeeting.client.name || selectedMeeting.client.email.split('@')[0]}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-foreground/70">{selectedMeeting.client.email}</span>
                      </div>
                    );
                  }

                  // Fallback to attendees if no linked client - make clickable to navigate/create client
                  if (selectedMeeting.attendees) {
                    try {
                      const attendees = JSON.parse(selectedMeeting.attendees);
                      const clientAttendee = attendees.find(a => a.email && a.email !== user?.email);
                      if (clientAttendee) {
                        const attendeeName = clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0];
                        return (
                          <div
                            className="flex items-center mb-2 text-sm cursor-pointer hover:bg-primary/5 -mx-2 px-2 py-1 rounded transition-colors group"
                            onClick={() => {
                              // Navigate to Clients page with email to find or create this client (using React Router for SPA navigation)
                              navigate(`/clients?client=${encodeURIComponent(clientAttendee.email)}`);
                            }}
                            title="Click to view or create client profile"
                          >
                            <Mail className="h-4 w-4 mr-2 text-muted-foreground/60 group-hover:text-primary" />
                            <span className="font-medium text-muted-foreground group-hover:text-primary group-hover:underline">{attendeeName}</span>
                            <span className="mx-2 text-muted-foreground/60">•</span>
                            <span className="text-muted-foreground/80">{clientAttendee.email}</span>
                          </div>
                        );
                      }
                    } catch (e) {
                      return null;
                    }
                  }

                  // Show "No client linked" with inline button if neither exists
                  return (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="italic">No client linked</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLinkClientMeeting(selectedMeeting);
                          setShowLinkClientDialog(true);
                        }}
                        className="h-5 px-2 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"
                      >
                        Link
                      </Button>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(selectedMeeting.start?.dateTime || selectedMeeting.startTime || selectedMeeting.starttime)}</span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatMeetingTime(selectedMeeting)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleEditMeeting(selectedMeeting, e)}
                  className="h-8 w-8 p-0"
                  title="Edit meeting"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMeetingId(null)}
                  className="h-8 w-8 p-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Meeting Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Recall Bot Status Indicator - Only show for FUTURE meetings
                  Past meeting status is already shown in the card badge */}
              {botStatus && !botStatus.isMeetingPast && (
                <div className={`p-4 rounded-lg border-2 ${getStatusColor(botStatus.status)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getStatusIcon(botStatus.willJoin)}</span>
                        <h3 className="font-semibold text-sm">
                          {botStatus.linkToSettings ? (
                            <Link
                              to="/settings?section=meetings"
                              className="underline hover:text-primary transition-colors"
                            >
                              {botStatus.reason}
                            </Link>
                          ) : (
                            botStatus.reason
                          )}
                        </h3>
                      </div>
                      {!botStatus.willJoin && botStatus.status === 'error' && !botStatus.linkToSettings && (
                        <p className="text-xs opacity-90">
                          💡 Hint: {botStatus.reason}
                        </p>
                      )}
                    </div>
                    {botStatus.showToggleButton && (
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleToggleBotForMeeting}
                          disabled={togglingBot}
                          className="text-xs h-8"
                        >
                          {togglingBot ? 'Updating...' : selectedMeeting?.skip_transcription_for_meeting ? 'Enable bot' : 'Disable bot'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Join Meeting Button - Show for future meetings with valid URL */}
              {selectedMeeting && hasValidMeetingUrl(selectedMeeting) && (() => {
                const platform = getMeetingPlatform(selectedMeeting);
                const platformLogo = platform ? VIDEO_PLATFORM_LOGOS[platform] : null;
                const platformName = platform ? getPlatformDisplayName(platform) : 'Video Meeting';

                return (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center gap-2 flex-1">
                      {platformLogo ? (
                        <img src={platformLogo} alt={platformName} className="w-6 h-6 object-contain" />
                      ) : (
                        <Video className="w-5 h-5 text-primary" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{platformName}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-[300px]">
                          {getMeetingUrl(selectedMeeting)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const url = getMeetingUrl(selectedMeeting);
                        if (url) window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Join Meeting
                    </Button>
                  </div>
                );
              })()}

              {/* Tabs - New Order: Ask Advicly, Summary, Generate Email, Transcript, Documents */}
              <div className="flex border-b border-border/50 mb-4 overflow-x-auto">
                {/* Ask Advicly Tab */}
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'ask'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('ask')}
                >
                  <Sparkles className="w-4 h-4" />
                  Ask Advicly
                </button>

                {/* Summary Tab */}
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'summary'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('summary')}
                >
                  <MessageSquare className="w-4 h-4" />
                  Summary
                  {selectedMeeting?.quick_summary && (
                    <div className="w-2 h-2 bg-green-500 rounded-full ml-1"></div>
                  )}
                </button>

                {/* Generate Email Tab */}
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'email'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('email')}
                >
                  <Mail className="w-4 h-4" />
                  Generate Email
                  {selectedMeeting?.email_summary_draft && (
                    <div className="w-2 h-2 bg-purple-500 rounded-full ml-1"></div>
                  )}
                </button>

                {/* Transcript Tab */}
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'transcript'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('transcript')}
                >
                  <FileText className="w-4 h-4" />
                  Transcript
                  {selectedMeeting?.transcript && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-1"></div>
                  )}
                </button>

                {/* Documents Tab */}
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'documents'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('documents')}
                >
                  <Upload className="w-4 h-4" />
                  Documents
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Ask Advicly Tab Content - Inline Chat */}
                {activeTab === 'ask' && (
                  <div className="h-[calc(100vh-380px)] min-h-[400px]">
                    <InlineChatWidget
                      contextType="meeting"
                      contextData={{
                        meetingId: selectedMeeting?.id,
                        meetingTitle: selectedMeeting?.summary || selectedMeeting?.title || 'Meeting',
                        meetingDate: selectedMeeting?.startTime || selectedMeeting?.start || selectedMeeting?.date,
                        clientName: (() => {
                          if (selectedMeeting?.attendees) {
                            try {
                              const attendees = typeof selectedMeeting.attendees === 'string'
                                ? JSON.parse(selectedMeeting.attendees)
                                : selectedMeeting.attendees;
                              const currentUserEmail = user?.email || '';
                              const clientAttendee = attendees.find(a => a.email !== currentUserEmail);
                              return clientAttendee?.name || clientAttendee?.email || null;
                            } catch (e) { return null; }
                          }
                          return null;
                        })(),
                        hasTranscript: !!selectedMeeting?.transcript,
                        hasSummary: !!selectedMeeting?.quick_summary
                      }}
                      meetingId={selectedMeeting?.id}
                      meetingTitle={selectedMeeting?.summary || selectedMeeting?.title}
                      clientName={(() => {
                        if (selectedMeeting?.attendees) {
                          try {
                            const attendees = typeof selectedMeeting.attendees === 'string'
                              ? JSON.parse(selectedMeeting.attendees)
                              : selectedMeeting.attendees;
                            const currentUserEmail = user?.email || '';
                            const clientAttendee = attendees.find(a => a.email !== currentUserEmail);
                            return clientAttendee?.name || clientAttendee?.email || null;
                          } catch (e) { return null; }
                        }
                        return null;
                      })()}
                      className="rounded-lg border border-border/50"
                    />
                  </div>
                )}

                {/* Generate Email Tab Content */}
                {activeTab === 'email' && (
                  <div className="space-y-4">
                    {/* Show streaming content with typewriter effect */}
                    {isStreaming && (
                      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                            <span className="text-sm font-medium text-primary">Generating email...</span>
                          </div>
                          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed font-mono bg-background/50 p-4 rounded-lg border border-border/30">
                            {streamingContent}
                            <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Show generate button when no email exists and not streaming */}
                    {!isStreaming && !streamingComplete && !selectedMeeting?.email_summary_draft && selectedMeeting?.transcript && (
                      <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                        <CardContent className="p-6 text-center">
                          <Mail className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">Generate Meeting Email</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Create a professional email summary of this meeting using your templates.
                          </p>
                          <Button
                            size="lg"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => setShowTemplateModal(true)}
                            disabled={generatingSummary}
                          >
                            <Mail className="w-5 h-5 mr-2" />
                            {generatingSummary ? 'Generating...' : 'Choose Template & Generate'}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* No transcript message */}
                    {!isStreaming && !selectedMeeting?.transcript && (
                      <Card className="border-border/50">
                        <CardContent className="p-6 text-center text-muted-foreground">
                          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No transcript available. Email generation requires a meeting transcript.</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Show email draft - either from streaming completion or from database */}
                    {!isStreaming && (streamingComplete || selectedMeeting?.email_summary_draft) && (
                      <div className="space-y-3">
                        {/* Header with view toggle and actions */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Email Draft</h3>
                            {/* View mode toggle */}
                            <div className="flex items-center bg-muted rounded-lg p-0.5">
                              <button
                                onClick={() => setEmailViewMode('preview')}
                                className={cn(
                                  "px-2 py-1 text-xs rounded-md transition-all",
                                  emailViewMode === 'preview'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <Eye className="w-3 h-3 inline mr-1" />
                                Preview
                              </button>
                              <button
                                onClick={() => setEmailViewMode('plain')}
                                className={cn(
                                  "px-2 py-1 text-xs rounded-md transition-all",
                                  emailViewMode === 'plain'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <FileText className="w-3 h-3 inline mr-1" />
                                Plain Text
                              </button>
                            </div>
                            {/* Generate New Email button - moved here */}
                            {selectedMeeting?.transcript && !streamingComplete && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowTemplateModal(true)}
                                disabled={generatingSummary}
                                className="h-7 text-xs"
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Generate New
                              </Button>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            {/* Copy to clipboard */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const content = streamingComplete ? streamingContent : selectedMeeting?.email_summary_draft;
                                      if (content) {
                                        navigator.clipboard.writeText(content);
                                        setCopiedEmail(true);
                                        setTimeout(() => setCopiedEmail(false), 2000);
                                        setShowSnackbar(true);
                                        setSnackbarMessage('Email copied to clipboard');
                                        setSnackbarSeverity('success');
                                      }
                                    }}
                                    className="h-8 px-2"
                                  >
                                    {copiedEmail ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy to clipboard</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Open in email client */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const content = streamingComplete ? streamingContent : selectedMeeting?.email_summary_draft;
                                      const clientEmail = selectedMeeting?.client?.email || '';
                                      const meetingTitle = selectedMeeting?.title || 'Meeting Follow-up';
                                      // Create mailto link with pre-filled recipient, subject and body
                                      const subject = encodeURIComponent(`Follow-up: ${meetingTitle}`);
                                      const body = encodeURIComponent(content || '');
                                      window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
                                    }}
                                    className="h-8 px-2"
                                  >
                                    <Send className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Open in email client</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                          </div>
                        </div>

                        {/* Email content card - glassy design */}
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                          <CardContent className="p-0">
                            {emailViewMode === 'preview' ? (
                              /* Email Preview Mode - styled like an email */}
                              <div className="p-5">
                                {/* Email header */}
                                <div className="border-b border-border/30 pb-3 mb-4">
                                  <div className="space-y-1.5">
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">To:</span>
                                      <span className="ml-2 text-foreground">
                                        {selectedMeeting?.client?.name || selectedMeeting?.clients?.name || 'Client'}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Subject:</span>
                                      <span className="ml-2 text-foreground font-medium">
                                        Follow-up: {selectedMeeting?.title || 'Meeting'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {/* Email body */}
                                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                                  {streamingComplete ? streamingContent : selectedMeeting?.email_summary_draft}
                                </div>
                              </div>
                            ) : (
                              /* Plain Text Mode - for easy copying */
                              <div className="p-4">
                                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg overflow-x-auto">
                                  {streamingComplete ? streamingContent : selectedMeeting?.email_summary_draft}
                                </pre>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    {selectedMeeting?.transcript ? (
                      <div className="space-y-4">
                        {/* Quick Summary Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Quick Summary</h3>
                          </div>
                          {(quickSummary || selectedMeeting?.quick_summary) ? (
                            <Card className="border-border/50">
                              <CardContent className="p-3">
                                <div className="text-sm text-foreground whitespace-pre-line">
                                  {quickSummary || selectedMeeting?.quick_summary}
                                </div>
                              </CardContent>
                            </Card>
                          ) : autoGenerating ? (
                            <Card className="border-border/50">
                              <CardContent className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                  Generating quick summary...
                                </div>
                              </CardContent>
                            </Card>
                          ) : null}
                        </div>

                        {/* Pending Action Items Section - Awaiting Approval */}
                        {pendingActionItems.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-foreground">
                                Pending Action Items
                                <span className="ml-2 text-xs font-normal text-orange-600">
                                  ({pendingActionItems.length} awaiting approval)
                                </span>
                              </h3>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={toggleSelectAllPending}
                                  className="h-7 text-xs"
                                >
                                  {selectedPendingItems.length === pendingActionItems.length ? 'Deselect All' : 'Select All'}
                                </Button>
                              </div>
                            </div>

                            {loadingPendingItems ? (
                              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                    Loading pending items...
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {pendingActionItems.map((item) => (
                                    <Card key={item.id} className="border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all">
                                      <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={selectedPendingItems.includes(item.id)}
                                            onChange={() => togglePendingItemSelection(item.id)}
                                            className="mt-1 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                                          />
                                          <div className="flex-1 space-y-2">
                                            {editingPendingItemId === item.id ? (
                                              // Edit mode
                                              <div className="space-y-2">
                                                <textarea
                                                  value={editingPendingText}
                                                  onChange={(e) => setEditingPendingText(e.target.value)}
                                                  className="w-full text-sm bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                                                  rows={2}
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                      savePendingItemEdit(item.id);
                                                    } else if (e.key === 'Escape') {
                                                      cancelEditingPendingItem();
                                                    }
                                                  }}
                                                />
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    size="sm"
                                                    onClick={() => savePendingItemEdit(item.id)}
                                                    disabled={savingPendingEdit}
                                                    className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
                                                  >
                                                    {savingPendingEdit ? (
                                                      <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                                                        Saving...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Save className="w-3 h-3 mr-1" />
                                                        Save
                                                      </>
                                                    )}
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={cancelEditingPendingItem}
                                                    disabled={savingPendingEdit}
                                                    className="h-7 text-xs"
                                                  >
                                                    <X className="w-3 h-3 mr-1" />
                                                    Cancel
                                                  </Button>
                                                  <span className="text-xs text-muted-foreground ml-2">
                                                    Ctrl+Enter to save, Esc to cancel
                                                  </span>
                                                </div>
                                              </div>
                                            ) : (
                                              // View mode
                                              <>
                                                <div className="flex items-start justify-between group">
                                                  <p className="text-sm text-foreground flex-1">
                                                    {item.action_text}
                                                  </p>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEditingPendingItem(item)}
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                                                  </Button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-muted-foreground">Priority:</span>
                                                  <Select
                                                    value={String(pendingItemPriorities[item.id] || 3)}
                                                    onValueChange={(value) => updatePendingItemPriority(item.id, parseInt(value))}
                                                  >
                                                    <SelectTrigger className="w-32 h-7 text-xs">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {priorityOptions.map(option => (
                                                        <SelectItem key={option.value} value={String(option.value)}>
                                                          <span className="flex items-center gap-1">
                                                            <span>{option.icon}</span>
                                                            <span>{option.label}</span>
                                                          </span>
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}

                                  {/* Add New Action Item */}
                                  {addingPendingItem ? (
                                    <Card className="border-2 border-orange-400 bg-orange-100 shadow-md">
                                      <CardContent className="p-4">
                                        <div className="space-y-3">
                                          <textarea
                                            value={newPendingItemText}
                                            onChange={(e) => setNewPendingItemText(e.target.value)}
                                            placeholder="Enter action item text..."
                                            className="w-full text-sm border-2 border-orange-400 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            rows={3}
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.ctrlKey) {
                                                saveNewPendingItem();
                                              } else if (e.key === 'Escape') {
                                                cancelAddingPendingItem();
                                              }
                                            }}
                                          />
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-orange-900">Priority:</span>
                                            <Select
                                              value={String(newPendingItemPriority)}
                                              onValueChange={(value) => setNewPendingItemPriority(parseInt(value))}
                                            >
                                              <SelectTrigger className="w-32 h-8 text-xs border-orange-400">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {priorityOptions.map(option => (
                                                  <SelectItem key={option.value} value={String(option.value)}>
                                                    <span className="flex items-center gap-1">
                                                      <span>{option.icon}</span>
                                                      <span>{option.label}</span>
                                                    </span>
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              onClick={saveNewPendingItem}
                                              disabled={savingNewPendingItem}
                                              className="h-8 text-xs bg-orange-600 hover:bg-orange-700 font-medium"
                                            >
                                              {savingNewPendingItem ? (
                                                <>
                                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                                                  Adding...
                                                </>
                                              ) : (
                                                <>
                                                  <Plus className="w-3 h-3 mr-1" />
                                                  Add
                                                </>
                                              )}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={cancelAddingPendingItem}
                                              disabled={savingNewPendingItem}
                                              className="h-8 text-xs border-orange-400"
                                            >
                                              <X className="w-3 h-3 mr-1" />
                                              Cancel
                                            </Button>
                                            <span className="text-xs text-orange-800 ml-2 font-medium">
                                              Ctrl+Enter to add, Esc to cancel
                                            </span>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={startAddingPendingItem}
                                      className="w-full h-9 text-sm border-2 border-orange-400 text-orange-700 hover:bg-orange-100 hover:border-orange-500 font-medium shadow-sm"
                                    >
                                      <Plus className="w-4 h-4 mr-2" />
                                      Add Action Item
                                    </Button>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                  <Button
                                    onClick={approvePendingActionItems}
                                    disabled={selectedPendingItems.length === 0}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    size="sm"
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    Approve Selected ({selectedPendingItems.length})
                                  </Button>
                                  <Button
                                    onClick={rejectPendingActionItems}
                                    disabled={selectedPendingItems.length === 0}
                                    variant="outline"
                                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                                    size="sm"
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Reject Selected ({selectedPendingItems.length})
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Action Points Section - Checkbox To-Do List */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            Action Points
                            {actionItems.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                ({actionItems.filter(i => !i.completed).length} pending, {actionItems.filter(i => i.completed).length} completed)
                              </span>
                            )}
                          </h3>
                          {loadingActionItems ? (
                            <Card>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                  Loading action items...
                                </div>
                              </CardContent>
                            </Card>
                          ) : actionItems.length > 0 ? (
                            <div className="space-y-2">
                              {actionItems.map((item) => (
                                <Card key={item.id} className="border-border/50">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={item.completed || false}
                                        onChange={() => toggleActionItem(item.id)}
                                        className="mt-1 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                                      />
                                      <div className="flex-1">
                                        <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                          {item.action_text}
                                        </p>
                                        {item.completed_at && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Completed: {new Date(item.completed_at).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <Card>
                              <CardContent className="p-3">
                                <div className="text-sm text-muted-foreground italic">
                                  No action points generated yet. Action points will be automatically extracted when summaries are generated.
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Card className="border-border/50">
                        <CardContent className="p-6 text-center">
                          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">Upload transcript to generate summaries</h3>
                          <p className="text-muted-foreground mb-4">
                            Upload a transcript to automatically generate both quick and email summaries.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {activeTab === 'documents' && (
                  <DocumentsTab
                    meetingId={selectedMeeting?.id}
                    selectedMeeting={selectedMeeting}
                  />
                )}

                {activeTab === 'transcript' && (
                  <div className="space-y-4">
                    {/* Transcript Header */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
                      {selectedMeeting?.transcript && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteTranscript}
                          disabled={deletingTranscript}
                          className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                        >
                          {deletingTranscript ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </div>

                    {/* Transcript Upload Interface */}
                    {!selectedMeeting?.transcript && !showTranscriptUpload && (
                      <Card className="border-border/50">
                        <CardContent className="p-6 text-center">
                          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">Add Meeting Transcript</h3>
                          <p className="text-muted-foreground mb-4">
                            Upload a transcript to automatically generate AI-powered summaries and insights.
                          </p>
                          <Button
                            onClick={() => setShowTranscriptUpload(true)}
                            className="mb-2"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Add Transcript
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Paste text or upload a file • AI summaries generated automatically
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Transcript Upload Form */}
                    {showTranscriptUpload && !selectedMeeting?.transcript && (
                      <Card className="border-border/50">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-foreground">Upload Transcript</h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowTranscriptUpload(false);
                                  setTranscriptUpload('');
                                }}
                                className="h-6 w-6 p-0"
                              >
                                ×
                              </Button>
                            </div>

                            {/* Upload Progress States */}
                            {uploadingTranscript && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                      {generatingAISummaries ? 'Generating AI summaries...' : 'Processing transcript...'}
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                      {generatingAISummaries ? 'Creating quick summary and email draft' : 'Uploading and analyzing content'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Transcript Input */}
                            {!uploadingTranscript && (
                              <div className="space-y-3">
                                <textarea
                                  value={transcriptUpload}
                                  onChange={(e) => setTranscriptUpload(e.target.value)}
                                  placeholder="Paste your meeting transcript here...

Example:
- Discussion about client's investment goals
- Review of current portfolio performance
- Next steps and action items"
                                  className="w-full h-32 p-3 text-sm border border-border/50 rounded-lg bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                                />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground">
                                    {transcriptUpload.length} characters • AI summaries will be generated automatically
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setShowTranscriptUpload(false);
                                        setTranscriptUpload('');
                                      }}
                                      className="h-8 px-3 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={handleTranscriptUpload}
                                      disabled={!transcriptUpload.trim()}
                                      size="sm"
                                      className="h-8 px-3 text-xs"
                                    >
                                      <Upload className="w-3 h-3 mr-1" />
                                      Upload & Generate Summaries
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Transcript Content */}
                    {selectedMeeting?.transcript && (
                      <Card className="border-border/50">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <h3 className="text-sm font-medium text-foreground">Meeting Transcript</h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{selectedMeeting.transcript.length} characters</span>
                              {selectedMeeting.quick_summary && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                                  AI summaries generated
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none text-foreground">
                            <div className="whitespace-pre-line text-sm leading-relaxed">{selectedMeeting.transcript}</div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* AI Adjustment Dialog */}
      <AIAdjustmentDialog
        isOpen={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onAdjust={handleAIAdjustment}
        currentSummary={summaryContent}
      />

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full border border-border/30 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Select Email Template</h2>
                  <p className="text-sm text-muted-foreground mt-1">Choose a template to generate your email summary</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplateModal(false)}
                  className="h-8 w-8 p-0 hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Template List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all duration-200",
                      selectedTemplate?.id === template.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 ring-1 ring-primary/30"
                        : "border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-border/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className={cn(
                            "w-4 h-4",
                            selectedTemplate?.id === template.id ? "text-primary" : "text-muted-foreground"
                          )} />
                          <h3 className={cn(
                            "font-semibold",
                            selectedTemplate?.id === template.id ? "text-primary" : "text-foreground"
                          )}>{template.title}</h3>
                          {selectedTemplate?.id === template.id && (
                            <div className="ml-auto">
                              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description || 'Professional email template for meeting summaries'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border/30 bg-card/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate ? `Selected: ${selectedTemplate.title}` : 'Select a template above'}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowTemplateModal(false)}
                    className="border-border/50 hover:bg-card/80"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTemplateModal(false);
                      // Use standard generation flow with typewriter effect for all templates
                      handleGenerateAISummary();
                    }}
                    disabled={!selectedTemplate || generatingSummary}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {generatingSummary ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Generate Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Import Meetings</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImportDialog(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6">
              <DataImport
                onImportComplete={() => {
                  fetchMeetings();
                  setShowImportDialog(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Meeting Dialog */}
      <EditMeetingDialog
        meeting={editingMeeting}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onMeetingUpdated={handleMeetingUpdated}
      />

      {/* Link Client Dialog */}
      {linkClientMeeting && (
        <LinkClientDialog
          meeting={linkClientMeeting}
          open={showLinkClientDialog}
          onOpenChange={setShowLinkClientDialog}
          onClientLinked={() => {
            // Refresh meetings to show updated client link
            fetchMeetings();
          }}
        />
      )}

      {/* Snackbar */}
      {showSnackbar && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={cn(
            "px-4 py-3 rounded-lg shadow-lg text-white",
            snackbarSeverity === 'success' && "bg-green-600",
            snackbarSeverity === 'error' && "bg-red-600",
            snackbarSeverity === 'warning' && "bg-yellow-600"
          )}>
            {snackbarMessage}
          </div>
        </div>
      )}
    </div>
  );
}
