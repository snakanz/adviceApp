import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, Snackbar, Alert, CircularProgress, Card, Stack,
  Collapse, TextField, Paper, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MicIcon from '@mui/icons-material/Mic';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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

export default function Meetings() {
  const [meetings, setMeetings] = useState({ future: [], past: [] });
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { type: 'ai', message: 'I can help you with questions about this meeting. Ask me anything!' }
  ]);
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
      if (selectedMeetingId === null) {
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
  }, [selectedMeetingId]);

  // Only fetch meetings on initial load or when syncing
  useEffect(() => {
    if (isAuthenticated) fetchMeetings();
  }, [isAuthenticated, fetchMeetings]);

  // Update handleMeetingSelect to reset activeTab only when a new meeting is selected
  const handleMeetingSelect = (meeting) => {
    if (meeting.id !== selectedMeetingId) {
      setSelectedMeetingId(meeting.id);
      setActiveTab('summary');
      setSummaryContent(meeting.meetingSummary);
    }
  };

  const handleReconnectGoogle = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`${API_URL}/auth/reconnect-google`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to get reconnect URL');
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get reconnect URL:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to initiate Google reconnection');
      setSnackbarSeverity('error');
    }
  };

  const handleSyncMeetings = async () => {
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
            return;
          }
        }
        throw new Error('Failed to sync meetings');
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
      setShowSnackbar(true);
      setSnackbarMessage('Meetings synced successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Failed to sync meetings:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to sync meetings');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
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

  const handleSendChatMessage = () => {
    if (!chatMessages[chatMessages.length - 1].message.trim()) return;
    
    setChatMessages(prev => [...prev, 
      { type: 'user', message: chatMessages[chatMessages.length - 1].message },
      { type: 'ai', message: 'I can help you with questions about this meeting. Ask me anything!' }
    ]);
    setChatMessages(prev => prev.slice(0, -2));
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
                  
                  return (
                    <Card
                      key={meeting.id}
                      sx={{
                        p: 2,
                        borderRadius: '8px',
                        border: selected ? '2px solid #007AFF' : '1px solid #E5E5E5',
                        backgroundColor: selected ? '#F0F8FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: selected ? '#E6F3FF' : '#F8F9FA',
                          borderColor: '#007AFF',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                        }
                      }}
                      onClick={() => handleMeetingSelect(meeting)}
                    >
                      <Stack spacing={1}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 600, 
                            color: selectedMeetingId === meeting.id ? '#007AFF' : '#1E1E1E',
                            mb: 1,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleMeetingSelect(meeting)}
                        >
                          {meeting.summary}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#666666', 
                            fontSize: '13px' 
                          }}
                        >
                          {meeting.start?.dateTime ? formatDateTime(meeting.start.dateTime) : 'No time'}
                        </Typography>
                        <Chip
                          label={meeting.summary || 'Meeting'}
                          size="small"
                          sx={{
                            fontSize: '11px',
                            fontWeight: 500,
                            height: 24,
                            backgroundColor: selected ? '#007AFF' : '#F0F8FF',
                            color: selected ? '#FFFFFF' : '#007AFF',
                            borderRadius: '6px',
                            alignSelf: 'flex-start'
                          }}
                        />
                      </Stack>
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
              {/* Top Controls */}
              <Box sx={{ p: 4, pb: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                  <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
                    {selectedMeeting?.summary || 'Meeting Details'}
                  </Typography>
                  
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<EventIcon />}
                      onClick={handleReconnectGoogle}
                      sx={{
                        borderColor: '#FF6B35',
                        color: '#FF6B35',
                        fontWeight: 500,
                        textTransform: 'none',
                        px: 3,
                        py: 1,
                        borderRadius: '6px',
                        '&:hover': {
                          borderColor: '#E55A2B',
                          backgroundColor: '#FFF5F2'
                        }
                      }}
                    >
                      Reconnect Google
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EventIcon />}
                      onClick={handleSyncMeetings}
                      disabled={loading}
                      sx={{
                        borderColor: '#28A745',
                        color: '#28A745',
                        fontWeight: 500,
                        textTransform: 'none',
                        px: 3,
                        py: 1,
                        borderRadius: '6px',
                        '&:hover': {
                          borderColor: '#218838',
                          backgroundColor: '#F8FFF9'
                        },
                        '&:disabled': {
                          borderColor: '#6C757D',
                          color: '#6C757D'
                        }
                      }}
                    >
                      {loading ? 'Syncing...' : 'Sync Meetings'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PersonIcon />}
                      onClick={() => alert('Client view not implemented yet')}
                      sx={{
                        borderColor: '#007AFF',
                        color: '#007AFF',
                        fontWeight: 500,
                        textTransform: 'none',
                        px: 3,
                        py: 1,
                        borderRadius: '6px',
                        '&:hover': {
                          borderColor: '#0056CC',
                          backgroundColor: '#F0F8FF'
                        }
                      }}
                    >
                      View Client
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ChatIcon />}
                      onClick={() => setShowAIChat(!showAIChat)}
                      sx={{
                        borderColor: showAIChat ? '#007AFF' : '#E5E5E5',
                        color: showAIChat ? '#007AFF' : '#3C3C3C',
                        backgroundColor: showAIChat ? '#F0F8FF' : 'transparent',
                        fontWeight: 500,
                        textTransform: 'none',
                        px: 3,
                        py: 1,
                        borderRadius: '6px',
                        '&:hover': {
                          borderColor: '#007AFF',
                          backgroundColor: '#F0F8FF'
                        }
                      }}
                    >
                      Ask AI About Meeting
                    </Button>
                  </Stack>
                </Stack>

                {/* Minimal Tab Switcher Reset */}
                <Box sx={{ display: 'flex', gap: 2, my: 2 }}>
                  <Button variant={activeTab === 'summary' ? 'contained' : 'outlined'} onClick={() => setActiveTab('summary')}>Summary</Button>
                  <Button variant={activeTab === 'transcript' ? 'contained' : 'outlined'} onClick={() => setActiveTab('transcript')}>Transcript</Button>
                  <Button variant={activeTab === 'notes' ? 'contained' : 'outlined'} onClick={() => setActiveTab('notes')}>Notes</Button>
                </Box>
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
                    <Box sx={{ textAlign: 'center', mt: 6 }}>
                      <Typography variant="h4" sx={{ color: '#007AFF', mb: 2 }}>Transcript</Typography>
                      <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5', mb: 3 }}>
                        <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcript}</Typography>
                      </Card>
                    </Box>
                  );
                })()}
                {/* Other tabs: just show the tab name for now */}
                {activeTab === 'summary' && (
                  <Box sx={{ mt: 6, textAlign: 'center', fontSize: 32, color: '#007AFF', fontWeight: 700 }}>Summary</Box>
                )}
                {activeTab === 'notes' && (
                  <Box sx={{ mt: 6, textAlign: 'center', fontSize: 32, color: '#007AFF', fontWeight: 700 }}>Notes</Box>
                )}
              </Box>

              {/* AI Chat Overlay */}
              <Collapse in={showAIChat}>
                <Paper 
                  sx={{ 
                    m: 4, 
                    mt: 0,
                    borderRadius: '12px',
                    border: '1px solid #E5E5E5',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                  }}
                >
                  <Box sx={{ p: 3, borderBottom: '1px solid #E5E5E5' }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                      AI Assistant
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                      Ask me anything about this meeting
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p: 3, maxHeight: '200px', overflow: 'auto' }}>
                    {chatMessages.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#999999', textAlign: 'center', py: 2 }}>
                        Start a conversation by asking a question about the meeting
                      </Typography>
                    ) : (
                      <Stack spacing={2}>
                        {chatMessages.map((chat, index) => (
                          <Box 
                            key={index}
                            sx={{ 
                              display: 'flex', 
                              justifyContent: chat.type === 'user' ? 'flex-end' : 'flex-start' 
                            }}
                          >
                            <Card 
                              sx={{ 
                                p: 2, 
                                maxWidth: '70%',
                                backgroundColor: chat.type === 'user' ? '#007AFF' : '#F8F9FA',
                                color: chat.type === 'user' ? '#FFFFFF' : '#1E1E1E'
                              }}
                            >
                              <Typography variant="body2">{chat.message}</Typography>
                            </Card>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  
                  <Box sx={{ p: 3, borderTop: '1px solid #E5E5E5' }}>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Ask a question about this meeting..."
                        value={chatMessages[chatMessages.length - 1].message}
                        onChange={(e) => setChatMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], message: e.target.value }])}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '6px',
                            '& fieldset': { borderColor: '#E5E5E5' },
                            '&:hover fieldset': { borderColor: '#007AFF' },
                            '&.Mui-focused fieldset': { borderColor: '#007AFF' }
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        endIcon={<SendIcon />}
                        onClick={handleSendChatMessage}
                        disabled={!chatMessages[chatMessages.length - 1].message.trim()}
                        sx={{
                          backgroundColor: '#007AFF',
                          color: '#FFFFFF',
                          fontWeight: 500,
                          textTransform: 'none',
                          px: 3,
                          borderRadius: '6px',
                          boxShadow: 'none',
                          '&:hover': {
                            backgroundColor: '#0056CC',
                            boxShadow: 'none'
                          }
                        }}
                      >
                        Send
                      </Button>
                    </Stack>
                  </Box>
                </Paper>
              </Collapse>
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
                Select a Meeting
              </Typography>
              <Typography variant="body1" sx={{ color: '#999999' }}>
                Choose a meeting from the sidebar to view its details and summary
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
      </Box>
    </>
  );
} 