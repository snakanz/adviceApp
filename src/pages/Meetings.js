import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { cn } from '../lib/utils';
import { 
  Calendar, 
  MoreVertical, 
  Copy, 
  Share, 
  Clock,
  Users,
  FileText,
  MessageSquare,
  Sparkles,
  Play,
  Pause,
  X
} from 'lucide-react';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary, generateAISummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';
import { api } from '../services/api';

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

const groupMeetingsByDate = (meetings) => {
  const grouped = {};
  meetings.forEach(meeting => {
    const dateKey = formatDate(meeting.start?.dateTime);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(meeting);
  });
  return grouped;
};

function getMeetingSource(meeting) {
  if (meeting.hangoutLink || meeting.conferenceData) return 'google';
  if (meeting.outlookEventId) return 'outlook';
  return 'default';
}

function formatMeetingTime(meeting) {
  if (!meeting?.start?.dateTime || !meeting?.end?.dateTime) return '';
  const start = new Date(meeting.start.dateTime);
  const end = new Date(meeting.end.dateTime);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderParticipants(meeting) {
  if (!meeting?.attendees || !Array.isArray(meeting.attendees)) return null;
  return meeting.attendees.slice(0, 3).map((att, idx) => (
    <div key={att.email || idx} className="relative" title={att.displayName || att.email}>
      <Avatar className={cn(
        "w-7 h-7 text-xs font-medium bg-accent text-accent-foreground border-2 border-card",
        idx > 0 && "-ml-2"
      )}>
        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">
          {att.displayName ? att.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : (att.email ? att.email[0].toUpperCase() : '?')}
        </AvatarFallback>
      </Avatar>
    </div>
  ));
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
  const [meetingView, setMeetingView] = useState('future');
  
  const selectedMeetingIdRef = useRef(null);
  selectedMeetingIdRef.current = selectedMeetingId;
  
  const [transcriptUpload, setTranscriptUpload] = useState('');
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  // Add state for UI mode
  const [showPasteTranscript, setShowPasteTranscript] = useState(false);
  const [deletingTranscript, setDeletingTranscript] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  console.log('Meetings component render:', { activeTab, selectedMeetingId });
  
  const selectedMeeting = React.useMemo(() => {
    return (
      meetings.past.find(m => m.id === selectedMeetingId) ||
      meetings.future.find(m => m.id === selectedMeetingId) ||
      null
    );
  }, [meetings, selectedMeetingId]);

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

  const handleMeetingSelect = (meeting) => {
    setSelectedMeetingId(meeting.id);
    setSummaryContent(meeting.meetingSummary || meeting.transcript || '');
    setActiveTab('summary');
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

  const handleCopyToClipboard = async () => {
    if (!summaryContent) return;
    
    try {
      await navigator.clipboard.writeText(summaryContent);
      setShowSnackbar(true);
      setSnackbarMessage('Summary copied to clipboard');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to copy to clipboard');
      setSnackbarSeverity('error');
    }
  };

  const handleTranscriptUpload = async () => {
    if (!selectedMeeting || !transcriptUpload.trim()) return;
    setUploadingTranscript(true);
    try {
      await api.uploadMeetingTranscript(selectedMeeting.id, transcriptUpload.trim());
      setShowSnackbar(true);
      setSnackbarMessage('Transcript uploaded successfully');
      setSnackbarSeverity('success');
      // Update the selected meeting's transcript in state
      setMeetings(prev => {
        const update = m => m.id === selectedMeeting.id ? { ...m, transcript: transcriptUpload.trim() } : m;
        return {
          ...prev,
          past: prev.past.map(update),
          future: prev.future.map(update)
        };
      });
      setTranscriptUpload('');
    } catch (err) {
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
    setUploadingTranscript(true);
    try {
      // Backend currently only supports text, so show a warning
      setShowSnackbar(true);
      setSnackbarMessage('Audio upload is not yet supported.');
      setSnackbarSeverity('warning');
    } finally {
      setUploadingTranscript(false);
      e.target.value = '';
    }
  };

  const handleDeleteTranscript = async () => {
    if (!selectedMeeting) return;
    
    setDeletingTranscript(true);
    try {
      const token = localStorage.getItem('jwt');
      let url;
      if (window.location.hostname === 'localhost') {
        url = `${API_URL}/api/dev/meetings/${selectedMeeting.id}/transcript`;
      } else {
        url = `${API_URL}/calendar/meetings/${selectedMeeting.id}/transcript`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete transcript');
      }
      
      // Update local state
      setMeetings(prev => ({
        ...prev,
        past: prev.past.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: null }
            : m
        ),
        future: prev.future.map(m => 
          m.id === selectedMeeting.id 
            ? { ...m, transcript: null }
            : m
        )
      }));
      
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
      const summary = await generateAISummary(selectedMeeting.transcript);
      setSummaryContent(summary);
      setShowSnackbar(true);
      setSnackbarMessage('AI summary generated successfully');
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

  const renderGroupedMeetings = (meetings, title, isPast = false) => {
    if (!meetings || meetings.length === 0) return null;
    
    const grouped = groupMeetingsByDate(meetings);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <span className="text-sm text-muted-foreground bg-accent px-2 py-1 rounded-full">
            {meetings.length}
          </span>
        </div>
        {Object.entries(grouped).map(([date, dayMeetings]) => (
          <div key={date} className="space-y-4">
            <h3 className="label text-xs font-medium tracking-wider uppercase text-muted-foreground">
              {date}
            </h3>
            <div className="space-y-3">
              {dayMeetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className={cn(
                    "cursor-pointer card-hover border-border/50",
                    selectedMeetingId === meeting.id && "ring-2 ring-primary/20 bg-primary/5 border-primary/30"
                  )}
                  onClick={() => handleMeetingSelect(meeting)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatMeetingTime(meeting)}</span>
                          </div>
                          {getMeetingSource(meeting) === 'google' && (
                            <GoogleIcon size={14} className="text-muted-foreground" />
                          )}
                          {getMeetingSource(meeting) === 'outlook' && (
                            <OutlookIcon size={14} className="text-muted-foreground" />
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground mb-2 line-clamp-2">
                          {meeting.summary || meeting.title || 'Untitled Meeting'}
                        </h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {meeting.attendees && meeting.attendees.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{meeting.attendees.length}</span>
                              </div>
                            )}
                            {meeting.meetingSummary && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>Summary</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {renderParticipants(meeting)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleCopyToClipboard}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Share className="w-4 h-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
    <div className="h-full flex bg-background">
      {/* Left Panel - Meeting List */}
      <div className="w-1/3 border-r border-border/50 overflow-y-auto bg-card/30">
        <div className="p-6">
          {/* View Toggle */}
          <div className="flex gap-2 mb-8">
            <Button
              variant={meetingView === 'future' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMeetingView('future')}
              className="flex-1"
            >
              <Play className="w-3 h-3 mr-2" />
              Upcoming
            </Button>
            <Button
              variant={meetingView === 'past' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMeetingView('past')}
              className="flex-1"
            >
              <Pause className="w-3 h-3 mr-2" />
              Past
            </Button>
          </div>

          {/* Meeting List */}
          {meetingView === 'future' 
            ? renderGroupedMeetings(meetings.future, 'Upcoming Meetings')
            : renderGroupedMeetings(meetings.past, 'Past Meetings', true)
          }
        </div>
      </div>

      {/* Right Panel - Meeting Details */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedMeeting ? (
          <>
            {/* Meeting Header */}
            <div className="border-b border-border/50 p-6 bg-card/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatDate(selectedMeeting.start?.dateTime)}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-3">
                    {selectedMeeting.summary || selectedMeeting.title || 'Untitled Meeting'}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatMeetingTime(selectedMeeting)}</span>
                    </div>
                    {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{selectedMeeting.attendees.length} attendees</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm">
                    <Share className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setShowAIDialog(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Adjust
                  </Button>
                </div>
              </div>
            </div>

            {/* Meeting Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {/* Tabs */}
                <div className="flex gap-4 justify-between mb-8">
                  <button
                    className={cn(
                      "tab-btn",
                      activeTab === 'summary' && "active"
                    )}
                    onClick={() => setActiveTab('summary')}
                  >
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Summary
                  </button>
                  <button
                    className={cn(
                      "tab-btn",
                      activeTab === 'transcript' && "active"
                    )}
                    onClick={() => setActiveTab('transcript')}
                  >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Transcript
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-6">
                  {activeTab === 'summary' && (
                    <Card className="border-border/50">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            AI-Generated Summary
                          </CardTitle>
                          {summaryContent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSummaryContent(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {summaryContent ? (
                          <div className="prose prose-invert max-w-none">
                            <div className="bg-card/50 border border-border/50 rounded-lg p-6">
                              <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                                {summaryContent}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No summary available</h3>
                            <p className="text-muted-foreground mb-4">This meeting doesn't have a summary yet.</p>
                            {selectedMeeting?.transcript && (
                              <Button
                                onClick={handleGenerateAISummary}
                                disabled={generatingSummary}
                                className="flex items-center gap-2"
                              >
                                <Sparkles className="w-4 h-4" />
                                {generatingSummary ? 'Generating...' : 'Generate AI Summary'}
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {activeTab === 'transcript' && (
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          Transcript
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedMeeting.transcript ? (
                          <div className="relative bg-card/50 border border-border/50 rounded-lg p-6 whitespace-pre-wrap text-foreground leading-relaxed">
                            <button
                              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive rounded-full p-1"
                              onClick={handleDeleteTranscript}
                              disabled={deletingTranscript}
                              aria-label="Delete transcript"
                            >
                              ×
                            </button>
                            {selectedMeeting.transcript}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8">
                            <h3 className="text-lg font-medium text-foreground mb-2">Add a transcript</h3>
                            <p className="text-muted-foreground mb-4">Advicly creates transcripts from audio or text</p>
                            <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full max-w-lg">
                              <Button variant="outline" className="flex-1" disabled>
                                <span className="mr-2">🎤</span> Start recording
                              </Button>
                              <label className="flex-1">
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={handleAudioFileChange}
                                  disabled={uploadingTranscript}
                                />
                                <Button asChild variant="outline" className="w-full">
                                  <span><span className="mr-2">📁</span> Upload audio</span>
                                </Button>
                              </label>
                              <Button
                                variant={showPasteTranscript ? "default" : "outline"}
                                className="flex-1"
                                onClick={() => setShowPasteTranscript(v => !v)}
                              >
                                <span className="mr-2">✏️</span> Paste transcript
                              </Button>
                            </div>
                            {showPasteTranscript && (
                              <div className="w-full max-w-lg flex flex-col gap-2">
                                <textarea
                                  className="w-full min-h-[120px] p-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                                  placeholder="Paste transcript here..."
                                  value={transcriptUpload || ''}
                                  onChange={e => setTranscriptUpload(e.target.value)}
                                  disabled={uploadingTranscript}
                                />
                                <Button
                                  onClick={handleTranscriptUpload}
                                  disabled={!transcriptUpload?.trim() || uploadingTranscript}
                                  className="w-full"
                                >
                                  {uploadingTranscript ? 'Uploading...' : 'Upload Transcript'}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No meeting selected</h3>
              <p className="text-muted-foreground">Select a meeting from the list to view its details.</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Adjustment Dialog */}
      <AIAdjustmentDialog
        open={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onAdjust={handleAIAdjustment}
      />

      {/* Snackbar */}
      {showSnackbar && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className={cn(
            "px-4 py-3 rounded-lg shadow-large text-white",
            snackbarSeverity === 'success' && "bg-primary",
            snackbarSeverity === 'error' && "bg-destructive",
            snackbarSeverity === 'warning' && "bg-yellow-600"
          )}>
            {snackbarMessage}
          </div>
        </div>
      )}
    </div>
  );
} 