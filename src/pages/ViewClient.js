import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, Stack, Button, TextField, Chip, 
  IconButton, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/Event';
import ChatIcon from '@mui/icons-material/Chat';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';

const formatDateTime = (dateTimeStr) => {
  const date = new Date(dateTimeStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ViewClient = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tempValue, setTempValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClientAndMeetings() {
      setLoading(true);
      try {
        // Fetch client details
        const clientRes = await fetch(`/api/clients/${clientId}`);
        const client = await clientRes.json();
        setClientData(client);
        // Fetch meetings for this client
        const meetingsRes = await fetch(`/api/clients/${clientId}/meetings`);
        const meetingsData = await meetingsRes.json();
        setMeetings(meetingsData);
        if (meetingsData.length > 0) {
          setSelectedMeetingId(meetingsData[0].id);
        }
      } catch (e) {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    fetchClientAndMeetings();
  }, [clientId]);

  if (loading) return <Box>Loading...</Box>;
  if (!clientData) return <Box>Client not found.</Box>;

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const handleBack = () => {
    navigate('/clients');
  };

  const handleEdit = (field) => {
    setEditingField(field);
    setTempValue(clientData[field]);
  };

  const handleSave = (field) => {
    setClientData(prev => ({
      ...prev,
      [field]: tempValue
    }));
    setEditingField(null);
  };

  const handleCancel = () => {
    setEditingField(null);
    setTempValue('');
  };

  return (
    <Box sx={{ height: 'calc(100vh - 128px)', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{
            color: '#3C3C3C',
            textTransform: 'none',
            fontWeight: 500,
            px: 2,
            py: 1,
            borderRadius: '6px',
            '&:hover': {
              backgroundColor: '#F8F9FA'
            }
          }}
        >
          Back to Clients
        </Button>
        <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
          {clientData.name}
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', gap: 3 }}>
        {/* Left Panel - Meetings List */}
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
          <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 3 }}>
            Meeting History
          </Typography>

          <Stack spacing={1}>
            {meetings.map((meeting) => {
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
                  onClick={() => setSelectedMeetingId(meeting.id)}
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
                      {meeting.title}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ color: '#3C3C3C', fontSize: '12px' }}
                    >
                      <EventIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                      {formatDateTime(meeting.date)}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ color: '#999999', fontSize: '12px', lineHeight: 1.4 }}
                    >
                      {meeting.summary}
                    </Typography>
                    <Chip
                      label={meeting.type || 'Meeting'}
                      size="small"
                      sx={{
                        fontSize: '11px',
                        fontWeight: 500,
                        height: 24,
                        backgroundColor: selected ? '#007AFF' : '#F0F8FF',
                        color: selected ? '#FFFFFF' : '#007AFF',
                        borderRadius: '6px',
                        alignSelf: 'flex-start',
                        textTransform: 'capitalize'
                      }}
                    />
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Card>

        {/* Right Panel - Client Details */}
        <Card 
          sx={{ 
            flex: 1, 
            p: 4,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            overflow: 'auto'
          }}
        >
          {selectedMeeting && (
            <Stack spacing={4}>
              {/* Meeting Detail Header */}
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 2 }}>
                  {selectedMeeting.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                  {formatDateTime(selectedMeeting.date)}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: '#E5E5E5' }} />

              {/* Client Value & Profit */}
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 3 }}>
                  Client Overview
                </Typography>
                <Stack direction="row" spacing={4}>
                  <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5', flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#999999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Portfolio Value
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: '#1E1E1E', mt: 1 }}>
                      {clientData.value}
                    </Typography>
                  </Card>
                  <Card sx={{ p: 3, backgroundColor: '#F8F9FA', border: '1px solid #E5E5E5', flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#999999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Expected Profit
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: '#34C759', mt: 1 }}>
                      {clientData.profit}
                    </Typography>
                  </Card>
                </Stack>
              </Box>

              {/* Likelihood of Signup */}
              <Card sx={{ p: 3, border: '1px solid #E5E5E5' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                      Likelihood of Signup
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <AutoAwesomeIcon sx={{ color: '#007AFF', fontSize: 16 }} />
                      <Typography variant="caption" sx={{ color: '#007AFF', fontWeight: 500 }}>
                        AI Generated
                      </Typography>
                    </Stack>
                  </Box>
                  {editingField !== 'likelihoodOfSignup' && (
                    <IconButton 
                      onClick={() => handleEdit('likelihoodOfSignup')}
                      sx={{ color: '#3C3C3C' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                
                {editingField === 'likelihoodOfSignup' ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      type="number"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 100 }}
                      sx={{ width: 100 }}
                    />
                    <Typography variant="body2" sx={{ color: '#3C3C3C' }}>%</Typography>
                    <Button
                      startIcon={<SaveIcon />}
                      onClick={() => handleSave('likelihoodOfSignup')}
                      sx={{
                        backgroundColor: '#007AFF',
                        color: '#FFFFFF',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
                        borderRadius: '6px',
                        fontSize: '12px',
                        '&:hover': {
                          backgroundColor: '#0056CC'
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={handleCancel}
                      sx={{
                        color: '#3C3C3C',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                ) : (
                  <Box>
                    <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
                      {clientData.likelihoodOfSignup}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999999' }}>
                      Based on AI analysis of past interactions
                    </Typography>
                  </Box>
                )}
              </Card>

              {/* Expected Close Date */}
              <Card sx={{ p: 3, border: '1px solid #E5E5E5' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                    Expected Close Date
                  </Typography>
                  {editingField !== 'expectedCloseDate' && (
                    <IconButton 
                      onClick={() => handleEdit('expectedCloseDate')}
                      sx={{ color: '#3C3C3C' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                
                {editingField === 'expectedCloseDate' ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      type="date"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      size="small"
                      sx={{ width: 180 }}
                    />
                    <Button
                      startIcon={<SaveIcon />}
                      onClick={() => handleSave('expectedCloseDate')}
                      sx={{
                        backgroundColor: '#007AFF',
                        color: '#FFFFFF',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
                        borderRadius: '6px',
                        fontSize: '12px',
                        '&:hover': {
                          backgroundColor: '#0056CC'
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={handleCancel}
                      sx={{
                        color: '#3C3C3C',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                ) : (
                  <Typography variant="body1" sx={{ color: '#1E1E1E' }}>
                    {new Date(clientData.expectedCloseDate).toLocaleDateString('en-GB', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                )}
              </Card>

              {/* AI Summary */}
              <Card sx={{ p: 3, border: '1px solid #E5E5E5' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                      AI Summary of Past Conversations
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <AutoAwesomeIcon sx={{ color: '#007AFF', fontSize: 16 }} />
                      <Typography variant="caption" sx={{ color: '#007AFF', fontWeight: 500 }}>
                        AI Generated
                      </Typography>
                    </Stack>
                  </Box>
                  {editingField !== 'aiSummary' && (
                    <IconButton 
                      onClick={() => handleEdit('aiSummary')}
                      sx={{ color: '#3C3C3C' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                
                {editingField === 'aiSummary' ? (
                  <Stack spacing={2}>
                    <TextField
                      multiline
                      rows={4}
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      fullWidth
                      variant="outlined"
                    />
                    <Stack direction="row" spacing={2}>
                      <Button
                        startIcon={<SaveIcon />}
                        onClick={() => handleSave('aiSummary')}
                        sx={{
                          backgroundColor: '#007AFF',
                          color: '#FFFFFF',
                          textTransform: 'none',
                          fontWeight: 500,
                          px: 3,
                          py: 1,
                          borderRadius: '6px',
                          '&:hover': {
                            backgroundColor: '#0056CC'
                          }
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={handleCancel}
                        sx={{
                          color: '#3C3C3C',
                          textTransform: 'none',
                          fontWeight: 500,
                          px: 3,
                          py: 1,
                          borderRadius: '6px'
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6 }}>
                    {clientData.aiSummary}
                  </Typography>
                )}
              </Card>

              {/* Ask AI Button */}
              <Button
                variant="contained"
                startIcon={<ChatIcon />}
                sx={{
                  backgroundColor: '#007AFF',
                  color: '#FFFFFF',
                  fontWeight: 500,
                  textTransform: 'none',
                  py: 2,
                  px: 4,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  alignSelf: 'flex-start',
                  '&:hover': {
                    backgroundColor: '#0056CC',
                    boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
                  }
                }}
              >
                Ask AI about this client
              </Button>
            </Stack>
          )}
        </Card>
      </Box>
    </Box>
  );
};

export default ViewClient; 