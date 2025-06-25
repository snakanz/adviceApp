import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, CssBaseline, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, TextField } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const drawerWidth = 280;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme }) => ({
    flexGrow: 1,
    padding: 0,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: 0,
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
  }),
);

const navItems = [
  { label: 'Meetings', icon: <CalendarMonthIcon />, path: '/meetings' },
  { label: 'Clients', icon: <PeopleIcon />, path: '/clients' },
  { label: 'Templates', icon: <DescriptionIcon />, path: '/templates' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const pipelineNav = { label: 'Client Pipeline', icon: <BarChartIcon />, path: '/pipeline' };

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          backgroundColor: '#FFFFFF',
          color: '#1E1E1E',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #E5E5E5',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ px: 4, py: 2 }}>
          <Typography variant="h4" noWrap component="div" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
            Dashboard
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button 
            onClick={handleLogout} 
            startIcon={<LogoutIcon />}
            sx={{ 
              color: '#3C3C3C',
              textTransform: 'none',
              fontWeight: 500,
              px: 2,
              py: 1,
              borderRadius: '6px',
              '&:hover': {
                backgroundColor: '#F8F9FA'
              }
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E5E5E5',
            boxShadow: 'none',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ px: 3, py: 3 }}>
          <Typography variant="h3" noWrap component="div" sx={{ fontWeight: 700, color: '#1E1E1E' }}>
            App
          </Typography>
        </Toolbar>
        <Box sx={{ px: 3, py: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
              fontWeight: 500,
              py: 1.5,
              px: 2,
              borderRadius: '8px',
              textTransform: 'none',
              fontSize: '14px',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#0056CC',
                boxShadow: 'none',
              }
            }}
          >
            New Meeting
          </Button>
        </Box>
        <List sx={{ px: 2, py: 1 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.label}
              component={NavLink}
              to={item.path}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: '8px',
                mb: 1,
                py: 1.5,
                px: 2,
                '&.Mui-selected': {
                  backgroundColor: '#F0F8FF',
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
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: '40px' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label} 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1E1E1E'
                }}
              />
            </ListItemButton>
          ))}
          <Box sx={{ mt: 3, mb: 1, px: 2 }}>
            <Typography variant="caption" sx={{ color: '#999999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Analytics
            </Typography>
          </Box>
          <ListItemButton
            component={NavLink}
            to={pipelineNav.path}
            selected={location.pathname === pipelineNav.path}
            sx={{
              borderRadius: '8px',
              py: 1.5,
              px: 2,
              '&.Mui-selected': {
                backgroundColor: '#F0F8FF',
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
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: '40px' }}>
              {pipelineNav.icon}
            </ListItemIcon>
            <ListItemText 
              primary={pipelineNav.label} 
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#1E1E1E'
              }}
            />
          </ListItemButton>
        </List>
      </Drawer>
      <Main>
        <Toolbar />
        <Box sx={{ p: 4, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Main>
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1E1E1E' }}>
              New Meeting
            </Typography>
            <IconButton 
              onClick={() => setOpen(false)} 
              size="small"
              sx={{ 
                color: '#3C3C3C',
                '&:hover': {
                  backgroundColor: '#F8F9FA'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 2 }}>
          <TextField
            label="Meeting Summary"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setOpen(false)}
            sx={{ 
              color: '#3C3C3C',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1,
              borderRadius: '6px'
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => setOpen(false)}
            sx={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1,
              borderRadius: '6px',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#0056CC',
                boxShadow: 'none',
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 