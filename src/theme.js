import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      lighter: '#D1E9FC',
      light: '#76B0F1',
      main: '#2563eb',
      dark: '#103996',
      darker: '#061B64',
    },
    secondary: {
      lighter: '#D6E4FF',
      light: '#84A9FF',
      main: '#3366FF',
      dark: '#1939B7',
      darker: '#091A7A',
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
    grey: {
      100: '#F9FAFB',
      200: '#F4F6F8',
      300: '#DFE3E8',
      400: '#C4CDD5',
      500: '#919EAB',
      600: '#637381',
      700: '#454F5B',
      800: '#212B36',
      900: '#161C24',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
      neutral: '#f4f6f8',
    },
    text: {
      primary: '#212B36',
      secondary: '#637381',
      disabled: '#919EAB',
    },
    accent: { main: '#00FFD1' }, // custom
    highlight: { main: '#F2B880' }, // custom
    border: { main: '#EAEAEA' }, // custom
    muted: { main: '#A1A1AA' }, // custom
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.5,
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.5,
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
      lineHeight: 1.5,
    },
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.5,
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
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      fontSize: '0.875rem',
      textTransform: 'none',
    },
    code: { fontFamily: '"IBM Plex Mono", monospace' },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 1px 2px rgba(0, 0, 0, 0.08)',
    '0px 1px 5px rgba(0, 0, 0, 0.08)',
    '0px 1px 8px rgba(0, 0, 0, 0.08)',
    '0px 1px 10px rgba(0, 0, 0, 0.08)',
    '0px 2px 4px -1px rgba(0, 0, 0, 0.08), 0px 4px 5px rgba(0, 0, 0, 0.08)',
    '0px 3px 5px -1px rgba(0, 0, 0, 0.08), 0px 5px 8px rgba(0, 0, 0, 0.08)',
    '0px 3px 5px -1px rgba(0, 0, 0, 0.08), 0px 6px 10px rgba(0, 0, 0, 0.08)',
    '0px 4px 5px -2px rgba(0, 0, 0, 0.08), 0px 7px 10px 1px rgba(0, 0, 0, 0.08)',
    '0px 5px 6px -3px rgba(0, 0, 0, 0.08), 0px 9px 12px 1px rgba(0, 0, 0, 0.08)',
    '0px 6px 7px -4px rgba(0, 0, 0, 0.08), 0px 11px 15px 1px rgba(0, 0, 0, 0.08)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)',
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme; 