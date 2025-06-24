import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, Stack, TextField, Avatar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { useTheme } from '@mui/material/styles';

const clients = [
  {
    name: 'Simon Miller',
    status: 'Active',
    meeting: 'Third',
    value: '$10,000',
    email: 'simon@email.com',
    phone: '+1 234 567 8901',
    lastContact: '17/08/24',
  },
  {
    name: 'Alex Thompson',
    status: 'Prospect',
    meeting: 'First',
    value: '$25,000',
    email: 'alex@email.com',
    phone: '+1 234 567 8902',
    lastContact: '12/08/24',
  },
  {
    name: 'Tom Johnson',
    status: 'Active',
    meeting: 'Second',
    value: '$50,000',
    email: 'tom@email.com',
    phone: '+1 234 567 8903',
    lastContact: '10/08/24',
  },
  {
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={0.5}>Clients</Typography>
          <Typography color="text.secondary">Manage your client relationships</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: 2, fontWeight: 600 }}>
          Add Client
        </Button>
      </Box>
      <TextField
        placeholder="Search clients..."
        variant="outlined"
        size="small"
        sx={{ mb: 4, width: 340 }}
      />
      <Grid container spacing={3}>
        {clients.map((client) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={client.name}>
            <Card sx={{ borderRadius: 3, boxShadow: theme.shadows[2] }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Avatar sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.primary.main, mr: 1.5 }}>{client.name[0]}</Avatar>
                  <Typography variant="h6" fontWeight={700}>{client.name}</Typography>
                  <Chip label={client.status} color={statusColor(client.status)} size="small" sx={{ ml: 1, fontWeight: 600 }} />
                  <Chip label={client.meeting} color={meetingColor(client.meeting)} size="small" sx={{ ml: 1, fontWeight: 600 }} />
                </Box>
                <Typography color="text.secondary" fontWeight={500} mb={0.5}>{client.value}</Typography>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <EmailIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                  <Typography fontSize={14}>{client.email}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <PhoneIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                  <Typography fontSize={14}>{client.phone}</Typography>
                </Stack>
                <Typography color="text.secondary" fontSize={13} mb={2}>
                  Last contact: {client.lastContact}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" sx={{ borderRadius: 2 }}>View Details</Button>
                  <Button variant="contained" size="small" sx={{ borderRadius: 2 }}>Contact</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
} 