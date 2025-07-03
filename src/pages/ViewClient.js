import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, Stack, Button, TextField, Tabs, Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../services/api';

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
  const [editingField, setEditingField] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tempValue, setTempValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('aiSummary');

  useEffect(() => {
    async function fetchClientAndMeetings() {
      setLoading(true);
      try {
        // Fetch client details
        const client = await api.request(`/clients/${clientId}`);
        setClientData(client);
        // Fetch meetings for this client
        const meetingsData = await api.request(`/clients/${clientId}/meetings`);
        setMeetings(meetingsData);
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

  // Group meetings by other participant (excluding current client)
  const groupMeetingsByOtherParticipant = (meetings, clientEmail) => {
    const groups = {};
    meetings.forEach(meeting => {
      // Assume meeting.attendees is an array of emails or objects with .email
      const others = (meeting.attendees || [])
        .map(a => (typeof a === 'string' ? a : a.email))
        .filter(email => email && email !== clientEmail);
      others.forEach(otherEmail => {
        if (!groups[otherEmail]) groups[otherEmail] = [];
        groups[otherEmail].push(meeting);
      });
    });
    return groups;
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="AI Summary" value="aiSummary" />
          <Tab label="All Meetings" value="allMeetings" />
        </Tabs>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', gap: 3 }}>
        {activeTab === 'aiSummary' && (
          <Card sx={{ flex: 1, p: 4, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', overflow: 'auto' }}>
            {/* AI Summary (editable) */}
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 2 }}>
              AI Summary of Past Conversations
            </Typography>
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
                  <Button onClick={handleCancel}>Cancel</Button>
                </Stack>
              </Stack>
            ) : (
              <Box>
                <Typography variant="body1" sx={{ color: '#1E1E1E', lineHeight: 1.6, whiteSpace: 'pre-wrap', mb: 2 }}>
                  {clientData.aiSummary || 'No AI summary available.'}
                </Typography>
                <Button startIcon={<EditIcon />} onClick={() => handleEdit('aiSummary')}>Edit</Button>
              </Box>
            )}
          </Card>
        )}
        {activeTab === 'allMeetings' && (
          <Card sx={{ flex: 1, p: 4, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', overflow: 'auto' }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 3 }}>
              All Meetings Grouped by Other Participant
            </Typography>
            {(() => {
              const groups = groupMeetingsByOtherParticipant(meetings, clientData.email);
              const groupKeys = Object.keys(groups);
              if (groupKeys.length === 0) return <Typography>No meetings found.</Typography>;
              return groupKeys.map(otherEmail => (
                <Box key={otherEmail} sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ color: '#007AFF', fontWeight: 600, mb: 1 }}>
                    {otherEmail} ({groups[otherEmail].length} meeting{groups[otherEmail].length > 1 ? 's' : ''})
                  </Typography>
                  <Stack spacing={2}>
                    {groups[otherEmail].map(meeting => (
                      <Card key={meeting.id} sx={{ p: 2, borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#F8F9FA' }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>{meeting.title || meeting.summary}</Typography>
                        <Typography variant="body2" sx={{ color: '#3C3C3C' }}>{formatDateTime(meeting.date)}</Typography>
                        <Typography variant="body2" sx={{ color: '#999999' }}>{meeting.summary}</Typography>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              ));
            })()}
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default ViewClient; 