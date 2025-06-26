import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import { MeetingTypeIndicator } from '../theme/meetingTypes';

export default function Pipeline() {
  const navigate = useNavigate();
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    async function fetchPipelineData() {
      setLoading(true);
      try {
        const response = await fetch('/api/pipeline');
        if (!response.ok) {
          throw new Error('Failed to fetch pipeline data');
        }
        const data = await response.json();
        setPipelineData(data);
      } catch (err) {
        setError(err.message);
        setPipelineData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPipelineData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading pipeline data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Error loading pipeline data: {error}</Typography>
      </Box>
    );
  }

  if (!pipelineData) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>No pipeline data available</Typography>
      </Box>
    );
  }

  const currentMonth = pipelineData.months[currentMonthIndex];
  const currentKpis = pipelineData.kpis[currentMonthIndex];
  const currentClients = pipelineData.clients.filter(client => 
    client.monthIndex === currentMonthIndex
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
          Pipeline
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => setCurrentMonthIndex(Math.max(0, currentMonthIndex - 1))}
            disabled={currentMonthIndex === 0}
            sx={{ color: '#3C3C3C' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E', minWidth: 120, textAlign: 'center' }}>
            {currentMonth}
          </Typography>
          <IconButton
            onClick={() => setCurrentMonthIndex(Math.min(pipelineData.months.length - 1, currentMonthIndex + 1))}
            disabled={currentMonthIndex === pipelineData.months.length - 1}
            sx={{ color: '#3C3C3C' }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#999999', mb: 1 }}>
                Expected FUM
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
                {formatCurrency(currentKpis.expectedFUM)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#999999', mb: 1 }}>
                Expected IAF
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
                {formatCurrency(currentKpis.expectedIAF)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#999999', mb: 1 }}>
                Expected Recurring Revenue
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
                {formatCurrency(currentKpis.expectedRecurringRevenue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Clients Table */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8F9FA' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Stage</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Expected FUM</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>IAF</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Waiting On</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}>Next Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1E1E1E' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" sx={{ color: '#999999' }}>
                        No clients in pipeline for {currentMonth}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentClients.map((client) => (
                    <TableRow key={client.id} sx={{ '&:hover': { backgroundColor: '#F8F9FA' } }}>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                          {client.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={MeetingTypeIndicator({ type: client.stage })} />
                          <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                            {client.stage}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
                          {formatCurrency(client.expectedFUM)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ color: '#3C3C3C' }}>
                          {formatCurrency(client.iaf)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                          {client.waitingOn}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                          {client.notes}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#3C3C3C' }}>
                          {client.nextMeeting}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => navigate(`/clients/${client.id}`)}
                          sx={{ color: '#007AFF' }}
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
} 