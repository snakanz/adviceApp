import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Snackbar, Alert, CircularProgress, Card, Stack,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem,
  IconButton
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MicIcon from '@mui/icons-material/Mic';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';
import ShareIcon from '@mui/icons-material/Share';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import AttachFileIcon from '@mui/icons-material/AttachFile';

const API_URL = process.env.REACT_APP_API_URL;

const formatDateTime = (dateTimeStr) => {
  const date = new Date(dateTimeStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

// Helper to determine meeting source
function getMeetingSource(meeting) {
  if (meeting.hangoutLink || meeting.conferenceData) return 'google';
  if (meeting.outlookEventId) return 'outlook'; // Example field for Outlook
  return 'default';
}

// Helper to format meeting time range
function formatMeetingTime(meeting) {
  if (!meeting?.start?.dateTime || !meeting?.end?.dateTime) return '';
  const start = new Date(meeting.start.dateTime);
  const end = new Date(meeting.end.dateTime);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Helper to render participant avatars/initials
function renderParticipants(meeting) {
  if (!meeting?.attendees || !Array.isArray(meeting.attendees)) return null;
  return meeting.attendees.slice(0, 3).map((att, idx) => (
    <Tooltip title={att.displayName || att.email} key={att.email || idx}>
      <Avatar sx={{ width: 32, height: 32, fontSize: 14, ml: idx > 0 ? -1 : 0, bgcolor: '#f3f4f6', color: '#222', border: '2px solid #fff' }}>
        {att.displayName ? att.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : (att.email ? att.email[0].toUpperCase() : '?')}
      </Avatar>
    </Tooltip>
  ));
}

const defaultTemplates = [
  {
    id: 'intro',
    title: 'Intro Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting with me today. Here's a summary of our discussion and next steps.\n\nKey Points:\n- Your current financial situation\n- Your goals and priorities\n- Next steps for our engagement\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'cashflow',
    title: 'Cashflow Meeting',
    content: `Dear [Client Name],\n\nThank you for our recent meeting to review your cashflow.\n\nKey Points:\n- Income and expenses overview\n- Budgeting and savings opportunities\n- Action items for next steps\n\nLet me know if you need clarification on any points.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'performance',
    title: 'Performance Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting to review your portfolio performance.\n\nKey Points:\n- Portfolio returns and allocation\n- Market commentary\n- Recommendations and next steps\n\nPlease reach out if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'signup',
    title: 'Signup Meeting',
    content: `Dear [Client Name],\n\nCongratulations on taking the next step! Here's a summary of your signup meeting.\n\nKey Points:\n- Services agreed upon\n- Documentation required\n- Next steps for onboarding\n\nWe look forward to working with you.\n\nBest regards,\n[Your Name]`,
  },
];

function loadTemplates() {
  const saved = localStorage.getItem('advicly_templates');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultTemplates;
    }
  }
  return defaultTemplates;
}

// Helper to determine if a summary is real (not just the title or a placeholder)
function isRealSummary(summary, meeting) {
  if (!summary || summary.trim() === '') return false;
  const title = meeting?.summary || meeting?.title || '';
  if (summary.trim() === title.trim()) return false;
  if (summary.trim().toLowerCase().includes('untitled meeting')) return false;
  return true;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState({ future: [], past: [] });
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [openPasteDialog, setOpenPasteDialog] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [summaryContent, setSummaryContent] = useState(null);
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const { isAuthenticated } = useAuth();
  const [meetingView, setMeetingView] = useState('future'); // 'future' or 'past'
  
  // Remove showEmailSummaryUI state
  // const [showEmailSummaryUI, setShowEmailSummaryUI] = useState(false);
  
  // Use ref to access current selectedMeetingId without triggering dependencies
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

  // Move fetchMeetings out of useEffect so it can be called directly
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
          // Check if it's a Google Calendar connection issue
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
      // Only set selectedMeetingId if it is null (initial load)
      if (selectedMeetingIdRef.current === null) {
        if (meetingsData.past.length > 0) {
          setSelectedMeetingId(meetingsData.past[0].id);
          setSummaryContent(meetingsData.past[0].meetingSummary);
        } else if (meetingsData.future.length > 0) {
          setSelectedMeetingId(meetingsData.future[0].id);
          setSummaryContent(meetingsData.future[0].meetingSummary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Remove selectedMeetingId dependency to prevent unnecessary API calls

  // Only fetch meetings on initial load or when syncing
  useEffect(() => {
    if (isAuthenticated) fetchMeetings();
  }, [isAuthenticated, fetchMeetings]);

  // Update handleMeetingSelect to reset activeTab only when a new meeting is selected
  const handleMeetingSelect = (meeting) => {
    if (meeting.id !== selectedMeetingId) {
      setSelectedMeetingId(meeting.id);
      // Set appropriate default tab based on meeting type
      const isPast = meetings.past.some(m => m.id === meeting.id);
      if (isPast) {
        setActiveTab('summary');
        setSummaryContent(meeting.meetingSummary || meeting.summary);
      } else {
        // For future meetings, we don't need to set activeTab since we only show Meeting Prep
        setSummaryContent(null);
      }
    }
  };

  const isPastMeeting = meetings.past.some(m => m.id === selectedMeetingId);

  const handleAIAdjustment = async (adjustmentPrompt) => {
    setLoading(true);
    try {
      const originalSummary = JSON.stringify(summaryContent);
      const adjustedSummary = await adjustMeetingSummary(originalSummary, adjustmentPrompt);
      const newSummary = JSON.parse(adjustedSummary);
      setSummaryContent(newSummary);
      setShowAIDialog(false);
      setShowSnackbar(true);
      setSnackbarMessage('Meeting summary updated successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Failed to adjust summary:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to update meeting summary. Please try again.');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
    }
  };



  const handleStartRecording = () => {
    // Implementation of handleStartRecording
  };

  const handleAudioFileChange = (e) => {
    // Implementation of handleAudioFileChange
  };

  const handleUploadAudioSubmit = () => {
    // Implementation of handleUploadAudioSubmit
  };

  const handlePasteTranscriptSubmit = async () => {
    console.log("Uploading transcript", pastedTranscript, selectedMeetingId);
    if (!pastedTranscript.trim()) return;
    try {
      const res = await fetch(`${API_URL}/calendar/meetings/${selectedMeetingId}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({ transcript: pastedTranscript, clientId: selectedMeeting?.clientId })
      });
      if (!res.ok) throw new Error('Failed to save transcript');
      // Refetch meetings from backend to get updated hasTranscript/summary
      await fetchMeetings();
      setSelectedMeetingId(selectedMeetingId); // Force re-select to update UI
      setOpenPasteDialog(false);
      setShowSnackbar(true);
      setSnackbarMessage('Transcript uploaded successfully');
      setSnackbarSeverity('success');
    } catch (err) {
      setShowSnackbar(true);
      setSnackbarMessage('Failed to upload transcript');
      setSnackbarSeverity('error');
    }
  };

  // Handler for generating the AI summary (used for initial summary generation)
  const handleAutoGenerateSummary = async () => {
    if (!selectedMeeting?.transcript) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/calendar/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({
          transcript: selectedMeeting.transcript
        })
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();
      setSummaryContent(data.summary || '');
      setShowSnackbar(true);
      setSnackbarMessage('Summary generated successfully!');
      setSnackbarSeverity('success');
      await fetchMeetings();
    } catch (err) {
      setShowSnackbar(true);
      setSnackbarMessage('Error generating summary.');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  // Update renderGroupedMeetings to show icons and improved styling
  const renderGroupedMeetings = (meetings, title, isPast = false) => {
    const grouped = groupMeetingsByDate(meetings);
    return (
      <Stack spacing={2}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#999999', 
            fontWeight: 600, 
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          {title}
        </Typography>
        {Object.keys(grouped).length === 0 ? (
          <Typography variant="body2" sx={{ color: '#999999', py: 2 }}>
            {isPast ? 'No past meetings in last 2 weeks' : 'No upcoming meetings'}
          </Typography>
        ) : (
          Object.entries(grouped).map(([date, dateMeetings]) => (
            <Box key={date}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#666666', 
                  fontWeight: 500, 
                  fontSize: '11px',
                  display: 'block',
                  mb: 1
                }}
              >
                {date}
              </Typography>
              <Stack spacing={1}>
                {dateMeetings.map((meeting) => {
                  const selected = meeting.id === selectedMeetingId;
                  const source = getMeetingSource(meeting);
                  let IconComponent = EventIcon;
                  if (source === 'google') IconComponent = GoogleIcon;
                  if (source === 'outlook') IconComponent = OutlookIcon;
                  return (
                    <Card
                      key={meeting.id}
                      sx={{
                        p: 2,
                        borderRadius: '8px',
                        border: selected ? '2px solid #007AFF' : '1px solid #E5E5E5',
                        backgroundColor: selected ? '#F0F8FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: selected ? '#E6F3FF' : '#F8F9FA',
                          borderColor: '#007AFF',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                        }
                      }}
                      onClick={() => handleMeetingSelect(meeting)}
                    >
                      <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                        <IconComponent size={32} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 600, 
                            color: selected ? '#007AFF' : '#1E1E1E',
                            mb: 0.5,
                            cursor: 'pointer',
                            fontSize: 16
                          }}
                        >
                          {meeting.summary || meeting.title || 'Untitled meeting'}
                        </Typography>
                        {/* Remove the date from inside the card for past meetings */}
                        {!isPast && (
                          <Typography 
                            variant="body2" 
                            sx={{ color: '#666666', fontSize: '13px' }}
                          >
                            {meeting.start?.dateTime ? formatDateTime(meeting.start.dateTime) : ''}
                          </Typography>
                        )}
                      </Box>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))
        )}
      </Stack>
    );
  };

  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Handler for file selection
  const handleNotesFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates] = useState(loadTemplates());
  
  // Dropdown menu state
  const [summaryMenuAnchor, setSummaryMenuAnchor] = useState(null);
  const [summaryMenuOpen, setSummaryMenuOpen] = useState(false);

  // Copy to clipboard functionality
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summaryContent);
      setShowSnackbar(true);
      setSnackbarMessage('Summary copied to clipboard!');
      setSnackbarSeverity('success');
    } catch (err) {
      setShowSnackbar(true);
      setSnackbarMessage('Failed to copy to clipboard');
      setSnackbarSeverity('error');
    }
  };

  // Dropdown menu handlers
  const handleSummaryMenuOpen = (event) => {
    setSummaryMenuAnchor(event.currentTarget);
    setSummaryMenuOpen(true);
  };

  const handleSummaryMenuClose = () => {
    setSummaryMenuAnchor(null);
    setSummaryMenuOpen(false);
  };

  const handleEditSummary = () => {
    handleSummaryMenuClose();
    setShowAIDialog(true);
  };

  const handleRegenerateSummary = () => {
    handleSummaryMenuClose();
    setShowAIDialog(true);
  };

  return (
    <>
      <Box sx={{ height: 'calc(100vh - 128px)', display: 'flex', gap: 3 }}>
        {/* Left Sidebar */}
        <Card 
          sx={{ 
            width: 380, 
            p: 3,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            overflow: 'auto'
          }}
        >
          <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E', mb: 4 }}>
            Meetings
          </Typography>

          {/* Toggle Buttons for Future/Past */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant={meetingView === 'future' ? 'contained' : 'outlined'}
              onClick={() => setMeetingView('future')}
              sx={{ flex: 1, fontWeight: 600, borderRadius: '8px', textTransform: 'none' }}
            >
              Future
            </Button>
            <Button
              variant={meetingView === 'past' ? 'contained' : 'outlined'}
              onClick={() => setMeetingView('past')}
              sx={{ flex: 1, fontWeight: 600, borderRadius: '8px', textTransform: 'none' }}
            >
              Past
            </Button>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {/* Show only the selected meeting type */}
              {meetingView === 'future'
                ? renderGroupedMeetings(meetings.future, 'Upcoming Meetings')
                : renderGroupedMeetings(meetings.past, 'Past Meetings', true)}
            </>
          )}
        </Card>

        {/* Main Content */}
        <Card 
          sx={{ 
            flex: 1, 
            p: 0,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {selectedMeetingId ? (
            <>
              {/* Meeting Header (for both past and future meetings) */}
              <Box sx={{ px: 4, pt: 4, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#1E1E1E', mb: 1, textAlign: 'left' }}>
                    {selectedMeeting?.summary || selectedMeeting?.title || 'Untitled Meeting'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    {/* Platform Icon */}
                    {(() => {
                      const source = getMeetingSource(selectedMeeting);
                      if (source === 'google') return <GoogleIcon size={24} />;
                      if (source === 'outlook') return <OutlookIcon size={24} />;
                      return <EventIcon sx={{ color: '#888' }} />;
                    })()}
                    {/* Meeting Time */}
                    <Typography variant="body1" sx={{ color: '#666', fontWeight: 500 }}>
                      {formatMeetingTime(selectedMeeting)}
                    </Typography>
                    {/* Participants */}
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      {renderParticipants(selectedMeeting)}
                    </Box>
                    {/* Share Icon */}
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      <ShareIcon sx={{ color: '#888', fontSize: 22, cursor: 'pointer', ml: 1 }} />
                      <Typography variant="body2" sx={{ color: '#888', ml: 0.5 }}>Share</Typography>
                    </Box>
                  </Box>
                </Box>
                {/* Delete Button */}
                {/* (Removed for now) */}
              </Box>
              {/* Tab Switcher (unchanged) */}
              {(isPastMeeting || !isPastMeeting) && (
                <Box sx={{ display: 'flex', gap: 2, px: 4, pb: 2 }}>
                  <Button variant={activeTab === 'summary' ? 'contained' : 'outlined'} onClick={() => setActiveTab('summary')}>Summary</Button>
                  <Button variant={activeTab === 'transcript' ? 'contained' : 'outlined'} onClick={() => setActiveTab('transcript')}>Transcript</Button>
                  <Button variant={activeTab === 'notes' ? 'contained' : 'outlined'} onClick={() => setActiveTab('notes')}>Notes</Button>
                </Box>
              )}
              {/* Transcript Tab Logic */}
              {activeTab === 'transcript' && isPastMeeting && (() => {
                const transcript = selectedMeeting?.transcript;
                if (!transcript || transcript.trim() === '' || transcript.toLowerCase() === 'null') {
                  return (
                    <Box sx={{ textAlign: 'center', mt: 6 }}>
                      <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Transcript</Typography>
                      <Typography variant="h6" sx={{ color: '#888', mb: 2 }}>Add a transcript</Typography>
                      <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                        Marloo creates transcripts from audio or text
                      </Typography>
                      <Stack direction="row" spacing={2} justifyContent="center">
                        <Button startIcon={<MicIcon />} variant="outlined" onClick={handleStartRecording}>Start recording</Button>
                        <Button startIcon={<UploadFileIcon />} variant="outlined" onClick={() => setOpenUploadDialog(true)}>Upload audio</Button>
                        <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setOpenPasteDialog(true)}>Paste transcript</Button>
                      </Stack>
                    </Box>
                  );
                }
                // Transcript is present: show transcript only
                return (
                  <Box sx={{ textAlign: 'center', mt: 6, position: 'relative' }}>
                    <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Transcript</Typography>
                    <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5', mb: 3, position: 'relative' }}>
                      {/* Delete (X) button */}
                      <Button
                        size="small"
                        onClick={async () => {
                          const token = localStorage.getItem('jwt');
                          await fetch(`${process.env.REACT_APP_API_URL}/calendar/meetings/${selectedMeetingId}/transcript`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          await fetchMeetings();
                          setSelectedMeetingId(selectedMeetingId); // force UI update
                          setActiveTab('transcript'); // ensure upload options are shown
                        }}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          minWidth: 0,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          color: '#888',
                          background: 'transparent',
                          fontWeight: 700,
                          fontSize: 18,
                          '&:hover': { background: '#eee', color: '#b00' }
                        }}
                      >
                        ×
                      </Button>
                      <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcript}</Typography>
                    </Card>
                  </Box>
                );
              })()}
              {/* Summary Tab Logic */}
              {activeTab === 'summary' && (() => {
                // Use improved logic to determine if a real summary exists
                const hasRealSummary = isRealSummary(summaryContent, selectedMeeting);
                const hasTranscript = selectedMeeting?.transcript && selectedMeeting.transcript.trim() !== '' && selectedMeeting.transcript.toLowerCase() !== 'null';
                if (hasRealSummary) {
                  return (
                    <Box sx={{ mt: 6, textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Summary</Typography>
                      <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5', mb: 3, position: 'relative' }}>
                        {/* Action buttons in top-right corner */}
                        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
                          {/* Copy button */}
                          <Tooltip title="Copy to clipboard">
                            <IconButton
                              size="small"
                              onClick={handleCopyToClipboard}
                              sx={{
                                width: 32,
                                height: 32,
                                color: '#888',
                                background: 'transparent',
                                '&:hover': { background: '#eee', color: '#007AFF' }
                              }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Dropdown menu button */}
                          <Tooltip title="More options">
                            <IconButton
                              size="small"
                              onClick={handleSummaryMenuOpen}
                              sx={{
                                width: 32,
                                height: 32,
                                color: '#888',
                                background: 'transparent',
                                '&:hover': { background: '#eee', color: '#007AFF' }
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Delete (X) button */}
                          <Button
                            size="small"
                            onClick={async () => {
                              const token = localStorage.getItem('jwt');
                              await fetch(`${process.env.REACT_APP_API_URL}/calendar/meetings/${selectedMeetingId}/summary`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              await fetchMeetings();
                              setSelectedMeetingId(selectedMeetingId); // force UI update
                              setActiveTab('summary'); // ensure summary options are shown
                              setSummaryContent(null); // immediately update UI to show create summary options
                            }}
                            sx={{
                              minWidth: 0,
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              color: '#888',
                              background: 'transparent',
                              fontWeight: 700,
                              fontSize: 18,
                              '&:hover': { background: '#eee', color: '#b00' }
                            }}
                          >
                            ×
                          </Button>
                        </Box>
                        <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, whiteSpace: 'pre-wrap', pr: 8 }}>{summaryContent}</Typography>
                      </Card>
                    </Box>
                  );
                } else if (hasTranscript) {
                  return (
                    <Box sx={{ mt: 6, textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Summary</Typography>
                      <Typography variant="h6" sx={{ color: '#888', mb: 2 }}>No summary available. Generate one?</Typography>
                      <Stack direction="row" spacing={2} justifyContent="center">
                        <Button startIcon={<EditIcon />} variant="outlined" onClick={handleAutoGenerateSummary}>✍️ Auto Generate with Advicly AI</Button>
                        <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setShowTemplateModal(true)}>📄 Use a Template</Button>
                      </Stack>
                    </Box>
                  );
                } else {
                  return (
                    <Box sx={{ mt: 6, textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Summary</Typography>
                      <Typography variant="h6" sx={{ color: '#888', mb: 2 }}>No transcript available. Add a transcript to generate a summary.</Typography>
                    </Box>
                  );
                }
              })()}
              {activeTab === 'notes' && (
                <Box sx={{ mt: 6, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 32, color: '#007AFF', fontWeight: 700, mb: 3 }}>Notes</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AttachFileIcon />}
                    component="label"
                    sx={{ mb: 2 }}
                  >
                    Upload Files
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={handleNotesFileUpload}
                    />
                  </Button>
                  {/* List of uploaded files */}
                  <Box sx={{ mt: 2, maxWidth: 400, mx: 'auto', textAlign: 'left' }}>
                    {uploadedFiles.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ color: '#888', mb: 1 }}>Uploaded Files:</Typography>
                        <ul style={{ paddingLeft: 16 }}>
                          {uploadedFiles.map((file, idx) => (
                            <li key={file.name + file.size + idx} style={{ marginBottom: 4 }}>
                              <span style={{ fontWeight: 500 }}>{file.name}</span> <span style={{ color: '#888', fontSize: 13 }}>({(file.size/1024).toFixed(1)} KB)</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '400px',
                textAlign: 'center',
                p: 4
              }}
            >
              <EventIcon sx={{ fontSize: 64, color: '#E5E5E5', mb: 2 }} />
              <Typography variant="h3" sx={{ fontWeight: 600, color: '#3C3C3C', mb: 1 }}>
                Click on a meeting to view more.
              </Typography>
            </Box>
          )}
        </Card>

        {/* AI Adjustment Dialog */}
        <AIAdjustmentDialog
          open={showAIDialog}
          onClose={() => setShowAIDialog(false)}
          onSubmit={handleAIAdjustment}
          isLoading={loading}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={showSnackbar}
          autoHideDuration={6000}
          onClose={() => setShowSnackbar(false)}
        >
          <Alert 
            onClose={() => setShowSnackbar(false)} 
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>

        {/* Paste Transcript Dialog */}
        <Dialog open={openPasteDialog} onClose={() => setOpenPasteDialog(false)}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: 22, color: '#007AFF', pb: 1 }}>Paste Transcript</DialogTitle>
          <DialogContent sx={{ minWidth: 400, minHeight: 200, pt: 1 }}>
            <TextField
              multiline
              minRows={10}
              value={pastedTranscript}
              onChange={e => setPastedTranscript(e.target.value)}
              fullWidth
              placeholder="Paste or type transcript here..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  background: '#f9fafb',
                  fontSize: 15,
                  fontFamily: 'monospace',
                  p: 1
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ pr: 3, pb: 2 }}>
            <Button onClick={() => setOpenPasteDialog(false)} sx={{ color: '#888', fontWeight: 600 }}>Cancel</Button>
            <Button onClick={() => { console.log('Save button clicked'); handlePasteTranscriptSubmit(); }} variant="contained" sx={{ background: '#007AFF', fontWeight: 600, px: 4 }}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Upload Audio Dialog */}
        <Dialog open={openUploadDialog} onClose={() => setOpenUploadDialog(false)}>
          <DialogTitle>Upload Audio File</DialogTitle>
          <DialogContent>
            <input type="file" accept="audio/*" onChange={handleAudioFileChange} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUploadAudioSubmit} variant="contained">Upload</Button>
          </DialogActions>
        </Dialog>

        {/* Template Selection Modal */}
        <Dialog open={showTemplateModal} onClose={() => setShowTemplateModal(false)}>
          <DialogTitle>Select a Template</DialogTitle>
          <DialogContent>
            {templates.map((template) => (
              <Box key={template.id} sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 2, cursor: 'pointer', bgcolor: selectedTemplate?.id === template.id ? '#F0F8FF' : '#fff' }}
                onClick={() => setSelectedTemplate(template)}
              >
                <Typography fontWeight={600}>{template.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{template.content.slice(0, 120)}...</Typography>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!selectedTemplate}
              onClick={() => {
                // Placeholder: generate summary with selectedTemplate
                setShowTemplateModal(false);
              }}
            >
              Generate with Template
            </Button>
          </DialogActions>
        </Dialog>

        {/* Summary Actions Dropdown Menu */}
        <Menu
          anchorEl={summaryMenuAnchor}
          open={summaryMenuOpen}
          onClose={handleSummaryMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleEditSummary}>
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Edit Summary
          </MenuItem>
          <MenuItem onClick={handleRegenerateSummary}>
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Regenerate Summary
          </MenuItem>
        </Menu>
      </Box>
    </>
  );
} 