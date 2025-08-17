import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Edit3
} from 'lucide-react';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';

const API_URL = process.env.REACT_APP_API_URL;

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
  if (meeting.attendees?.some(a => a.email?.includes('google'))) return 'google';
  if (meeting.attendees?.some(a => a.email?.includes('outlook'))) return 'outlook';
  return 'google'; // default
}

function formatMeetingTime(meeting) {
  const start = new Date(meeting.start?.dateTime || meeting.startTime);
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
  const { isAuthenticated } = useAuth();
  const [meetingView, setMeetingView] = useState('today');
  
  const selectedMeetingIdRef = useRef(null);
  selectedMeetingIdRef.current = selectedMeetingId;
  
  const [transcriptUpload, setTranscriptUpload] = useState('');
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [showPasteTranscript, setShowPasteTranscript] = useState(false);
  const [deletingTranscript, setDeletingTranscript] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Add template selection state
  const [templates, setTemplates] = useState(loadTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentSummaryTemplate, setCurrentSummaryTemplate] = useState(null);

  // Add new state for auto-generated summaries
  const [quickSummary, setQuickSummary] = useState('');
  const [emailSummary, setEmailSummary] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);

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
      setSelectedTemplate(loadedTemplates[0]);
    }
  }, []);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jwt');
      let url;
      if (window.location.hostname === 'localhost') {
        url = `${API_URL}/api/dev/meetings`;
      } else {
        url = `${API_URL}/calendar/meetings/all`;
      }
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
      let meetingsData = data;
      if (window.location.hostname === 'localhost') {
        const now = new Date();
        meetingsData = { past: [], future: [] };
        data.forEach(m => {
          const start = new Date(m.startTime);
          if (start < now) meetingsData.past.push({ ...m, id: m.googleEventId });
          else meetingsData.future.push({ ...m, id: m.googleEventId });
        });
      }
      setMeetings(meetingsData);
      if (selectedMeetingIdRef.current === null) {
        if (meetingsData.past.length > 0) {
          setSelectedMeetingId(meetingsData.past[0].id);
          setSummaryContent(meetingsData.past[0].meetingSummary);
        } else if (meetingsData.future.length > 0) {
          setSelectedMeetingId(meetingsData.future[0].id);
          setSummaryContent(meetingsData.future[0].meetingSummary);
        }
      }
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

  const handleMeetingSelect = async (meeting) => {
    setSelectedMeetingId(meeting.id);
    setActiveTab('summary');

    // Set existing summaries if available
    setQuickSummary(meeting.quickSummary || '');
    setEmailSummary(meeting.emailSummary || '');
    setSummaryContent(meeting.emailSummary || meeting.meetingSummary || '');

    // Set template info
    if (meeting.templateId) {
      const template = templates.find(t => t.id === meeting.templateId);
      setCurrentSummaryTemplate(template);
      setSelectedTemplate(template);
    } else {
      setCurrentSummaryTemplate(null);
      setSelectedTemplate(null);
    }

    // Auto-generate summaries if transcript exists but summaries don't
    if (meeting.transcript && (!meeting.quickSummary || !meeting.emailSummary)) {
      await autoGenerateSummaries(meeting.id);
    }
  };

  const autoGenerateSummaries = async (meetingId, forceRegenerate = false) => {
    setAutoGenerating(true);
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/calendar/meetings/${meetingId}/auto-generate-summaries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ forceRegenerate })
      });

      if (!response.ok) {
        throw new Error('Failed to auto-generate summaries');
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
      setSnackbarMessage('Failed to generate summaries');
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
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`${API_URL}/calendar/meetings/${selectedMeeting.id}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript: transcriptUpload.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to upload transcript');
      
      // Update local state
      const updatedMeetings = {
        ...meetings,
        past: meetings.past.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: transcriptUpload.trim() }
            : m
        ),
        future: meetings.future.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: transcriptUpload.trim() }
            : m
        )
      };
      setMeetings(updatedMeetings);
      
      setTranscriptUpload('');
      setShowPasteTranscript(false);
      setShowSnackbar(true);
      setSnackbarMessage('Transcript uploaded successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error uploading transcript:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to upload transcript');
      setSnackbarSeverity('error');
    } finally {
      setUploadingTranscript(false);
    }
  };

  const handleAudioFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // For now, just show a message that audio upload is not implemented
    setShowSnackbar(true);
    setSnackbarMessage('Audio upload is not yet implemented');
    setSnackbarSeverity('warning');
  };

  const handleDeleteTranscript = async () => {
    if (!selectedMeeting) return;
    
    setDeletingTranscript(true);
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`${API_URL}/calendar/meetings/${selectedMeeting.id}/transcript`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to delete transcript');
      
      // Update local state
      const updatedMeetings = {
        ...meetings,
        past: meetings.past.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: null }
            : m
        ),
        future: meetings.future.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: null }
            : m
        )
      };
      setMeetings(updatedMeetings);
      
      setShowSnackbar(true);
      setSnackbarMessage('Transcript deleted successfully');
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
      setShowSnackbar(true);
      setSnackbarMessage(`AI summary generated using ${selectedTemplate?.title || 'Advicly Summary'}`);
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to generate AI summary');
      setSnackbarSeverity('error');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // New function to generate summary with custom template
  const generateAISummaryWithTemplate = async (transcript, prompt) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/calendar/generate-summary`, {
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
        throw new Error('Failed to generate AI summary with template');
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('Error generating AI summary with template:', error);
      throw error;
    }
  };

  const renderMeetingsList = (meetings, title) => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {meetings.map((meeting) => (
        <Card
          key={meeting.id}
          onClick={() => handleMeetingSelect(meeting)}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getMeetingSource(meeting) === 'google' ? 
                  <GoogleIcon className="w-5 h-5" /> : 
                  <OutlookIcon className="w-5 h-5" />
                }
                <h3 className="text-lg font-medium text-foreground">
                  {meeting.summary || meeting.title || 'Untitled Meeting'}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(meeting.start?.dateTime || meeting.startTime)}</span>
                <span>•</span>
                <Clock className="w-4 h-4" />
                <span>
                  {formatMeetingTime(meeting)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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
          <h1 className="text-2xl font-bold text-foreground mb-4">Meetings</h1>

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
                  const meetingDate = new Date(meeting.start?.dateTime || meeting.startTime);
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
      {selectedMeeting && (
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
                  <span>{formatDate(selectedMeeting.start?.dateTime || selectedMeeting.startTime)}</span>
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
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    {selectedMeeting?.transcript ? (
                      <>
                        {/* Quick Summary Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Quick Summary</h3>
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
                          {quickSummary ? (
                            <Card className="border-border/50">
                              <CardContent className="p-3">
                                <div className="text-sm text-foreground whitespace-pre-line">
                                  {quickSummary}
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
                                      {selectedTemplate ? selectedTemplate.title : 'Auto'}
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
                          {emailSummary ? (
                            <Card className="border-border/50">
                              <CardContent className="p-4">
                                <div className="prose prose-sm max-w-none text-foreground">
                                  <div className="whitespace-pre-line text-sm">{emailSummary}</div>
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
                      </>
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
                    {/* Transcript Actions */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPasteTranscript(!showPasteTranscript)}
                          className="h-7 px-2 text-xs"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Paste
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('fileInput')?.click()}
                          className="h-7 px-2 text-xs"
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Upload
                        </Button>
                      </div>
                    </div>

                    {/* File Upload Input */}
                    <input
                      id="fileInput"
                      type="file"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={handleAudioFileChange}
                      className="hidden"
                    />

                    {/* Paste Transcript */}
                    {showPasteTranscript && (
                      <div className="space-y-2">
                        <textarea
                          value={transcriptUpload}
                          onChange={(e) => setTranscriptUpload(e.target.value)}
                          placeholder="Paste your transcript here..."
                          className="w-full h-24 p-2 text-sm border border-border/50 rounded-lg bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleTranscriptUpload}
                            disabled={!transcriptUpload.trim() || uploadingTranscript}
                            size="sm"
                            className="h-7 px-3 text-xs"
                          >
                            {uploadingTranscript ? 'Uploading...' : 'Upload'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowPasteTranscript(false);
                              setTranscriptUpload('');
                            }}
                            className="h-7 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Transcript Content */}
                    {selectedMeeting?.transcript ? (
                      <Card className="border-border/50">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-foreground">Uploaded Transcript</h3>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDeleteTranscript}
                              disabled={deletingTranscript}
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingTranscript ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                          <div className="prose prose-sm max-w-none text-foreground">
                            <div className="whitespace-pre-line">{selectedMeeting.transcript}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-border/50">
                        <CardContent className="p-6 text-center">
                          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">No transcript available</h3>
                          <p className="text-muted-foreground">Upload a transcript to generate AI summaries.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
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