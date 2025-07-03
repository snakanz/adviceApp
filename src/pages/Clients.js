import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, Stack, TextField, Avatar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../services/api';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const data = await api.request('/clients');
        setClients(data);
      } catch (err) {
        setError(err.message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const handleViewDetails = (clientId) => {
    navigate(`/clients/${clientId}`);
  };

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
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E', mb: 1 }}>
            Clients
          </Typography>
          <Typography variant="body1" sx={{ color: '#3C3C3C' }}>
            Manage your client relationships and track opportunities
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          sx={{
            backgroundColor: '#007AFF',
            color: '#FFFFFF',
            fontWeight: 500,
            textTransform: 'none',
            py: 1.5,
            px: 3,
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: '#0056CC',
              boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
            }
          }}
        >
          Add Client
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 4 }}>
        <TextField
          placeholder="Search clients..."
          variant="outlined"
          size="small"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: '#999999', mr: 1 }} />,
          }}
          sx={{ 
            width: 340,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#FFFFFF'
            }
          }}
        />
      </Box>

      {/* Client Grid */}
      {clients.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" sx={{ color: '#999999', mb: 2 }}>
            No clients found
          </Typography>
          <Typography variant="body1" sx={{ color: '#999999' }}>
            Add your first client to get started
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {clients.map((client) => {
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={client.id}>
                <Card 
                  sx={{ 
                    borderRadius: '12px', 
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '1px solid #E5E5E5',
                    backgroundColor: '#FFFFFF',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => handleViewDetails(client.id)}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Client Header */}
                    <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: '#F0F8FF', 
                          color: '#007AFF', 
                          mr: 2,
                          width: 40,
                          height: 40,
                          fontWeight: 600
                        }}
                      >
                        {client.name ? client.name[0] : '?'}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 0.5 }}>
                          {client.name || 'Unknown Client'}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label={client.status || 'Unknown'} 
                            size="small" 
                            sx={{
                              fontSize: '11px',
                              fontWeight: 500,
                              height: 20,
                              backgroundColor: client.status === 'Active' ? '#E8F5E8' : '#FFF3E0',
                              color: client.status === 'Active' ? '#2E7D32' : '#F57C00',
                              borderRadius: '6px'
                            }}
                          />
                          <Chip 
                            label={`${client.meeting ? client.meeting : 'No'} Meeting`} 
                            size="small"
                            sx={{
                              fontSize: '11px',
                              fontWeight: 500,
                              height: 20,
                              backgroundColor: '#F0F8FF',
                              color: '#007AFF',
                              borderRadius: '6px'
                            }}
                          />
                        </Stack>
                      </Box>
                    </Box>

                    {/* Value */}
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#1E1E1E', 
                        mb: 2 
                      }}
                    >
                      {client.value || '$0'}
                    </Typography>

                    {/* Contact Info */}
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <EmailIcon sx={{ fontSize: 16, color: '#3C3C3C' }} />
                        <Typography variant="body2" sx={{ color: '#3C3C3C', fontSize: '12px' }}>
                          {client.email || 'No email'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <PhoneIcon sx={{ fontSize: 16, color: '#3C3C3C' }} />
                        <Typography variant="body2" sx={{ color: '#3C3C3C', fontSize: '12px' }}>
                          {client.phone || 'No phone'}
                        </Typography>
                      </Stack>
                    </Stack>

                    {/* Last Contact */}
                    <Typography variant="caption" sx={{ color: '#999999', mb: 3, display: 'block' }}>
                      Last contact: {client.lastContact || 'Never'}
                    </Typography>

                    {/* Action Buttons */}
                    <Stack direction="row" spacing={1}>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={() => handleViewDetails(client.id)}
                        sx={{
                          borderColor: '#007AFF',
                          color: '#007AFF',
                          textTransform: 'none',
                          fontWeight: 500,
                          px: 2,
                          py: 0.5,
                          borderRadius: '6px',
                          fontSize: '12px',
                          flex: 1,
                          '&:hover': {
                            borderColor: '#0056CC',
                            backgroundColor: '#F0F8FF'
                          }
                        }}
                      >
                        View Details
                      </Button>
                      <Button 
                        variant="contained" 
                        size="small"
                        sx={{
                          backgroundColor: '#007AFF',
                          color: '#FFFFFF',
                          textTransform: 'none',
                          fontWeight: 500,
                          px: 2,
                          py: 0.5,
                          borderRadius: '6px',
                          fontSize: '12px',
                          flex: 1,
                          boxShadow: 'none',
                          '&:hover': {
                            backgroundColor: '#0056CC',
                            boxShadow: 'none'
                          }
                        }}
                      >
                        Contact
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
} 