import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#007AFF',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: '#3C3C3C'
    },
    background: {
      default: '#F8F9FA', // soft background
      paper: '#FFFFFF'
    },
    text: {
      primary: '#1E1E1E',
      secondary: '#3C3C3C',
      disabled: '#999999'
    },
    divider: '#E5E5E5',
    grey: {
      50: '#F8F9FA',
      100: '#F1F3F4',
      200: '#E8EAED',
      300: '#DADCE0',
      400: '#BDC1C6',
      500: '#9AA0A6',
      600: '#80868B',
      700: '#5F6368',
      800: '#3C4043',
      900: '#202124'
    },
    success: {
      lighter: '#E9FCD4',
      light: '#AAF27F',
      main: '#16a34a',
      dark: '#229A16',
      darker: '#08660D',
    },
    warning: {
      lighter: '#FFF7CD',
      light: '#FFE16A',
      main: '#d97706',
      dark: '#B78103',
      darker: '#7A4F01',
    },
    info: {
      lighter: '#D0F2FF',
      light: '#74CAFF',
      main: '#2563eb',
      dark: '#0C53B7',
      darker: '#04297A',
    },
    error: {
      lighter: '#FFE7D9',
      light: '#FFA48D',
      main: '#FF4842',
      dark: '#B72136',
      darker: '#7A0C2E',
    },
  },
  typography: {
    fontFamily: 'Inter, DM Sans, sans-serif',
    fontSize: 15,
    h1: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.3,
      color: '#1E1E1E'
    },
    h2: {
      fontSize: '24px',
      fontWeight: 700,
      lineHeight: 1.3,
      color: '#1E1E1E'
    },
    h3: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#1E1E1E'
    },
    h4: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#1E1E1E'
    },
    body1: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.6,
      color: '#1E1E1E'
    },
    body2: {
      fontSize: '15px',
      fontWeight: 400,
      lineHeight: 1.6,
      color: '#3C3C3C'
    },
    caption: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#999999'
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.25rem',
      lineHeight: 1.5,
    },
    h6: {
      fontWeight: 700,
      fontSize: '1.125rem',
      lineHeight: 1.5,
    },
    subtitle1: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      fontSize: '1rem',
      textTransform: 'none',
    },
    code: { fontFamily: 'IBM Plex Mono, monospace' },
  },
  spacing: 4, // Base spacing unit
  shape: {
    borderRadius: 16
  },
  shadows: [
    'none',
    '0px 2px 8px rgba(0, 0, 0, 0.08)',
    '0px 4px 16px rgba(0, 0, 0, 0.10)',
    '0px 8px 24px rgba(0, 0, 0, 0.10)',
    '0px 1px 10px rgba(0, 0, 0, 0.08)',
    '0px 2px 4px -1px rgba(0, 0, 0, 0.08), 0px 4px 5px rgba(0, 0, 0, 0.08)',
    '0px 3px 5px -1px rgba(0, 0, 0, 0.08), 0px 5px 8px rgba(0, 0, 0, 0.08)',
    '0px 3px 5px -1px rgba(0, 0, 0, 0.08), 0px 6px 10px rgba(0, 0, 0, 0.08)',
    '0px 4px 5px -2px rgba(0, 0, 0, 0.08), 0px 7px 10px 1px rgba(0, 0, 0, 0.08)',
    '0px 5px 6px -3px rgba(0, 0, 0, 0.08), 0px 9px 12px 1px rgba(0, 0, 0, 0.08)',
    '0px 6px 7px -4px rgba(0, 0, 0, 0.08), 0px 11px 15px 1px rgba(0, 0, 0, 0.08)',
  ],
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          padding: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          border: 'none',
          marginBottom: '24px',
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '12px 24px',
          borderRadius: '16px',
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '16px',
          lineHeight: 1.5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.2s',
          '&:hover': {
            filter: 'brightness(0.97)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            padding: 0,
            borderRadius: '16px',
            '& input': {
              padding: '12px 16px',
              fontSize: '16px'
            },
            '& fieldset': {
              borderColor: '#CCCCCC',
              borderRadius: '16px'
            },
            '&:hover fieldset': {
              borderColor: '#007AFF'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#007AFF',
              borderWidth: '2px'
            }
          }
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '16px',
          fontFamily: 'Inter, DM Sans, sans-serif',
          borderRadius: '16px',
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#1E1E1E',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #E5E5E5',
          borderRadius: 0
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E5E5E5',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          borderRadius: '0 16px 16px 0',
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          margin: '2px 8px',
          transition: 'all 0.2s',
          '&.Mui-selected': {
            backgroundColor: '#F0F8FF',
            color: '#007AFF',
            '& .MuiListItemIcon-root': {
              color: '#007AFF',
            },
            '& .MuiListItemText-primary': {
              color: '#007AFF',
              fontWeight: 600,
            },
            '&:hover': {
              backgroundColor: '#E6F3FF',
            }
          },
          '&:hover': {
            backgroundColor: '#F8F9FA',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }
        }
      }
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
        }
      }
    }
  }
});

export default theme; 