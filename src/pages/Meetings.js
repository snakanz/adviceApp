import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  RefreshCw
} from 'lucide-react';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

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
  try {
    // Handle both array and JSON string formats
    let attendees = meeting.attendees;
    if (typeof attendees === 'string') {
      attendees = JSON.parse(attendees);
    }
    if (Array.isArray(attendees)) {
      if (attendees.some(a => a.email?.includes('google'))) return 'google';
      if (attendees.some(a => a.email?.includes('outlook'))) return 'outlook';
    }
  } catch (e) {
    console.log('Could not parse attendees for meeting source detection');
  }
  return 'google'; // default
}

function formatMeetingTime(meeting) {
  const start = new Date(meeting.start?.dateTime || meeting.startTime || meeting.starttime);
  return start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
  const [meetingView, setMeetingView] = useState('past');
  
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

  // Add calendar sync state
  const [syncing, setSyncing] = useState(false);

  console.log('Meetings component render:', { activeTab, selectedMeetingId });
  
  const selectedMeeting = React.useMemo(() => {
    return (
      meetings.past.find(m => m.id === selectedMeetingId) ||
      meetings.future.find(m => m.id === selectedMeetingId) ||
      null
    );
  }, [meetings, selectedMeetingId]);

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
      const token = localStorage.getItem('jwt');
      // 🔥 FIXED: Always use the database endpoint (dev/meetings) for both localhost and production
      const url = `${API_URL}/api/dev/meetings`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          const errorData = await res.json();
          if (errorData.error && errorData.error.includes('Google Calendar')) {
            setShowSnackbar(true);
            setSnackbarMessage('Google Calendar connection issue. Please reconnect your Google account.');
            setSnackbarSeverity('warning');
          }
        }
        throw new Error('Failed to fetch meetings');
      }
      const data = await res.json();
      console.log('Raw meetings data from API:', data); // Debug log

      // 🔥 FIXED: Handle database format (starttime, googleeventid)
      const now = new Date();
      const meetingsData = { past: [], future: [] };
      data.forEach(m => {
        // Handle both database format and API format
        const startTime = m.starttime || m.startTime;
        const googleEventId = m.googleeventid || m.googleEventId;

        if (startTime) {
          const start = new Date(startTime);
          const meetingData = {
            ...m,
            id: googleEventId,
            startTime: startTime, // Ensure consistent naming
            googleEventId: googleEventId
          };

          if (start < now) {
            meetingsData.past.push(meetingData);
          } else {
            meetingsData.future.push(meetingData);
          }
        }
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
      console.error('Error fetching meetings:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to load meetings');
      setSnackbarSeverity('error');
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
      await autoGenerateSummaries(meeting.id);
    }
  };

  const autoGenerateSummaries = async (meetingId, forceRegenerate = false) => {
    setAutoGenerating(true);
    try {
      const token = localStorage.getItem('jwt');
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

      // Update template info
      const template = templates.find(t => t.id === data.templateId);
      setCurrentSummaryTemplate(template);
      setSelectedTemplate(template);

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
      const token = localStorage.getItem('jwt');

      // Show generating summaries state after a brief delay
      setTimeout(() => {
        if (uploadingTranscript) {
          setGeneratingAISummaries(true);
        }
      }, 1000);

      const res = await fetch(`${API_URL}/api/calendar/meetings/${selectedMeeting.id}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript: transcriptUpload.trim() })
      });

      if (!res.ok) throw new Error('Failed to upload transcript');

      const responseData = await res.json();

      // Update local state with transcript and any auto-generated summaries
      const meetingUpdate = {
        transcript: transcriptUpload.trim()
      };

      // If summaries were auto-generated, include them
      if (responseData.summaries) {
        meetingUpdate.quick_summary = responseData.summaries.quickSummary;
        meetingUpdate.email_summary_draft = responseData.summaries.emailSummary;

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
      const token = localStorage.getItem('jwt');
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
        const token = localStorage.getItem('jwt');
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
      const token = localStorage.getItem('jwt');
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

  // Calendar sync function - simplified to just refresh meetings
  const syncCalendar = async () => {
    setSyncing(true);
    try {
      // Just refresh the meetings from the existing endpoint
      await fetchMeetings();

      setShowSnackbar(true);
      setSnackbarMessage('Calendar refreshed successfully!');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error refreshing calendar:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to refresh calendar');
      setSnackbarSeverity('error');
    } finally {
      setSyncing(false);
    }
  };

  const renderMeetingsList = (meetings, title) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {meetings.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Complete</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Partial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Needs Transcript</span>
            </div>
          </div>
        )}
      </div>
      {meetings.map((meeting) => {
        const isComplete = meeting.transcript && meeting.quick_summary && meeting.email_summary_draft;
        const hasPartialData = meeting.transcript || meeting.quick_summary || meeting.email_summary_draft;

        return (
          <Card
            key={meeting.id}
            onClick={() => handleMeetingSelect(meeting)}
            className={cn(
              "cursor-pointer hover:bg-muted/50 transition-colors min-h-[80px] relative",
              // Selected state styling
              selectedMeetingId === meeting.id && "bg-muted/30 ring-2 ring-primary/20",
              // Status-based border colors
              isComplete ? "border-green-200 dark:border-green-800" :
              hasPartialData ? "border-yellow-200 dark:border-yellow-800" :
              "border-gray-200 dark:border-gray-700 opacity-75"
            )}
          >
            {/* Completion Status Indicator */}
            <div className={cn(
              "absolute top-2 right-2 w-3 h-3 rounded-full",
              isComplete ? "bg-green-500" :
              hasPartialData ? "bg-yellow-500" :
              "bg-gray-400"
            )}></div>
          <CardContent className="p-4 h-full">
            <div className="flex items-center justify-between h-full min-h-[48px]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getMeetingSource(meeting) === 'google' ?
                    <GoogleIcon className="w-5 h-5" /> :
                    <OutlookIcon className="w-5 h-5" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-foreground truncate">
                    {meeting.summary || meeting.title || 'Untitled Meeting'}
                  </h3>
                  {/* Completion Status Indicators */}
                  <div className="flex items-center gap-2 mt-2">
                    {meeting.transcript && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/20 rounded-full border border-blue-200 dark:border-blue-800">
                        <Check className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Transcript</span>
                      </div>
                    )}
                    {(meeting.quick_summary || meeting.brief_summary) && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950/20 rounded-full border border-green-200 dark:border-green-800">
                        <Check className="w-3 h-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">AI Summary</span>
                      </div>
                    )}
                    {meeting.email_summary_draft && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-950/20 rounded-full border border-purple-200 dark:border-purple-800">
                        <Check className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Email Draft</span>
                      </div>
                    )}
                    {/* Show incomplete status for meetings without data */}
                    {!meeting.transcript && !meeting.quick_summary && !meeting.email_summary_draft && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700">
                        <div className="w-3 h-3 rounded-full border-2 border-gray-400"></div>
                        <span className="text-xs font-medium text-gray-500">Needs Transcript</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground flex-shrink-0 ml-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(meeting.start?.dateTime || meeting.startTime || meeting.starttime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {formatMeetingTime(meeting)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );

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
    <div className="h-full flex bg-background">
      {/* Left Panel - Meetings List */}
      <div className={cn(
        "flex flex-col bg-background border-r border-border/50 transition-all duration-300",
        selectedMeeting ? "w-1/2" : "w-full"
      )}>
        {/* Header */}
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
            <Button
              onClick={syncCalendar}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? 'Syncing...' : 'Sync Calendar'}
            </Button>
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

          {/* Segmented Control */}
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
        </div>

        {/* Meetings List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
          {meetingView === 'past' && (
            <div className="space-y-6">
              {meetings.past.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No past meetings</h3>
                  <p className="text-muted-foreground">You don't have any past meetings.</p>
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
        </div>
      </div>

      {/* Right Panel - Meeting Details */}
      {selectedMeeting ? (
        <div className="w-1/2 bg-card border-l border-border/50 flex flex-col">
          {/* Header */}
          <div className="border-b border-border/50 p-4 bg-card/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getMeetingSource(selectedMeeting) === 'google' ?
                    <GoogleIcon className="w-4 h-4" /> :
                    <OutlookIcon className="w-4 h-4" />
                  }
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {selectedMeeting.summary || selectedMeeting.title || 'Untitled Meeting'}
                  </h1>
                </div>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMeetingId(null)}
                className="ml-2 h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>
          </div>

          {/* Meeting Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
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
                                  onClick={() => autoGenerateSummaries(selectedMeeting.id, true)}
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

                        {/* Email Summary Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Email Summary</h3>
                          </div>

                          {/* Template Selection */}
                          {templates.length > 0 && (
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

                              {/* Apply Button - only show when template changed */}
                              {selectedTemplate && currentSummaryTemplate && selectedTemplate.id !== currentSummaryTemplate.id && (
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
      ) : (
        /* Default State - No Meeting Selected */
        <div className="w-1/2 bg-card border-l border-border/50 flex flex-col items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Select a meeting to view details</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Choose a meeting from the list to view its transcript, AI summaries, and email drafts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Adjustment Dialog */}
      <AIAdjustmentDialog
        isOpen={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onAdjust={handleAIAdjustment}
        currentSummary={summaryContent}
      />

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
