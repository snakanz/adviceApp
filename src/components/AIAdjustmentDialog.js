import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const AIAdjustmentDialog = ({
  open,
  onClose,
  title,
  originalContent,
  onAdjust,
  loading = false,
}) => {
  const [adjustment, setAdjustment] = useState('');
  const maxChars = 150;

  const handleSubmit = () => {
    onAdjust(adjustment);
    setAdjustment('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" mb={2}>
          Enter your adjustment request (max {maxChars} characters):
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={adjustment}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) {
              setAdjustment(e.target.value);
            }
          }}
          placeholder="What would you like to adjust?"
          helperText={`${adjustment.length}/${maxChars} characters`}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!adjustment.trim() || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {loading ? 'Adjusting...' : 'Adjust with AI'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIAdjustmentDialog; 