import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { cn } from '../lib/utils';
import {
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Upload,
  Check,
  Mail,
  Edit,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Star,
  X,
  Edit2,
  Plus,
  Save
} from 'lucide-react';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';
import DocumentsTab from '../components/DocumentsTab';
import CreateMeetingDialog from '../components/CreateMeetingDialog';
import EditMeetingDialog from '../components/EditMeetingDialog';
import LinkClientDialog from '../components/LinkClientDialog';
import DataImport from '../components/DataImport';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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

// Helper function to check if meeting is complete (has transcript + summaries)
function isMeetingComplete(meeting) {
  return meeting.transcript &&
         meeting.quick_summary &&
         meeting.email_summary_draft;
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

// Load templates from localStorage
function loadTemplates() {
  const saved = localStorage.getItem('advicly_templates');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
}

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
  const [templates, setTemplates] = useState(loadTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentSummaryTemplate, setCurrentSummaryTemplate] = useState(null);

  // Add new state for auto-generated summaries
  const [quickSummary, setQuickSummary] = useState('');
  const [emailSummary, setEmailSummary] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);

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

  // Load templates on component mount
  useEffect(() => {
    const loadedTemplates = loadTemplates();
    setTemplates(loadedTemplates);
    if (loadedTemplates.length > 0) {
      // Default to Advicly Summary template (auto-template)
      const adviclyTemplate = loadedTemplates.find(t => t.id === 'auto-template') || loadedTemplates[0];
      setSelectedTemplate(adviclyTemplate);
    }
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

  const handleMeetingSelect = async (meeting) => {
    console.log('Meeting selected:', meeting); // Debug log
    setSelectedMeetingId(meeting.id);
    setActiveTab('summary');

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

      // Use googleeventid for the API call (backend expects this field)
      const meetingIdentifier = selectedMeeting.googleeventid || selectedMeeting.id;
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
    try {
      // Always use template system - if no template selected, use Advicly Summary template
      let summary;
      if (selectedTemplate) {
        // Use the selected template's prompt
        const prompt = selectedTemplate.content.replace('{transcript}', selectedMeeting.transcript);
        summary = await generateAISummaryWithTemplate(selectedMeeting.transcript, prompt);
        setCurrentSummaryTemplate(selectedTemplate);
      } else {
        // Use Advicly Summary template (auto template) as default
        const autoTemplate = templates.find(t => t.id === 'auto-template') || templates[0];
        const prompt = autoTemplate.content.replace('{transcript}', selectedMeeting.transcript);
        summary = await generateAISummaryWithTemplate(selectedMeeting.transcript, prompt);
        setCurrentSummaryTemplate(autoTemplate);
      }

      setSummaryContent(summary);
      setEmailSummary(summary);

      // Save the new template version to database
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const templateId = selectedTemplate?.id || 'auto-template';
        await fetch(`${API_URL}/api/calendar/meetings/${selectedMeeting.id}/update-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            emailSummary: summary,
            templateId: templateId
          })
        });
      } catch (saveError) {
        console.error('Error saving template summary:', saveError);
      }

      setShowSnackbar(true);
      setSnackbarMessage(`AI summary generated using ${selectedTemplate?.title || 'Advicly Summary'}`);
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setShowSnackbar(true);
      setSnackbarMessage(error.message || 'Failed to generate AI summary');
      setSnackbarSeverity('error');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // New function to generate summary with custom template
  const generateAISummaryWithTemplate = async (transcript, prompt) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/calendar/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript,
          prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate AI summary with template');
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('Error generating AI summary with template:', error);
      throw error;
    }
  };

  // NOTE: Calendar sync is now handled automatically via webhooks
  // Manual sync buttons have been removed from the UI

  // Toggle annual review flag for a meeting
  const toggleAnnualReview = async (meetingId, currentValue) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const newValue = !currentValue;

      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/annual-review`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAnnualReview: newValue })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update annual review status');
      }

      // Update local state
      const updatedMeetings = {
        ...meetings,
        past: meetings.past.map(m =>
          m.id === meetingId ? { ...m, is_annual_review: newValue } : m
        ),
        future: meetings.future.map(m =>
          m.id === meetingId ? { ...m, is_annual_review: newValue } : m
        )
      };
      setMeetings(updatedMeetings);

      setShowSnackbar(true);
      setSnackbarMessage(newValue ? 'Meeting marked as Annual Review' : 'Annual Review flag removed');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error toggling annual review:', error);
      setShowSnackbar(true);
      setSnackbarMessage(error.message || 'Failed to update annual review status');
      setSnackbarSeverity('error');
    }
  };

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
                      selectedMeetingId === meeting.id && "bg-muted/50"
                    )}
                  >
                    <td className="p-3">
                      <div className="font-medium text-sm text-foreground line-clamp-2">
                        {meeting.quick_summary || meeting.detailed_summary || meeting.title || 'Untitled Meeting'}
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
                      <div className="flex items-center gap-2">
                        {getMeetingSource(meeting) === 'Google Calendar' ?
                          <GoogleIcon className="w-4 h-4" /> :
                          getMeetingSource(meeting) === 'Calendly' ?
                          <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                            <span className="text-white text-xs font-bold">C</span>
                          </div> :
                          <OutlookIcon className="w-4 h-4" />
                        }
                        <span className="text-xs text-muted-foreground">
                          {getMeetingSource(meeting) === 'Google Calendar' ? 'Google' :
                           getMeetingSource(meeting) === 'Calendly' ? 'Calendly' : 'Manual'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <div className={cn("w-3 h-3 rounded-full", meeting.transcript ? "bg-blue-500" : "bg-gray-300")} title={meeting.transcript ? "Transcript available" : "No transcript"}></div>
                        <div className={cn("w-3 h-3 rounded-full", (meeting.quick_summary || meeting.brief_summary) ? "bg-green-500" : "bg-gray-300")} title={(meeting.quick_summary || meeting.brief_summary) ? "AI summary available" : "No AI summary"}></div>
                        <div className={cn("w-3 h-3 rounded-full", meeting.email_summary_draft ? "bg-purple-500" : "bg-gray-300")} title={meeting.email_summary_draft ? "Email draft available" : "No email draft"}></div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEditMeeting(meeting, e)}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
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
        const isComplete = meeting.transcript && meeting.quick_summary && meeting.email_summary_draft;
        const hasPartialData = meeting.transcript || meeting.quick_summary || meeting.email_summary_draft;

        return (
          <Card
            key={meeting.id}
            onClick={() => handleMeetingSelect(meeting)}
            className={cn(
              "cursor-pointer hover:bg-muted/50 transition-colors relative border-l-4",
              // Selected state styling
              selectedMeetingId === meeting.id && "bg-muted/30 ring-1 ring-primary/30",
              // Status-based left border colors for quick visual identification
              isComplete ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/20" :
              hasPartialData ? "border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/20" :
              "border-l-gray-300 dark:border-l-gray-600"
            )}
          >
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              {/* Source Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getMeetingSource(meeting) === 'Google Calendar' ?
                  <GoogleIcon className="w-4 h-4" /> :
                  getMeetingSource(meeting) === 'Calendly' ?
                  <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs font-bold">C</span>
                  </div> :
                  <OutlookIcon className="w-4 h-4" />
                }
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-medium text-foreground line-clamp-1 break-words flex-1 min-w-0">
                    {meeting.quick_summary || meeting.detailed_summary || meeting.title || 'Untitled Meeting'}
                  </h3>

                  {/* Status Indicator */}
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0 mt-1",
                    isComplete ? "bg-green-500" :
                    hasPartialData ? "bg-yellow-500" :
                    "bg-gray-400"
                  )}></div>
                </div>

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

                  {/* Source Badge and Annual Review */}
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-medium",
                      getMeetingSource(meeting) === 'Google Calendar'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : getMeetingSource(meeting) === 'Calendly'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    )}>
                      {getMeetingSource(meeting) === 'Google Calendar' ? 'Google' :
                       getMeetingSource(meeting) === 'Calendly' ? 'Calendly' : 'Manual'}
                    </div>
                    {meeting.is_annual_review && (
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-medium">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        <span>Annual</span>
                      </div>
                    )}
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

                {/* Bottom Row: Status Indicators and Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Compact Status Indicators */}
                    <div className="flex items-center gap-1">
                      {/* Transcript Status */}
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full flex items-center justify-center",
                          meeting.transcript
                            ? "bg-blue-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                        title={meeting.transcript ? "Transcript available" : "No transcript"}
                      >
                        {meeting.transcript && <Check className="w-2 h-2 text-white" />}
                      </div>

                      {/* AI Summary Status */}
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full flex items-center justify-center",
                          (meeting.quick_summary || meeting.brief_summary)
                            ? "bg-green-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                        title={(meeting.quick_summary || meeting.brief_summary) ? "AI summary available" : "No AI summary"}
                      >
                        {(meeting.quick_summary || meeting.brief_summary) && <Check className="w-2 h-2 text-white" />}
                      </div>

                      {/* Email Draft Status */}
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full flex items-center justify-center",
                          meeting.email_summary_draft
                            ? "bg-purple-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                        title={meeting.email_summary_draft ? "Email draft available" : "No email draft"}
                      >
                        {meeting.email_summary_draft && <Check className="w-2 h-2 text-white" />}
                      </div>
                    </div>

                    {/* Attendee Avatars */}
                    <AttendeeAvatars
                      meeting={meeting}
                      currentUserEmail={user?.email}
                      maxVisible={2}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
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
        <div className="border-b border-border/50 p-6 bg-card/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Meetings
              </Button>
              <CreateMeetingDialog
                onMeetingCreated={(meeting) => {
                  // Refresh meetings after creation
                  fetchMeetings();
                  // Auto-select the new meeting
                  setSelectedMeetingId(meeting.id);
                }}
              />

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background">
                <Button
                  onClick={() => setViewMode('calendar')}
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <CalendarDays className="w-4 h-4" />
                  Calendar View
                </Button>
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  List View
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
            <div className="p-6">
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
            <div className="p-6">
              {/* Calendar Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-foreground">
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

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-4">
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
                            const source = getMeetingSource(meeting);

                            return (
                              <Card
                                key={meeting.id}
                                className="border-border/50 hover:border-primary/50 cursor-pointer transition-all hover:shadow-md"
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
                                    {meeting.quick_summary || meeting.detailed_summary || meeting.title || 'Untitled Meeting'}
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

                                  {/* Meeting Source Badge and Annual Review */}
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {source === 'Google Calendar' ? (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                                        <GoogleIcon className="w-3 h-3" />
                                        <span>Google</span>
                                      </div>
                                    ) : source === 'Calendly' ? (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs">
                                        <div className="w-3 h-3 bg-orange-500 rounded-sm flex items-center justify-center">
                                          <span className="text-white text-[8px] font-bold">C</span>
                                        </div>
                                        <span>Calendly</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 text-xs">
                                        <OutlookIcon className="w-3 h-3" />
                                        <span>Manual</span>
                                      </div>
                                    )}
                                    {meeting.is_annual_review && (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                        <span>Annual Review</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Completion Status Indicators */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {meeting.transcript && (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <FileText className="w-3 h-3" />
                                        <span className="text-xs">Transcript</span>
                                      </div>
                                    )}
                                    {meeting.quick_summary && (
                                      <div className="flex items-center gap-1 text-blue-600">
                                        <MessageSquare className="w-3 h-3" />
                                        <span className="text-xs">Summary</span>
                                      </div>
                                    )}
                                    {meeting.email_summary_draft && (
                                      <div className="flex items-center gap-1 text-purple-600">
                                        <Mail className="w-3 h-3" />
                                        <span className="text-xs">Email</span>
                                      </div>
                                    )}
                                    {meeting.action_points && (
                                      <div className="flex items-center gap-1 text-orange-600">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span className="text-xs">Actions</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Overall Complete Badge */}
                                  {isMeetingComplete(meeting) && (
                                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="text-xs font-medium">Complete</span>
                                    </div>
                                  )}
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
            <div className="sticky top-0 bg-background border-b border-border/50 p-6 flex-shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getMeetingSource(selectedMeeting) === 'Google Calendar' ?
                    <GoogleIcon className="w-4 h-4 flex-shrink-0" /> :
                    getMeetingSource(selectedMeeting) === 'Calendly' ?
                    <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">C</span>
                    </div> :
                    <OutlookIcon className="w-4 h-4 flex-shrink-0" />
                  }
                  <h1 className="text-base lg:text-lg font-bold text-foreground line-clamp-2 break-words">
                    {selectedMeeting.summary || selectedMeeting.title || 'Untitled Meeting'}
                  </h1>
                  {/* Meeting source badge */}
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getMeetingSource(selectedMeeting) === 'Google Calendar'
                      ? 'bg-blue-100 text-blue-800'
                      : getMeetingSource(selectedMeeting) === 'Calendly'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {getMeetingSource(selectedMeeting)}
                  </div>
                </div>

                {/* Client info display - Enhanced to show linked client or attendee with navigation */}
                {(() => {
                  // First, check if there's a linked client from the database
                  if (selectedMeeting.client) {
                    return (
                      <div
                        className="flex items-center mb-2 text-sm cursor-pointer hover:bg-primary/5 -mx-2 px-2 py-1 rounded transition-colors group"
                        onClick={() => {
                          // Navigate to Clients page with client parameter
                          window.location.href = `/clients?client=${encodeURIComponent(selectedMeeting.client.email)}`;
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

                  // Fallback to attendees if no linked client
                  if (selectedMeeting.attendees) {
                    try {
                      const attendees = JSON.parse(selectedMeeting.attendees);
                      const clientAttendee = attendees.find(a => a.email && a.email !== user?.email);
                      if (clientAttendee) {
                        return (
                          <div className="flex items-center mb-2 text-sm">
                            <Mail className="h-4 w-4 mr-2 text-muted-foreground/60" />
                            <span className="font-medium text-muted-foreground">{clientAttendee.displayName || clientAttendee.email.split('@')[0]}</span>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={selectedMeeting.is_annual_review ? "default" : "ghost"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAnnualReview(selectedMeeting.id, selectedMeeting.is_annual_review);
                        }}
                        className={cn(
                          "h-8 w-8 p-0",
                          selectedMeeting.is_annual_review && "bg-amber-500 hover:bg-amber-600 text-white"
                        )}
                        title={selectedMeeting.is_annual_review ? "Remove Annual Review flag" : "Mark as Annual Review"}
                      >
                        <Star className={cn(
                          "w-4 h-4",
                          selectedMeeting.is_annual_review && "fill-white"
                        )} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{selectedMeeting.is_annual_review ? "Remove Annual Review flag" : "Mark as Annual Review"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
              {/* Tabs */}
              <div className="flex border-b border-border/50 mb-4">
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    {selectedMeeting?.transcript ? (
                      <div className="space-y-4">
                        {/* Quick Summary Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Quick Summary</h3>
                            <div className="flex items-center gap-2">
                              {/* Enhanced Ask Advicly button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Extract comprehensive meeting context
                                  let clientInfo = null;
                                  if (selectedMeeting.attendees) {
                                    try {
                                      const attendees = typeof selectedMeeting.attendees === 'string'
                                        ? JSON.parse(selectedMeeting.attendees)
                                        : selectedMeeting.attendees;

                                      // Find first attendee that's not the current user
                                      const currentUserEmail = user?.email || '';
                                      const clientAttendee = attendees.find(a => a.email !== currentUserEmail);
                                      if (clientAttendee) {
                                        clientInfo = {
                                          name: clientAttendee.name || clientAttendee.email,
                                          email: clientAttendee.email
                                        };
                                      }
                                    } catch (e) {
                                      console.log('Could not parse attendees');
                                    }
                                  }

                                  const meetingTitle = selectedMeeting.summary || selectedMeeting.title || 'Meeting';
                                  const meetingDate = selectedMeeting.startTime || selectedMeeting.start || selectedMeeting.date;

                                  // Build enhanced URL parameters for meeting context
                                  const params = new URLSearchParams({
                                    contextType: 'meeting',
                                    meetingId: selectedMeeting.id,
                                    meetingTitle: meetingTitle,
                                    meetingDate: meetingDate,
                                    hasTranscript: (!!selectedMeeting.transcript).toString(),
                                    hasSummary: (!!selectedMeeting.quick_summary).toString()
                                  });

                                  if (clientInfo) {
                                    params.set('clientName', clientInfo.name);
                                    params.set('clientEmail', clientInfo.email);
                                  }

                                  navigate(`/ask-advicly?${params.toString()}`);
                                }}
                                className="h-8 px-3 text-xs"
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Ask About This Meeting
                              </Button>
                              {(quickSummary || emailSummary) && (
                                <Button
                                  onClick={() => autoGenerateSummaries(selectedMeeting.googleeventid || selectedMeeting.id, true)}
                                  disabled={autoGenerating}
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  {autoGenerating ? 'Regenerating...' : 'Regenerate'}
                                </Button>
                              )}
                            </div>
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
                              <Card className="border-orange-200 bg-orange-50/50">
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
                                    <Card key={item.id} className="border-orange-200 bg-orange-50/30 hover:shadow-sm transition-shadow">
                                      <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={selectedPendingItems.includes(item.id)}
                                            onChange={() => togglePendingItemSelection(item.id)}
                                            className="mt-1 w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500 cursor-pointer"
                                          />
                                          <div className="flex-1 space-y-2">
                                            {editingPendingItemId === item.id ? (
                                              // Edit mode
                                              <div className="space-y-2">
                                                <textarea
                                                  value={editingPendingText}
                                                  onChange={(e) => setEditingPendingText(e.target.value)}
                                                  className="w-full text-sm border border-orange-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                                    <Card className="border-orange-300 bg-orange-50/50">
                                      <CardContent className="p-3">
                                        <div className="space-y-2">
                                          <textarea
                                            value={newPendingItemText}
                                            onChange={(e) => setNewPendingItemText(e.target.value)}
                                            placeholder="Enter action item text..."
                                            className="w-full text-sm border border-orange-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            rows={2}
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
                                            <span className="text-xs text-muted-foreground">Priority:</span>
                                            <Select
                                              value={String(newPendingItemPriority)}
                                              onValueChange={(value) => setNewPendingItemPriority(parseInt(value))}
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
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              onClick={saveNewPendingItem}
                                              disabled={savingNewPendingItem}
                                              className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
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
                                              className="h-7 text-xs"
                                            >
                                              <X className="w-3 h-3 mr-1" />
                                              Cancel
                                            </Button>
                                            <span className="text-xs text-muted-foreground ml-2">
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
                                      className="w-full h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
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

                        {/* Email Summary Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Email Summary</h3>
                            {/* Generate Email Button - only show if transcript exists and no email draft */}
                            {selectedMeeting?.transcript && !selectedMeeting?.email_summary_draft && (
                              <Button
                                onClick={handleGenerateAISummary}
                                disabled={generatingSummary}
                                size="sm"
                                variant="default"
                                className="h-6 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                {generatingSummary ? 'Generating...' : 'Generate Email'}
                              </Button>
                            )}
                          </div>

                          {/* Template Selection - only show when generating or regenerating */}
                          {(generatingSummary || selectedMeeting?.email_summary_draft) && templates.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-medium text-muted-foreground">Template</h4>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-6 text-xs">
                                      {selectedTemplate ? selectedTemplate.title : 'Advicly Summary'}
                                      <ChevronDown className="w-3 h-3 ml-1" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    {templates.map((template) => (
                                      <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template)}
                                      >
                                        {template.title}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Apply Template Button - only show when template changed and email exists */}
                              {selectedTemplate && currentSummaryTemplate && selectedTemplate.id !== currentSummaryTemplate.id && selectedMeeting?.email_summary_draft && (
                                <Button
                                  onClick={handleGenerateAISummary}
                                  disabled={generatingSummary}
                                  size="sm"
                                  variant="default"
                                  className="h-6 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {generatingSummary ? 'Applying...' : 'Apply Template'}
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Email Summary Content */}
                          {(emailSummary || selectedMeeting?.email_summary_draft) ? (
                            <Card className="border-border/50">
                              <CardContent className="p-4">
                                {/* Client Information Header */}
                                {(() => {
                                  // Get client info from linked client or attendees
                                  let clientInfo = null;

                                  if (selectedMeeting.client) {
                                    clientInfo = {
                                      name: selectedMeeting.client.name || selectedMeeting.client.email.split('@')[0],
                                      email: selectedMeeting.client.email
                                    };
                                  } else if (selectedMeeting.attendees) {
                                    try {
                                      const attendees = JSON.parse(selectedMeeting.attendees);
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

                                  if (clientInfo) {
                                    return (
                                      <div className="mb-4 pb-4 border-b border-border/50">
                                        <div className="text-xs text-muted-foreground mb-1">To:</div>
                                        <div className="flex items-center gap-2">
                                          <Mail className="w-4 h-4 text-primary/60" />
                                          <div>
                                            <div className="font-medium text-sm text-foreground">{clientInfo.name}</div>
                                            <div className="text-xs text-muted-foreground">{clientInfo.email}</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Email Body */}
                                <div className="prose prose-sm max-w-none text-foreground">
                                  <div className="whitespace-pre-line text-sm">{emailSummary || selectedMeeting?.email_summary_draft}</div>
                                </div>
                              </CardContent>
                            </Card>
                          ) : autoGenerating ? (
                            <Card className="border-border/50">
                              <CardContent className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                  Generating email summary...
                                </div>
                              </CardContent>
                            </Card>
                          ) : null}
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
