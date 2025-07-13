import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
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
  FileText
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
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderParticipants(meeting) {
  if (!meeting?.attendees || !Array.isArray(meeting.attendees)) return null;
  return meeting.attendees.slice(0, 3).map((att, idx) => (
    <div key={att.email || idx} className="relative" title={att.displayName || att.email}>
      <Avatar className={cn(
        "w-8 h-8 text-sm font-medium bg-gray-100 text-gray-700 border-2 border-white",
        idx > 0 && "-ml-1"
      )}>
        <AvatarFallback className="bg-gray-100 text-gray-700 text-sm font-medium">
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

  const renderGroupedMeetings = (meetings, title, isPast = false) => {
    if (!meetings || meetings.length === 0) return null;
    
    const grouped = groupMeetingsByDate(meetings);
    
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {Object.entries(grouped).map(([date, dayMeetings]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {date}
            </h3>
            <div className="space-y-2">
              {dayMeetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-md",
                    selectedMeetingId === meeting.id && "ring-2 ring-blue-500 bg-blue-50"
                  )}
                  onClick={() => handleMeetingSelect(meeting)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {formatMeetingTime(meeting)}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1 truncate">
                          {meeting.summary || meeting.title || 'Untitled Meeting'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {meeting.attendees && meeting.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{meeting.attendees.length} attendees</span>
                            </div>
                          )}
                          {getMeetingSource(meeting) === 'google' && (
                            <GoogleIcon size={16} />
                          )}
                          {getMeetingSource(meeting) === 'outlook' && (
                            <OutlookIcon size={16} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderParticipants(meeting)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Meeting List */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
        <div className="p-6">
          {/* View Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={meetingView === 'future' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMeetingView('future')}
            >
              Upcoming
            </Button>
            <Button
              variant={meetingView === 'past' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMeetingView('past')}
            >
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
      <div className="flex-1 flex flex-col">
        {selectedMeeting ? (
          <>
            {/* Meeting Header */}
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedMeeting.summary || selectedMeeting.title || 'Untitled Meeting'}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatMeetingTime(selectedMeeting)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(selectedMeeting.start?.dateTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm">
                    <Share className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Meeting Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                  <button
                    className={cn(
                      "pb-2 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === 'summary'
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                    onClick={() => setActiveTab('summary')}
                  >
                    Summary
                  </button>
                  <button
                    className={cn(
                      "pb-2 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === 'transcript'
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                    onClick={() => setActiveTab('transcript')}
                  >
                    Transcript
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {activeTab === 'summary' && (
                    <div className="prose max-w-none">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        {summaryContent ? (
                          <div className="whitespace-pre-wrap text-gray-700">
                            {summaryContent}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">
                            No summary available for this meeting.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'transcript' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="text-gray-500 italic">
                        Transcript view coming soon...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No meeting selected</h3>
              <p className="text-gray-500">Select a meeting from the list to view its details.</p>
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