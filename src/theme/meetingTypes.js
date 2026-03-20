// Meeting type configuration for consistent styling across the app
// Updated for Deep Dark Mode with translucent backgrounds
export const MEETING_TYPES = {
  'Intro Meeting': {
    color: '#FFB74D', // Orange
    backgroundColor: 'rgba(255, 183, 77, 0.15)', // Translucent orange
  },
  'Cashflow Meeting': {
    color: '#00C49F', // Modern Emerald (accent)
    backgroundColor: 'rgba(0, 196, 159, 0.15)', // Translucent emerald
  },
  'Performance Meeting': {
    color: '#337AFF', // Vibrant Blue (primary)
    backgroundColor: 'rgba(51, 122, 255, 0.15)', // Translucent blue
  },
  'Signup Meeting': {
    color: '#9C27B0', // Purple
    backgroundColor: 'rgba(156, 39, 176, 0.15)', // Translucent purple
  },
  'Review Meeting': {
    color: '#F44336', // Red
    backgroundColor: 'rgba(244, 67, 54, 0.15)', // Translucent red
  },
};

// Helper function to get meeting type styles
export const getMeetingTypeStyles = (type) => {
  return MEETING_TYPES[type] || {
    color: '#8F90A6', // Muted gray
    backgroundColor: 'rgba(143, 144, 166, 0.15)', // Translucent muted
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