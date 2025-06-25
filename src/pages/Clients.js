import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, Stack, TextField, Avatar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import { useTheme } from '@mui/material/styles';

const clients = [
  {
    id: 'simon-miller',
    name: 'Simon Miller',
    status: 'Active',
    meeting: 'Third',
    value: '$10,000',
    email: 'simon@email.com',
    phone: '+1 234 567 8901',
    lastContact: '17/08/24',
  },
  {
    id: 'alex-thompson',
    name: 'Alex Thompson',
    status: 'Prospect',
    meeting: 'First',
    value: '$25,000',
    email: 'alex@email.com',
    phone: '+1 234 567 8902',
    lastContact: '12/08/24',
  },
  {
    id: 'tom-johnson',
    name: 'Tom Johnson',
    status: 'Active',
    meeting: 'Second',
    value: '$50,000',
    email: 'tom@email.com',
    phone: '+1 234 567 8903',
    lastContact: '10/08/24',
  },
  {
    id: 'sarah-davis',
    name: 'Sarah Davis',
    status: 'Active',
    meeting: 'Third',
    value: '$15,000',
    email: 'sarah@email.com',
    phone: '+1 234 567 8904',
    lastContact: '08/08/24',
  },
];

const statusColor = (status) => status === 'Active' ? 'success' : 'warning';
const meetingColor = (meeting) => meeting === 'First' ? 'warning' : meeting === 'Second' ? 'info' : 'success';

export default function Clients() {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleViewDetails = (clientId) => {
    navigate(`/clients/${clientId}`);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
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
      <Grid container spacing={3}>
        {clients.map((client) => (
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
                    {client.name[0]}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E', mb: 0.5 }}>
                      {client.name}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip 
                        label={client.status} 
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
                        label={`${client.meeting} Meeting`} 
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
                  {client.value}
                </Typography>

                {/* Contact Info */}
                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EmailIcon sx={{ fontSize: 16, color: '#3C3C3C' }} />
                    <Typography variant="body2" sx={{ color: '#3C3C3C', fontSize: '12px' }}>
                      {client.email}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PhoneIcon sx={{ fontSize: 16, color: '#3C3C3C' }} />
                    <Typography variant="body2" sx={{ color: '#3C3C3C', fontSize: '12px' }}>
                      {client.phone}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Last Contact */}
                <Typography variant="caption" sx={{ color: '#999999', mb: 3, display: 'block' }}>
                  Last contact: {client.lastContact}
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
        ))}
      </Grid>
    </Box>
  );
} 