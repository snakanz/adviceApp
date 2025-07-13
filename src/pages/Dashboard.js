import React from 'react';
import { Box, Grid, Typography, Card, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import AddIcon from '@mui/icons-material/Add';

const metricCards = [
  { label: 'Active Clients', value: 42, color: '#007AFF' },
  { label: 'Monthly Revenue', value: '$8,900', color: '#16a34a' },
  { label: 'Booked Meetings', value: 18, color: '#2563eb' },
];

const lineData = [
  { month: 'Jan', meetings: 6 },
  { month: 'Feb', meetings: 8 },
  { month: 'Mar', meetings: 10 },
  { month: 'Apr', meetings: 7 },
  { month: 'May', meetings: 12 },
  { month: 'Jun', meetings: 14 },
  { month: 'Jul', meetings: 11 },
  { month: 'Aug', meetings: 15 },
  { month: 'Sep', meetings: 13 },
  { month: 'Oct', meetings: 16 },
  { month: 'Nov', meetings: 12 },
  { month: 'Dec', meetings: 17 },
];

const pieData = [
  { name: 'Referrals', value: 18 },
  { name: 'Cold Leads', value: 8 },
  { name: 'Returning Clients', value: 16 },
];
const pieColors = ['#007AFF', '#2563eb', '#16a34a'];

const billingRows = [
  { id: 1, client: 'Tyler Smith', date: '2025-07-01', amount: '$1,200', status: 'Paid' },
  { id: 2, client: 'Amelia Brown', date: '2025-07-03', amount: '$950', status: 'Pending' },
  { id: 3, client: 'Nelson Green', date: '2025-07-05', amount: '$1,500', status: 'Paid' },
];

export default function Dashboard() {
  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', py: 2 }}>
      <Typography variant="h2" sx={{ mb: 3, fontWeight: 700 }}>Dashboard</Typography>
      {/* Metrics */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        {metricCards.map((card) => (
          <Grid item xs={12} sm={4} key={card.label}>
            <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, boxShadow: 2 }}>
              <Typography variant="h4" sx={{ color: card.color, fontWeight: 700 }}>{card.value}</Typography>
              <Typography variant="body1" sx={{ color: '#3C3C3C', fontWeight: 500 }}>{card.label}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 320 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Monthly Meeting Activity</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#888" fontSize={13} />
                <YAxis stroke="#888" fontSize={13} />
                <Tooltip contentStyle={{ borderRadius: 12, fontFamily: 'Inter, DM Sans, sans-serif' }} />
                <Line type="monotone" dataKey="meetings" stroke="#007AFF" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Meeting Sources</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                  {pieData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
      </Grid>
      {/* Billing/Client Pipeline Table */}
      <Card>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Billing History</Typography>
          <Button variant="contained" startIcon={<AddIcon />}>Add Invoice</Button>
        </Box>
        <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: '16px' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {billingRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.client}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>
                    <Box sx={{
                      background: row.status === 'Paid' ? '#E9FCD4' : '#FFF7CD',
                      color: row.status === 'Paid' ? '#16a34a' : '#d97706',
                      px: 2, py: 0.5, borderRadius: '8px', fontWeight: 600, fontSize: 14, display: 'inline-block'
                    }}>{row.status}</Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
} 