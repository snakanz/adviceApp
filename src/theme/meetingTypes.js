// Meeting type configuration for consistent styling across the app
export const MEETING_TYPES = {
  'Intro Meeting': {
    color: '#FFB74D', // Orange
    backgroundColor: '#FFF3E0',
  },
  'Cashflow Meeting': {
    color: '#4CAF50', // Green
    backgroundColor: '#E8F5E9',
  },
  'Performance Meeting': {
    color: '#2196F3', // Blue
    backgroundColor: '#E3F2FD',
  },
  'Signup Meeting': {
    color: '#9C27B0', // Purple
    backgroundColor: '#F3E5F5',
  },
  'Review Meeting': {
    color: '#F44336', // Red
    backgroundColor: '#FFEBEE',
  },
};

// Helper function to get meeting type styles
export const getMeetingTypeStyles = (type) => {
  return MEETING_TYPES[type] || {
    color: '#757575',
    backgroundColor: '#EEEEEE',
  };
};

// Component for the meeting type indicator
export const MeetingTypeIndicator = ({ type, sx = {} }) => {
  const styles = getMeetingTypeStyles(type);
  
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    '&::before': {
      content: '""',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: styles.color,
      display: 'inline-block',
      ...sx
    }
  };
}; 