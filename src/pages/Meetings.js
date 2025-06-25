import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, Snackbar, Alert, CircularProgress, Card, Stack, Divider,
  Select, MenuItem, FormControl, Collapse, TextField, Paper, Tabs, Tab
} from '@mui/material';
import TeamsIcon from '@mui/icons-material/Groups';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventIcon from '@mui/icons-material/Event';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://marloo-dashboard-backend.nelson-ec5.workers.dev/api';

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

const emailTemplates = [
  { value: 'standard', label: 'Standard Summary' },
  { value: 'detailed', label: 'Detailed Report' },
  { value: 'executive', label: 'Executive Brief' },
  { value: 'client_friendly', label: 'Client-Friendly' }
];

export default function Meetings() {
  const [meetings, setMeetings] = useState({ future: [], past: [] });
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [summaryContent, setSummaryContent] = useState(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [emailTemplate, setEmailTemplate] = useState('standard');
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [editingPrep, setEditingPrep] = useState(false);
  const [meetingPrep, setMeetingPrep] = useState('');

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('jwt');
        const res = await fetch(`${API_URL}/calendar/meetings/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();
        setMeetings(data);
        
        // Set initial selected meeting and content
        if (data.past.length > 0) {
          setSelectedMeetingId(data.past[0].id);
          setSummaryContent(data.past[0].summary);
        } else if (data.future.length > 0) {
          setSelectedMeetingId(data.future[0].id);
          setSummaryContent(data.future[0].summary);
          setMeetingPrep(data.future[0].prep || '');
        }
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) fetchMeetings();
  }, [isAuthenticated]);

  const selectedMeeting = meetings.past.find(m => m.id === selectedMeetingId) || 
                          meetings.future.find(m => m.id === selectedMeetingId);
  const isPastMeeting = meetings.past.some(m => m.id === selectedMeetingId);

  const handleMeetingSelect = (meeting) => {
    setSelectedMeetingId(meeting.id);
    setSummaryContent(meeting.summary);
    if (!isPastMeeting) {
      setMeetingPrep(meeting.prep || '');
      setActiveTab('prep');
    } else {
      setActiveTab('summary');
    }
    setShowAIChat(false);
  };

  const handleEmailSummary = () => {
    setShowSnackbar(true);
    setSnackbarMessage(`Email summary sent using ${emailTemplates.find(t => t.value === emailTemplate)?.label} template`);
    setSnackbarSeverity('success');
  };

  const handleViewClient = () => {
    navigate(`/clients/demo-client`); // Using demo client for now
  };

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
    if (!chatMessage.trim()) return;
    
    setChatHistory(prev => [...prev, 
      { type: 'user', message: chatMessage },
      { type: 'ai', message: 'I can help you with questions about this meeting. This is a demo response.' }
    ]);
    setChatMessage('');
  };

  const handleSavePrep = () => {
    setEditingPrep(false);
    setShowSnackbar(true);
    setSnackbarMessage('Meeting preparation saved successfully');
    setSnackbarSeverity('success');
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
                            color: selected ? '#007AFF' : '#1E1E1E', 
                            fontSize: '14px' 
                          }}
                        >
                          {meeting.summary}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ color: '#3C3C3C', fontSize: '12px' }}
                        >
                          <EventIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                          {formatDateTime(meeting.start?.dateTime)}
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

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {/* Future Meetings */}
            {renderGroupedMeetings(meetings.future, 'Upcoming Meetings')}
            
            {meetings.future.length > 0 && meetings.past.length > 0 && (
              <Divider sx={{ my: 3, borderColor: '#E5E5E5' }} />
            )}

            {/* Past Meetings */}
            {renderGroupedMeetings(meetings.past, 'Past Meetings', true)}
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
                    variant="contained"
                    startIcon={<EmailIcon />}
                    onClick={handleEmailSummary}
                    sx={{
                      backgroundColor: '#007AFF',
                      color: '#FFFFFF',
                      fontWeight: 500,
                      textTransform: 'none',
                      px: 3,
                      py: 1,
                      borderRadius: '6px',
                      boxShadow: 'none',
                      '&:hover': {
                        backgroundColor: '#0056CC',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    Email Summary
                  </Button>
                  
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={emailTemplate}
                      onChange={(e) => setEmailTemplate(e.target.value)}
                      sx={{
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#E5E5E5'
                        }
                      }}
                    >
                      {emailTemplates.map((template) => (
                        <MenuItem key={template.value} value={template.value}>
                          {template.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <Button
                    variant="outlined"
                    startIcon={<PersonIcon />}
                    onClick={handleViewClient}
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

              {/* Meeting Info Bar */}
              <Card sx={{ p: 3, mb: 4, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5' }}>
                <Stack direction="row" spacing={3} alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <TeamsIcon sx={{ color: '#3C3C3C', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                      Teams Meeting • {formatDateTime(selectedMeeting?.start?.dateTime)}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box display="flex">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: i === 0 ? '#007AFF' : i === 1 ? '#34C759' : '#FF9500',
                            border: '2px solid #FFFFFF',
                            ml: i > 0 ? -0.5 : 0
                          }}
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" sx={{ color: '#999999', ml: 1 }}>
                      3 participants
                    </Typography>
                  </Box>
                  {isPastMeeting && (
                    <Card 
                      sx={{ 
                        p: 2,
                        backgroundColor: '#F0F8FF',
                        border: '1px solid #007AFF',
                        borderRadius: '6px'
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CheckCircleIcon sx={{ color: '#007AFF', fontSize: 16 }} />
                        <Typography variant="caption" sx={{ color: '#007AFF', fontWeight: 500 }}>
                          Notes completed
                        </Typography>
                      </Stack>
                    </Card>
                  )}
                </Stack>
              </Card>

              {/* Navigation Tabs */}
              <Tabs 
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                sx={{
                  borderBottom: '1px solid #E5E5E5',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#3C3C3C',
                    py: 2,
                    px: 3,
                    '&.Mui-selected': {
                      color: '#007AFF',
                      fontWeight: 600
                    }
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#007AFF',
                    height: 2
                  }
                }}
              >
                {!isPastMeeting && <Tab label="Meeting Prep" value="prep" />}
                {isPastMeeting && <Tab label="Summary" value="summary" />}
                {isPastMeeting && <Tab label="Transcript" value="transcript" />}
                <Tab label="Notes" value="notes" />
              </Tabs>
            </Box>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 4, pt: 3 }}>
              {/* Meeting Prep Content (for future meetings) */}
              {activeTab === 'prep' && !isPastMeeting && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                      Meeting Preparation
                    </Typography>
                    {editingPrep ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={handleSavePrep}
                          sx={{
                            backgroundColor: '#007AFF',
                            color: '#FFFFFF',
                            fontWeight: 500,
                            textTransform: 'none',
                            px: 2,
                            py: 1,
                            borderRadius: '6px',
                            boxShadow: 'none',
                            '&:hover': { backgroundColor: '#0056CC', boxShadow: 'none' }
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => setEditingPrep(false)}
                          sx={{
                            borderColor: '#E5E5E5',
                            color: '#3C3C3C',
                            fontWeight: 500,
                            textTransform: 'none',
                            px: 2,
                            py: 1,
                            borderRadius: '6px'
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setEditingPrep(true)}
                        sx={{
                          borderColor: '#007AFF',
                          color: '#007AFF',
                          fontWeight: 500,
                          textTransform: 'none',
                          px: 2,
                          py: 1,
                          borderRadius: '6px'
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </Stack>

                  {editingPrep ? (
                    <TextField
                      fullWidth
                      multiline
                      rows={12}
                      value={meetingPrep}
                      onChange={(e) => setMeetingPrep(e.target.value)}
                      placeholder="Add your meeting preparation notes, agenda items, questions to ask, etc."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& fieldset': { borderColor: '#E5E5E5' },
                          '&:hover fieldset': { borderColor: '#007AFF' },
                          '&.Mui-focused fieldset': { borderColor: '#007AFF' }
                        }
                      }}
                    />
                  ) : (
                    <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5' }}>
                      {meetingPrep ? (
                        <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {meetingPrep}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#999999', fontStyle: 'italic' }}>
                          Click "Edit" to add meeting preparation notes, agenda items, and questions.
                        </Typography>
                      )}
                    </Card>
                  )}
                </Box>
              )}

              {/* Summary Content (for past meetings) */}
              {activeTab === 'summary' && isPastMeeting && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                      Meeting Summary
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={() => setShowAIDialog(true)}
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
                      Adjust with AI
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4 }}>
                    <AutoAwesomeIcon sx={{ color: '#007AFF', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ color: '#007AFF', fontWeight: 500 }}>
                      Generated with AI
                    </Typography>
                  </Stack>

                  {/* Key Points */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 2 }}>
                      1. Key Points
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0 }}>
                      {summaryContent?.keyPoints ? summaryContent.keyPoints.map((point, index) => (
                        <Typography 
                          component="li" 
                          key={index} 
                          variant="body1"
                          sx={{ 
                            color: '#1E1E1E', 
                            mb: 1.5,
                            lineHeight: 1.6
                          }}
                        >
                          {point}
                        </Typography>
                      )) : (
                        <Typography variant="body2" sx={{ color: '#999999' }}>
                          No key points available
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Financial Snapshot */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 2 }}>
                      2. Financial Snapshot
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0 }}>
                      {summaryContent?.financialSnapshot ? (
                        <>
                          <Typography 
                            component="li" 
                            variant="body1"
                            sx={{ color: '#1E1E1E', mb: 1.5, lineHeight: 1.6 }}
                          >
                            Net worth: {summaryContent.financialSnapshot.netWorth}
                          </Typography>
                          <Typography 
                            component="li" 
                            variant="body1"
                            sx={{ color: '#1E1E1E', mb: 1.5, lineHeight: 1.6 }}
                          >
                            Income: {summaryContent.financialSnapshot.income}
                          </Typography>
                          <Typography 
                            component="li" 
                            variant="body1"
                            sx={{ color: '#1E1E1E', mb: 1.5, lineHeight: 1.6 }}
                          >
                            Expenses: {summaryContent.financialSnapshot.expenses}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#999999' }}>
                          No financial information available
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Action Items */}
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 2 }}>
                      3. Action Items
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0 }}>
                      {summaryContent?.actionItems ? summaryContent.actionItems.map((item, index) => (
                        <Typography 
                          component="li" 
                          key={index} 
                          variant="body1"
                          sx={{ 
                            color: '#1E1E1E', 
                            mb: 1.5,
                            lineHeight: 1.6
                          }}
                        >
                          {item}
                        </Typography>
                      )) : (
                        <Typography variant="body2" sx={{ color: '#999999' }}>
                          No action items available
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Transcript Content */}
              {activeTab === 'transcript' && isPastMeeting && (
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 3 }}>
                    Meeting Transcript
                  </Typography>
                  
                  <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5' }}>
                    <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6 }}>
                      [00:00] <strong>Advisor:</strong> Good morning! Thank you for joining today's meeting. I'd like to start by reviewing your current portfolio performance.
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, mt: 2 }}>
                      [00:15] <strong>Client:</strong> Thank you. I'm particularly interested in how my investments have been performing over the last quarter.
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, mt: 2 }}>
                      [00:30] <strong>Advisor:</strong> Your portfolio has shown strong performance with a 12% growth year-over-year. Let me walk you through the key drivers...
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#999999', mt: 3, fontStyle: 'italic' }}>
                      Full transcript available - showing first 3 entries
                    </Typography>
                  </Card>
                </Box>
              )}

              {/* Notes Content */}
              {activeTab === 'notes' && (
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 3 }}>
                    Meeting Notes
                  </Typography>
                  
                  <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5' }}>
                    <Typography variant="body2" sx={{ color: '#999999', fontStyle: 'italic' }}>
                      Detailed meeting notes will appear here. This feature is coming soon.
                    </Typography>
                  </Card>
                </Box>
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
                  {chatHistory.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#999999', textAlign: 'center', py: 2 }}>
                      Start a conversation by asking a question about the meeting
                    </Typography>
                  ) : (
                    <Stack spacing={2}>
                      {chatHistory.map((chat, index) => (
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
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
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
                      disabled={!chatMessage.trim()}
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
    </Box>
  );
} 