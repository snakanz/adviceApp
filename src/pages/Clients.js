import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, TextField } from '@mui/material';
import { api } from '../services/api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedClientIndex, setSelectedClientIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [clientAISummary, setClientAISummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const data = await api.request('/clients');
        setClients(data);
        setSelectedClientIndex(0); // Always select the first client by default
      } catch (err) {
        setError(err.message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c =>
    (c.name || c.email).toLowerCase().includes(search.toLowerCase())
  );

  const selectedClient = filteredClients[selectedClientIndex] || filteredClients[0];

  useEffect(() => {
    // When selectedClient changes, update summary
    if (selectedClient && selectedClient.ai_summary) {
      setClientAISummary(selectedClient.ai_summary);
    } else {
      setClientAISummary('');
    }
  }, [selectedClient]);

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading clients...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Error loading clients: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Client List Panel */}
      <Box sx={{ width: 300, borderRight: '1px solid #eee', p: 2 }}>
        <TextField
          placeholder="Search Client"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        />
        <Box>
          {filteredClients.map((client, idx) => (
            <Box
              key={client.email}
              sx={{
                mb: 1,
                p: 1,
                background: idx === selectedClientIndex ? '#e3f2fd' : '#fff',
                cursor: 'pointer',
                border: idx === selectedClientIndex ? '2px solid #1976d2' : '1px solid #eee',
              }}
              onClick={() => setSelectedClientIndex(idx)}
            >
              <Typography fontWeight={600}>{client.name || client.email}</Typography>
              <Typography variant="body2" color="text.secondary">{client.email}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main Details Area */}
      <Box sx={{ flex: 1, p: 4 }}>
        {selectedClient ? (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Stack direction="row" spacing={2}>
                <Button onClick={() => setTab(0)} variant={tab === 0 ? 'contained' : 'text'}>AI summary of Client</Button>
                <Button onClick={() => setTab(1)} variant={tab === 1 ? 'contained' : 'text'}>All Meetings</Button>
                <Button onClick={() => setTab(2)} variant={tab === 2 ? 'contained' : 'text'}>Client Pipeline</Button>
              </Stack>
            </Box>
            {tab === 0 && (
              <Box>
                <Typography variant="h5" fontWeight={700} mb={2}>AI summary of Client</Typography>
                <Button
                  variant="contained"
                  onClick={async () => {
                    setLoadingSummary(true);
                    setSummaryError(null);
                    try {
                      const token = localStorage.getItem('token'); // or get from context
                      const res = await fetch(
                        `/api/clients/${encodeURIComponent(selectedClient.email)}/ai-summary`,
                        {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${token}`
                          }
                        }
                      );
                      if (!res.ok) throw new Error('Failed to generate summary');
                      const data = await res.json();
                      setClientAISummary(data.ai_summary);
                    } catch (err) {
                      setSummaryError(err.message);
                    } finally {
                      setLoadingSummary(false);
                    }
                  }}
                  disabled={loadingSummary}
                  sx={{ mb: 2 }}
                >
                  {loadingSummary ? 'Generating...' : 'Generate AI Summary'}
                </Button>
                {summaryError && <Typography color="error">{summaryError}</Typography>}
                <Typography variant="body1" sx={{ mt: 2 }}>
                  {clientAISummary || 'No summary yet. Click "Generate AI Summary" to create one.'}
                </Typography>
              </Box>
            )}
            {tab === 1 && (
              <Box>
                <Typography variant="h5" fontWeight={700} mb={2}>All Meetings</Typography>
                {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                  selectedClient.meetings.map(mtg => (
                    <Box key={mtg.id} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', md: 'row' },
                          alignItems: { xs: 'flex-start', md: 'stretch' },
                          p: 2,
                          borderRadius: '12px',
                          background: '#F8F9FA',
                          border: '1px solid #E5E5E5',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                      >
                        {/* Meeting Info */}
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography fontWeight={600} sx={{ mb: 1 }}>{mtg.title}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {new Date(mtg.starttime).toLocaleString()} - {new Date(mtg.endtime).toLocaleString()}
                          </Typography>
                        </Box>
                        {/* Divider for desktop */}
                        <Box sx={{ width: 24, display: { xs: 'none', md: 'block' } }} />
                        {/* Meeting Summary */}
                        <Box sx={{ flex: 2, minWidth: 200 }}>
                          <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-line' }}>
                            {mtg.summary || 'No summary available.'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <Typography>No meetings found for this client.</Typography>
                )}
              </Box>
            )}
            {tab === 2 && (
              <Box>
                <Typography variant="h5" fontWeight={700} mb={2}>Client Pipeline</Typography>
                <Typography>Business expected: (placeholder)</Typography>
                <Typography>Value of business: (placeholder)</Typography>
                <Typography>Expected close month: (placeholder)</Typography>
              </Box>
            )}
          </>
        ) : (
          <Typography>Select a client to view details.</Typography>
        )}
      </Box>
    </Box>
  );
} 