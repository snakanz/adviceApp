import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Stack, TextField } from '@mui/material';
import { api } from '../services/api';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selectedClientIndex, setSelectedClientIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

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
                <Typography variant="body1" color="text.secondary">(AI summary placeholder)</Typography>
              </Box>
            )}
            {tab === 1 && (
              <Box>
                <Typography variant="h5" fontWeight={700} mb={2}>All Meetings</Typography>
                {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                  selectedClient.meetings.map(mtg => (
                    <Box key={mtg.id} sx={{ mb: 2, p: 2 }}>
                      <Typography fontWeight={600}>{mtg.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(mtg.starttime).toLocaleString()} - {new Date(mtg.endtime).toLocaleString()}
                      </Typography>
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