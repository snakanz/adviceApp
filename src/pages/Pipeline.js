import React from 'react';
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
  Paper,
  IconButton,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { getMeetingTypeStyles, MeetingTypeIndicator } from '../theme/meetingTypes';

const pipelineData = {
  months: ['July 2024', 'August 2024'],
  currentMonthIndex: 1,
  kpis: [
    {
      expectedFUM: 14200000,
      expectedIAF: 142000,
      expectedRecurringRevenue: 71000,
    },
    {
      expectedFUM: 15700000,
      expectedIAF: 157000,
      expectedRecurringRevenue: 78500,
    },
  ],
  clients: [
    {
      id: 1,
      name: 'Jane Stevens',
      stage: 'Review',
      expectedFUM: 2300000,
      iaf: 23000,
      waitingOn: 'Client to sign',
      notes: 'Annual review scheduled. Portfolio performing well.',
      nextMeeting: '2024-08-22',
    },
    {
      id: 2,
      name: 'Michael Chang',
      stage: '2nd Meeting',
      expectedFUM: 1800000,
      iaf: 18000,
      waitingOn: 'Waiting for pension docs',
      notes: 'Investment strategy presented. Awaiting final decision.',
      nextMeeting: '2024-08-25',
    },
    {
      id: 3,
      name: 'Sarah Williams',
      stage: 'Signup',
      expectedFUM: 950000,
      iaf: 9500,
      waitingOn: 'Waiting to hold next meeting',
      notes: 'Initial consultation completed. High interest in retirement planning.',
      nextMeeting: '2024-08-30',
    },
    // Add more clients as needed
  ],
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Pipeline() {
  const navigate = useNavigate();
  const [monthIdx, setMonthIdx] = React.useState(pipelineData.currentMonthIndex);
  const kpi = pipelineData.kpis[monthIdx];
  const monthlyRecurring = kpi.expectedRecurringRevenue / 12;
  const prevFUM = monthIdx > 0 ? pipelineData.kpis[monthIdx - 1].expectedFUM : kpi.expectedFUM;
  const fumGrowth = ((kpi.expectedFUM - prevFUM) / prevFUM) * 100;
  const theme = useTheme();

  return (
    <Box>
      {/* Month Selector */}
      <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
        <IconButton disabled={monthIdx === 0} onClick={() => setMonthIdx(monthIdx - 1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} mx={2}>
          {monthIdx === pipelineData.currentMonthIndex ? 'This Month' : pipelineData.months[monthIdx]}
        </Typography>
        <IconButton disabled={monthIdx === pipelineData.kpis.length - 1} onClick={() => setMonthIdx(monthIdx + 1)}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[1] }}>
            <CardContent>
              <Typography color="text.secondary" fontSize={14} mb={1}>Expected FUM</Typography>
              <Typography variant="h4" fontWeight={700} color={theme.palette.primary.main}>
                {formatCurrency(kpi.expectedFUM)}
              </Typography>
              <Typography color={fumGrowth >= 0 ? theme.palette.success.main : theme.palette.error.main} fontSize={14} mt={1}>
                {fumGrowth >= 0 ? '+' : ''}{fumGrowth.toFixed(1)}% from last month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[1] }}>
            <CardContent>
              <Typography color="text.secondary" fontSize={14} mb={1}>Expected IAF</Typography>
              <Typography variant="h4" fontWeight={700} color={theme.palette.primary.main}>
                {formatCurrency(kpi.expectedIAF)}
              </Typography>
              <Typography color="text.secondary" fontSize={14} mt={1}>
                Total for {monthIdx === pipelineData.currentMonthIndex ? 'this month' : pipelineData.months[monthIdx]}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[1] }}>
            <CardContent>
              <Typography color="text.secondary" fontSize={14} mb={1}>Monthly Recurring Revenue</Typography>
              <Typography variant="h4" fontWeight={700} color={theme.palette.primary.main}>
                {formatCurrency(monthlyRecurring)}
              </Typography>
              <Typography color="text.secondary" fontSize={14} mt={1}>
                0.5% of FUM annually
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Client List */}
      <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[1] }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={3}>Pipeline Clients</Typography>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Expected FUM</TableCell>
                  <TableCell>IAF</TableCell>
                  <TableCell>Waiting On</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Next Meeting</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pipelineData.clients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{client.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        fontSize={14}
                        sx={{
                          ...MeetingTypeIndicator({ type: client.stage }),
                          color: getMeetingTypeStyles(client.stage).color
                        }}
                      >
                        {client.stage}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCurrency(client.expectedFUM)}</TableCell>
                    <TableCell>{formatCurrency(client.iaf)}</TableCell>
                    <TableCell>
                      <Typography fontSize={14} color="text.secondary">
                        {client.waitingOn}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize={14} color="text.secondary" sx={{ maxWidth: 200 }}>
                        {client.notes}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize={14}>
                        {new Date(client.nextMeeting).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/meetings?client=${client.id}`)}
                        sx={{ color: theme.palette.success.main }}
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
} 