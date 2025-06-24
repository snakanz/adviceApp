import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Chip,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { getMeetingTypeStyles, MeetingTypeIndicator } from '../theme/meetingTypes';
import { improveTemplate } from '../services/api';

const defaultTemplates = [
  {
    id: 'intro',
    title: 'Intro Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting with me today. Here's a summary of our discussion and next steps.\n\nKey Points:\n- Your current financial situation\n- Your goals and priorities\n- Next steps for our engagement\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'cashflow',
    title: 'Cashflow Meeting',
    content: `Dear [Client Name],\n\nThank you for our recent meeting to review your cashflow.\n\nKey Points:\n- Income and expenses overview\n- Budgeting and savings opportunities\n- Action items for next steps\n\nLet me know if you need clarification on any points.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'performance',
    title: 'Performance Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting to review your portfolio performance.\n\nKey Points:\n- Portfolio returns and allocation\n- Market commentary\n- Recommendations and next steps\n\nPlease reach out if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'signup',
    title: 'Signup Meeting',
    content: `Dear [Client Name],\n\nCongratulations on taking the next step! Here's a summary of your signup meeting.\n\nKey Points:\n- Services agreed upon\n- Documentation required\n- Next steps for onboarding\n\nWe look forward to working with you.\n\nBest regards,\n[Your Name]`,
  },
];

export default function Templates() {
  const [templates, setTemplates] = useState(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [editedContent, setEditedContent] = useState(selectedTemplate.content);
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [adjustment, setAdjustment] = useState('');
  const maxChars = 150;

  const handleContentChange = (newContent) => {
    setEditedContent(newContent);
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, content: newContent }
        : t
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate(prev => ({ ...prev, content: newContent }));
  };

  const handleAIAdjustment = async () => {
    if (!adjustment.trim()) return;
    
    setLoading(true);
    try {
      const improvedContent = await improveTemplate(selectedTemplate.content, adjustment);
      handleContentChange(improvedContent);
      setAdjustment('');
      setShowSnackbar(true);
      setSnackbarMessage('Template improved successfully');
      setSnackbarSeverity('success');
    } catch (error) {
      console.error('Failed to improve template:', error);
      setShowSnackbar(true);
      setSnackbarMessage('Failed to improve template. Please try again.');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" height="calc(100vh - 64px)">
      {/* Left Sidebar */}
      <Box
        width={300}
        borderRight={1}
        borderColor="divider"
        bgcolor="#fff"
        overflow="auto"
        p={3}
      >
        <Typography variant="h5" fontWeight={700} mb={3}>
          Templates
        </Typography>
        <List>
          {templates.map((template) => {
            const isSelected = template.id === selectedTemplate.id;
            const meetingStyles = getMeetingTypeStyles(template.title);
            
            return (
              <ListItem 
                key={template.id} 
                disablePadding 
                sx={{ mb: 2 }}
              >
                <ListItemButton
                  selected={isSelected}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setEditedContent(template.content);
                  }}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'primary.50' : '#fff',
                    '&:hover': {
                      bgcolor: 'primary.50',
                      borderColor: 'primary.main',
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Chip
                          label={template.title}
                          size="small"
                          sx={{
                            ...MeetingTypeIndicator({ type: template.title }),
                            fontSize: 13,
                            fontWeight: 600,
                            bgcolor: meetingStyles.backgroundColor,
                            color: meetingStyles.color,
                            mb: 1
                          }}
                        />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {template.content.split('\n').slice(0, 2).join('\n')}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Main Content */}
      <Box 
        flex={1} 
        bgcolor="#fff" 
        display="flex" 
        flexDirection="column"
        sx={{
          borderLeft: 1,
          borderColor: 'divider'
        }}
      >
        {/* Header */}
        <Box 
          p={3} 
          borderBottom={1} 
          borderColor="divider"
        >
          <Typography variant="h4" fontWeight={700} mb={3}>
            {selectedTemplate.title}
          </Typography>

          {/* AI Input Area */}
          <Box 
            display="flex" 
            gap={2}
            sx={{
              position: 'relative'
            }}
          >
            <TextField
              fullWidth
              value={adjustment}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setAdjustment(e.target.value);
                }
              }}
              placeholder="How would you like to improve this template? Press Enter to submit"
              variant="outlined"
              size="medium"
              disabled={loading}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAIAdjustment();
                }
              }}
              InputProps={{
                sx: {
                  bgcolor: '#f9fafb',
                  '&:hover': {
                    bgcolor: '#f3f4f6',
                  },
                  pr: 5
                }
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ opacity: adjustment.length > 0 ? 1 : 0 }}
              >
                {adjustment.length}/{maxChars}
              </Typography>
              {loading ? (
                <CircularProgress size={20} />
              ) : (
                <IconButton
                  size="small"
                  onClick={handleAIAdjustment}
                  disabled={!adjustment.trim()}
                  color="primary"
                >
                  <AutoAwesomeIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>

        {/* Content Area */}
        <Box 
          flex={1} 
          p={3}
          sx={{ 
            overflowY: 'auto',
            bgcolor: '#f9fafb'
          }}
        >
          <TextField
            multiline
            fullWidth
            value={editedContent}
            onChange={(e) => handleContentChange(e.target.value)}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '1rem',
                lineHeight: 1.6,
                '& textarea': {
                  padding: 0,
                }
              }
            }}
          />
        </Box>
      </Box>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={6000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setShowSnackbar(false)}
          severity={snackbarSeverity}
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
} 