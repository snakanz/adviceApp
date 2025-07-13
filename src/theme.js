import { createTheme } from '@mui/material/styles';

const adviclyPalette = {
  black: '#000000',
  green: '#228b22',
  greenLight: '#4CAF50',
  greenDark: '#1a6e1a',
  greyDark: '#1f2937',
  grey: '#4b5563',
  greyLight: '#d1d5db',
  bg: '#f8f9fa',
  card: '#ffffff',
  blue: '#3b82f6',
};

const theme = createTheme({
  palette: {
    primary: {
      main: adviclyPalette.green,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: adviclyPalette.blue,
      contrastText: '#FFFFFF',
    },
    background: {
      default: adviclyPalette.bg,
      paper: adviclyPalette.card,
    },
    text: {
      primary: adviclyPalette.black,
      secondary: adviclyPalette.grey,
      disabled: adviclyPalette.greyLight,
    },
    divider: adviclyPalette.greyLight,
    advicly: adviclyPalette,
    grey: {
      900: adviclyPalette.greyDark,
      800: adviclyPalette.grey,
      400: adviclyPalette.greyLight,
    },
    success: {
      main: adviclyPalette.green,
      light: adviclyPalette.greenLight,
      dark: adviclyPalette.greenDark,
      contrastText: '#fff',
    },
    info: {
      main: adviclyPalette.blue,
      contrastText: '#fff',
    },
    // Remove all red/yellow
  },
  typography: {
    fontFamily: 'Inter, DM Sans, sans-serif',
    fontSize: 15,
    h1: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.3,
      color: adviclyPalette.black,
    },
    h2: {
      fontSize: '24px',
      fontWeight: 700,
      lineHeight: 1.3,
      color: adviclyPalette.black,
    },
    h3: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
      color: adviclyPalette.black,
    },
    h4: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.3,
      color: adviclyPalette.black,
    },
    body1: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.6,
      color: adviclyPalette.greyDark,
    },
    body2: {
      fontSize: '15px',
      fontWeight: 400,
      lineHeight: 1.6,
      color: adviclyPalette.grey,
    },
    caption: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.5,
      color: adviclyPalette.grey,
    },
    button: {
      fontWeight: 600,
      fontSize: '1rem',
      textTransform: 'none',
    },
    code: { fontFamily: 'IBM Plex Mono, monospace' },
  },
  spacing: 4,
  shape: {
    borderRadius: 16,
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
          backgroundColor: adviclyPalette.card,
          border: 'none',
          marginBottom: '24px',
        },
      },
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
          backgroundColor: adviclyPalette.green,
          color: '#fff',
          '&:hover': {
            backgroundColor: adviclyPalette.greenLight,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            padding: 0,
            borderRadius: '16px',
            '& input': {
              padding: '12px 16px',
              fontSize: '16px',
            },
            '& fieldset': {
              borderColor: adviclyPalette.greyLight,
              borderRadius: '16px',
            },
            '&:hover fieldset': {
              borderColor: adviclyPalette.green,
            },
            '&.Mui-focused fieldset': {
              borderColor: adviclyPalette.greenDark,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '16px',
          fontFamily: 'Inter, DM Sans, sans-serif',
          borderRadius: '16px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: adviclyPalette.card,
          color: adviclyPalette.black,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderBottom: `1px solid ${adviclyPalette.greyLight}`,
          borderRadius: 0,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: adviclyPalette.card,
          borderRight: `1px solid ${adviclyPalette.greyLight}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          borderRadius: '0 16px 16px 0',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          margin: '2px 8px',
          transition: 'all 0.2s',
          '&.Mui-selected': {
            backgroundColor: adviclyPalette.blue + '20',
            color: adviclyPalette.blue,
            '& .MuiListItemIcon-root': {
              color: adviclyPalette.blue,
            },
            '& .MuiListItemText-primary': {
              color: adviclyPalette.blue,
              fontWeight: 600,
            },
            '&:hover': {
              backgroundColor: adviclyPalette.blue + '30',
            },
          },
          '&:hover': {
            backgroundColor: adviclyPalette.bg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
        },
      },
    },
  },
});

export default theme; 