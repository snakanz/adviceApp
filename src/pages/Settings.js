import React from 'react';
import { Box, Typography } from '@mui/material';

export default function Settings() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>Settings</Typography>
      <Typography color="text.secondary" mb={3}>Manage your AdvisorFlow settings</Typography>
      {/* Settings content goes here */}
    </Box>
  );
} 