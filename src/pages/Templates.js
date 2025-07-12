import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Chip,
  Snackbar,
  Alert,
  Button
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import { getMeetingTypeStyles, MeetingTypeIndicator } from '../theme/meetingTypes';

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

const LOCAL_STORAGE_KEY = 'advicly_templates';

function loadTemplates() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultTemplates;
    }
  }
  return defaultTemplates;
}

function saveTemplates(templates) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
}

const allowedTemplateTitles = ['Advicly AI Auto', 'Review Meeting'];

export default function Templates() {
  const [templates, setTemplates] = useState(loadTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [editedContent, setEditedContent] = useState(selectedTemplate.content);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Save templates to localStorage whenever they change
  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  // Filter templates to only allowed titles
  const filteredTemplates = templates.filter(t => allowedTemplateTitles.includes(t.title));

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

  const handleSave = () => {
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, content: editedContent }
        : t
    );
    setTemplates(updatedTemplates);
    setShowSnackbar(true);
    setSnackbarMessage('Template saved!');
    setSnackbarSeverity('success');
  };

  const handleAddTemplate = () => {
    const newTemplate = {
      id: `custom_${Date.now()}`,
      title: 'New Template',
      content: 'Edit your prompt here...'
    };
    setTemplates([newTemplate, ...templates]);
    setSelectedTemplate(newTemplate);
    setEditedContent(newTemplate.content);
  };

  return (
    <Box display="flex" height="calc(100vh - 64px)">
      {/* Left Sidebar */}
      <Box
        width={340}
        bgcolor="#fff"
        overflow="auto"
        p={3}
        sx={{ boxShadow: 2, borderRadius: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            Templates
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', px: 2, py: 1, fontSize: 15 }}
            onClick={handleAddTemplate}
          >
            + Add New Template
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredTemplates.map((template) => {
            const isSelected = template.id === selectedTemplate.id;
            const meetingStyles = getMeetingTypeStyles(template.title);
            return (
              <Box
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setEditedContent(template.content);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2.5,
                  borderRadius: 3,
                  background: isSelected ? '#F0F8FF' : '#fff',
                  boxShadow: isSelected ? '0 4px 16px rgba(0,122,255,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #007AFF' : '1px solid #F0F0F0',
                  transition: 'all 0.2s',
                  '&:hover': {
                    background: '#F8FAFF',
                    boxShadow: '0 4px 16px rgba(0,122,255,0.10)',
                    borderColor: '#007AFF',
                  }
                }}
              >
                <AutoAwesomeIcon fontSize="medium" sx={{ color: meetingStyles.backgroundColor, mr: 1 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#222', flex: 1 }}>
                  {template.title}
                </Typography>
                <InfoOutlinedIcon color="action" />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Main Content */}
      <Box 
        flex={1} 
        bgcolor="#fff" 
        display="flex" 
        flexDirection="column"
        sx={{
          borderLeft: 1,
          borderColor: 'divider',
          boxShadow: 2,
          borderRadius: 3,
          m: 2
        }}
      >
        {/* Header */}
        <Box 
          p={3} 
          borderBottom={1} 
          borderColor="divider"
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Typography variant="h4" fontWeight={700} mb={3}>
            {selectedTemplate.title}
          </Typography>
          <Tooltip title="This is the AI prompt that controls how your email summaries are generated for this meeting type." placement="right">
            <InfoOutlinedIcon color="action" sx={{ ml: 1, mt: 0.5 }} />
          </Tooltip>
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
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 2, alignSelf: 'flex-end' }}
            onClick={handleSave}
            disabled={editedContent === selectedTemplate.content}
          >
            Save
          </Button>
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