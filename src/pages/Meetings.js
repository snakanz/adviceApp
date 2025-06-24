import React, { useState, useEffect } from 'react';
import {
  Box, Typography, List, ListItem, ListItemButton, ListItemText,
  Tabs, Tab, Button, Chip, Snackbar, Alert, CircularProgress
} from '@mui/material';
import TeamsIcon from '@mui/icons-material/Groups';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getMeetingTypeStyles, MeetingTypeIndicator } from '../theme/meetingTypes';
import AIAdjustmentDialog from '../components/AIAdjustmentDialog';
import { adjustMeetingSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

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

export default function Meetings() {
  const [meetings, setMeetings] = useState({ future: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMeetingId, setSelectedMeetingId] = useState(meetings.past.length > 0 ? meetings.past[0].id : meetings.future[0]?.id);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [summaryContent, setSummaryContent] = useState(meetings.past.length > 0 ? meetings.past[0].summary : meetings.future[0]?.summary);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('jwt');
        const res = await fetch(`${API_URL}/calendar/meetings/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();
        setMeetings(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) fetchMeetings();
  }, [isAuthenticated]);

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

  return (
    <Box display="flex" height="calc(100vh - 64px)">
      {/* Left Sidebar */}
      <Box 
        width={340} 
        borderRight="1px solid #e5e7eb" 
        bgcolor="#fff" 
        overflow="auto"
        p={3}
      >
        <Typography variant="h5" fontWeight={700} mb={3}>
          Meetings
        </Typography>

        {/* Future Meetings */}
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: '#6366f1', 
            fontWeight: 600, 
            mb: 2,
            textTransform: 'uppercase',
            fontSize: 13,
            letterSpacing: 0.5
          }}
        >
          Upcoming Meetings
        </Typography>
        {loading ? <CircularProgress size={24} /> : (
        <List sx={{ mb: 4 }}>
            {meetings.future.length === 0 && <Typography color="text.secondary">No upcoming meetings</Typography>}
            {meetings.future.map((meeting) => {
              const meetingStyles = getMeetingTypeStyles(meeting.summary || 'Meeting');
            return (
              <ListItem disablePadding key={meeting.id} sx={{ mb: 1 }}>
                <ListItemButton
                  sx={{
                    borderRadius: 2,
                    border: '1px solid #e5e7eb',
                    '&:hover': {
                      bgcolor: '#f5f3ff',
                      borderColor: '#6366f1'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Typography fontWeight={600} fontSize={15}>
                            {meeting.summary}
                        </Typography>
                        <Typography color="text.secondary" fontSize={13}>
                            {formatDateTime(meeting.start?.dateTime)}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip
                              label={meeting.summary || 'Meeting'}
                            size="small"
                            sx={{
                                ...MeetingTypeIndicator({ type: meeting.summary }),
                              fontSize: 12,
                              fontWeight: 600,
                              bgcolor: meetingStyles.backgroundColor,
                              color: meetingStyles.color,
                              height: 24
                            }}
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        )}

        {/* Past Meetings */}
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: '#6b7280', 
            fontWeight: 600, 
            mb: 2,
            textTransform: 'uppercase',
            fontSize: 13,
            letterSpacing: 0.5
          }}
        >
          Past Meetings
        </Typography>
        {loading ? <CircularProgress size={24} /> : (
        <List>
            {meetings.past.length === 0 && <Typography color="text.secondary">No past meetings in last 2 weeks</Typography>}
            {meetings.past.map((meeting) => {
            const selected = meeting.id === selectedMeetingId;
              const meetingStyles = getMeetingTypeStyles(meeting.summary || 'Meeting');
            return (
              <ListItem disablePadding key={meeting.id}>
                <ListItemButton
                  selected={selected}
                  sx={{
                    borderRadius: 3,
                    mb: 2,
                    bgcolor: selected ? '#dde6de' : '#fff',
                    minHeight: 80,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: selected ? '0 0 0 2px #23213a' : '0 1px 2px #e5e7eb',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setSelectedMeetingId(meeting.id)}
                >
                  <Typography fontWeight={700} fontSize={20} color="#23213a" textAlign="center">
                      {meeting.summary}
                  </Typography>
                  <Typography
                    fontWeight={600}
                    fontSize={16}
                    sx={{
                        ...MeetingTypeIndicator({ type: meeting.summary }),
                      color: meetingStyles.color,
                      mt: 0.5
                    }}
                  >
                      {meeting.summary}
                  </Typography>
                  <Typography color="#444" fontSize={14} mt={0.5} textAlign="center">
                      {new Date(meeting.start?.dateTime).toLocaleDateString('en-GB')} at {new Date(meeting.start?.dateTime).toLocaleTimeString()}
                  </Typography>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        )}
        {error && <Typography color="error">{error}</Typography>}
      </Box>

      {/* Main Content */}
      <Box flex={1} bgcolor="#fff" p={4}>
        {/* Meeting Header */}
        <Typography variant="h3" fontWeight={800} mb={3}>
          {meetings.past.length > 0
            ? (typeof meetings.past[0].title === 'string'
                ? meetings.past[0].title
                : meetings.past[0].summary || 'Meeting')
            : meetings.future[0]
              ? (typeof meetings.future[0].title === 'string'
                  ? meetings.future[0].title
                  : meetings.future[0].summary || 'Meeting')
              : 'Meeting'}
        </Typography>

        {/* Meeting Info Bar */}
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <Box display="flex" alignItems="center" gap={1}>
            <TeamsIcon sx={{ color: '#464775' }} />
            <Typography>Teams call from {meetings.past.length > 0 ? new Date(meetings.past[0].start?.dateTime).toLocaleTimeString() : meetings.future[0]?.summary} Today</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: i === 0 ? '#fbbf24' : i === 1 ? '#3b82f6' : '#8b5cf6',
                  border: '2px solid #fff',
                  ml: i > 0 ? -1 : 0
                }}
              />
            ))}
            <Typography ml={1}>
              {meetings.past.length > 0
                ? (Array.isArray(meetings.past[0].attendees)
                    ? meetings.past[0].attendees.map(a => a.email).join(', ')
                    : 'No attendees')
                : meetings.future[0]?.attendees && Array.isArray(meetings.future[0].attendees)
                  ? meetings.future[0].attendees.map(a => a.email).join(', ')
                  : 'No attendees'}
            </Typography>
          </Box>
        </Box>

        {/* Status Message */}
        <Box 
          sx={{ 
            bgcolor: '#f0fdf4', 
            border: '1px solid #86efac',
            borderRadius: 2,
            p: 3,
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircleIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} color="#15803d">
              Notes have been completed
            </Typography>
            <Typography color="#166534">
              AI Assistant will join as notetaker
            </Typography>
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Tabs 
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 4,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 600,
              color: '#6b7280',
              '&.Mui-selected': {
                color: '#6366f1'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#6366f1'
            }
          }}
        >
          <Tab label="Meeting prep" value="prep" />
          <Tab label="Notes" value="notes" />
          <Tab label="Summary" value="summary" />
          <Tab label="Transcript" value="transcript" />
          <Tab label="Ask Assistant" value="ask" />
        </Tabs>

        {/* Summary Content */}
        {activeTab === 'summary' && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" fontWeight={700}>Meeting summary</Typography>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setShowAIDialog(true)}
                sx={{
                  borderColor: '#6366f1',
                  color: '#6366f1',
                  '&:hover': {
                    borderColor: '#4f46e5',
                    bgcolor: '#f5f3ff'
                  }
                }}
              >
                Change with AI
              </Button>
            </Box>

            <Box display="flex" alignItems="center" gap={1} mb={4}>
              <AutoAwesomeIcon sx={{ color: '#6366f1' }} />
              <Typography color="#6366f1" fontWeight={600}>
                Generated with AI
              </Typography>
            </Box>

            {/* Key Points */}
            <Typography variant="h6" fontWeight={700} mb={2}>
              1. Key Points
            </Typography>
            <Box component="ul" sx={{ pl: 4, mb: 4 }}>
              {summaryContent?.keyPoints.map((point, index) => (
                <Typography component="li" key={index} mb={1}>
                  {point}
                </Typography>
              ))}
            </Box>

            {/* Financial Snapshot */}
            <Typography variant="h6" fontWeight={700} mb={2}>
              2. Financial Snapshot
            </Typography>
            <Box component="ul" sx={{ pl: 4 }}>
              <Typography component="li" mb={1}>Net worth: {summaryContent?.financialSnapshot.netWorth}</Typography>
              <Typography component="li" mb={1}>
                Assets: {summaryContent?.financialSnapshot.assets.map(asset => 
                  `${asset.type} (${asset.value})`
                ).join(', ')}
              </Typography>
              <Typography component="li" mb={1}>
                Liabilities: {summaryContent?.financialSnapshot.liabilities.map(liability => 
                  `${liability.type} (${liability.value})`
                ).join(', ')}
              </Typography>
              <Typography component="li" mb={1}>
                Income: {summaryContent?.financialSnapshot.income.role} (${summaryContent?.financialSnapshot.income.base} base + {summaryContent?.financialSnapshot.income.bonus})
              </Typography>
              <Typography component="li">
                Current pension contributions: {summaryContent?.financialSnapshot.pension.contributions} + {summaryContent?.financialSnapshot.pension.employer}
              </Typography>
            </Box>

            <AIAdjustmentDialog
              open={showAIDialog}
              onClose={() => setShowAIDialog(false)}
              title="Adjust Meeting Summary with AI"
              originalContent={JSON.stringify(summaryContent, null, 2)}
              onAdjust={handleAIAdjustment}
              loading={loading}
            />

            <Snackbar
              open={showSnackbar}
              autoHideDuration={6000}
              onClose={() => setShowSnackbar(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Alert
                onClose={() => setShowSnackbar(false)}
                severity={snackbarSeverity}
                variant="filled"
              >
                {snackbarMessage}
              </Alert>
            </Snackbar>
          </Box>
        )}
      </Box>
    </Box>
  );
} 