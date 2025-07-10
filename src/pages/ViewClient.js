import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, Stack, Button, Tabs, Tab, Divider, Grid
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

const pipelineMock = {
  businessExpected: '100K Transfer',
  value: '14000',
  closeMonth: 'April'
};

const ViewClient = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [clientData, setClientData] = useState(null);
  const [meetings, setMeetings] = useState([]);
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
        setClientData(null);
        setMeetings([]);
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
            '&:hover': { backgroundColor: '#F8F9FA' }
          }}
        >
          Back to Clients
        </Button>
        <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
          {clientData.name}
        </Typography>
      </Box>

      {/* Tabs for AI Summary, All Meetings, Client Pipeline */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="AI Summary" value="aiSummary" />
          <Tab label="All Meetings" value="allMeetings" />
          <Tab label="Client Pipeline" value="pipeline" />
        </Tabs>
      </Box>

      {/* Main Content */}
      {activeTab === 'aiSummary' && (
        <Card sx={{ p: 4, borderRadius: '12px', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>AI Summary of Client</Typography>
          <Typography variant="body1" sx={{ color: '#3C3C3C' }}>
            {/* Placeholder for AI summary */}
            {clientData.aiSummary || 'AI summary will appear here.'}
          </Typography>
        </Card>
      )}

      {activeTab === 'allMeetings' && (
        <Card sx={{ p: 4, borderRadius: '12px', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>All Meetings</Typography>
          <Grid container spacing={2}>
            {meetings.length === 0 ? (
              <Typography>No meetings found for this client.</Typography>
            ) : (
              meetings.map(meeting => (
                <Grid item xs={12} md={6} key={meeting.id}>
                  <Card sx={{ p: 2, borderRadius: '8px', mb: 2, backgroundColor: '#F8F9FA' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>{meeting.title || meeting.summary}</Typography>
                    <Typography variant="body2" sx={{ color: '#3C3C3C' }}>{formatDateTime(meeting.starttime)}</Typography>
                    <Typography variant="body2" sx={{ color: '#999999' }}>{meeting.summary}</Typography>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Card>
      )}

      {activeTab === 'pipeline' && (
        <Card sx={{ p: 4, borderRadius: '12px', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Client Pipeline</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" sx={{ color: '#999999' }}>Business expected</Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{pipelineMock.businessExpected}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: '#999999' }}>Value of business</Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{pipelineMock.value}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: '#999999' }}>Expected close month</Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{pipelineMock.closeMonth}</Typography>
            </Box>
          </Stack>
        </Card>
      )}
    </Box>
  );
};

export default ViewClient; 