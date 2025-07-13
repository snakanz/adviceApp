import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, CssBaseline, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, TextField, Avatar, Menu, MenuItem } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const drawerWidth = 260;

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
  { label: 'Ask Advicly', icon: <AutoAwesomeIcon />, path: '/ask-advicly' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const analyticsNav = [
  { label: 'Client Pipeline', icon: <BarChartIcon />, path: '/pipeline' },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', fontFamily: 'Inter, DM Sans, sans-serif' }}>
      <CssBaseline />
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: '#FFFFFF',
          color: '#1E1E1E',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #E5E5E5',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderRadius: 0,
        }}
      >
        <Toolbar sx={{ px: 4, py: 2, minHeight: 72 }}>
          {/* Hamburger for mobile (structure only) */}
          <Box sx={{ display: { xs: 'block', sm: 'none' }, mr: 2 }}>
            <IconButton edge="start" color="inherit" aria-label="menu" onClick={() => setOpen(!open)}>
              <span style={{ fontSize: 24 }}>☰</span>
            </IconButton>
          </Box>
          {/* Remove static Dashboard heading. Optionally, add a dynamic heading here. */}
          <Box sx={{ flexGrow: 1 }} />
          {/* Notification bell placeholder */}
          <IconButton sx={{ mr: 2 }}>
            <span style={{ fontSize: 22, color: '#888' }}>🔔</span>
          </IconButton>
          {/* Theme toggle placeholder */}
          <IconButton sx={{ mr: 2 }}>
            <span style={{ fontSize: 22, color: '#888' }}>🌓</span>
          </IconButton>
          {/* User Profile Menu */}
          <Button
            onClick={handleUserMenuOpen}
            startIcon={
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: '#007AFF',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                }}
              >
                {getUserInitials(user?.name)}
              </Avatar>
            }
            endIcon={<KeyboardArrowDownIcon />}
            sx={{
              color: '#1E1E1E',
              textTransform: 'none',
              fontWeight: 500,
              px: 2,
              py: 1,
              borderRadius: '16px',
              fontFamily: 'Inter, DM Sans, sans-serif',
              '&:hover': {
                backgroundColor: '#F8F9FA'
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E1E1E', fontSize: '14px' }}>
                {user?.name || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#3C3C3C', fontSize: '12px' }}>
                {user?.email || 'user@example.com'}
              </Typography>
            </Box>
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleUserMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: {
                mt: 1,
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid #E5E5E5',
                minWidth: 200
              }
            }}
          >
            <MenuItem onClick={handleUserMenuClose} sx={{ py: 1.5, px: 2 }}>
              <AccountCircleIcon sx={{ mr: 2, color: '#3C3C3C' }} />
              <Typography variant="body2">Profile Settings</Typography>
            </MenuItem>
            <MenuItem onClick={() => { handleUserMenuClose(); handleLogout(); }} sx={{ py: 1.5, px: 2 }}>
              <LogoutIcon sx={{ mr: 2, color: '#3C3C3C' }} />
              <Typography variant="body2">Logout</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      {/* Sidebar Drawer */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E5E5E5',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            borderRadius: '0 16px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 0,
          },
        }}
        variant="permanent"
        anchor="left"
      >
        {/* Logo */}
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid #F1F3F4', background: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>
          <img src={process.env.PUBLIC_URL + '/logo-advicly.png'} alt="Advicly Logo" style={{ height: 40, width: 'auto', display: 'block', margin: '0 auto' }} />
        </Box>
        {/* Nav Items */}
        <Box sx={{ flex: 1, overflowY: 'auto', py: 2 }}>
          <List sx={{ px: 2, py: 1 }}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.label}
                component={NavLink}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: '16px',
                  mb: 1,
                  py: 1.5,
                  px: 2,
                  fontWeight: 600,
                  fontFamily: 'Inter, DM Sans, sans-serif',
                  transition: 'all 0.2s',
                  '&.Mui-selected': {
                    backgroundColor: '#F0F8FF',
                    '& .MuiListItemIcon-root': {
                      color: '#007AFF',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#007AFF',
                      fontWeight: 700,
                    },
                    '&:hover': {
                      backgroundColor: '#E6F3FF',
                    }
                  },
                  '&:hover': {
                    backgroundColor: '#F8F9FA',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: '40px', color: '#3C3C3C' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1E1E1E',
                    fontFamily: 'Inter, DM Sans, sans-serif',
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          {/* Analytics Section Divider */}
          <Box sx={{ mt: 3, mb: 1, px: 2 }}>
            <Typography variant="caption" sx={{ color: '#999999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
              Analytics
            </Typography>
          </Box>
          <List sx={{ px: 2, py: 0 }}>
            {analyticsNav.map((item) => (
              <ListItemButton
                key={item.label}
                component={NavLink}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: '16px',
                  mb: 1,
                  py: 1.5,
                  px: 2,
                  fontWeight: 600,
                  fontFamily: 'Inter, DM Sans, sans-serif',
                  transition: 'all 0.2s',
                  '&.Mui-selected': {
                    backgroundColor: '#F0F8FF',
                    '& .MuiListItemIcon-root': {
                      color: '#007AFF',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#007AFF',
                      fontWeight: 700,
                    },
                    '&:hover': {
                      backgroundColor: '#E6F3FF',
                    }
                  },
                  '&:hover': {
                    backgroundColor: '#F8F9FA',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: '40px', color: '#3C3C3C' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1E1E1E',
                    fontFamily: 'Inter, DM Sans, sans-serif',
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
        {/* Sticky Footer with Plan Badge */}
        <Box sx={{ px: 3, py: 3, borderTop: '1px solid #F1F3F4', background: '#fff', position: 'sticky', bottom: 0, zIndex: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Box sx={{
              background: 'linear-gradient(90deg, #007AFF 60%, #00C6FB 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              px: 2.5,
              py: 0.5,
              borderRadius: '12px',
              letterSpacing: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              fontFamily: 'Inter, DM Sans, sans-serif',
            }}>
              PRO PLAN
            </Box>
          </Box>
        </Box>
      </Drawer>
      {/* Main Content */}
      <Main open={open} sx={{ background: '#F8F9FA', minHeight: '100vh', p: { xs: 2, sm: 4 } }}>
        <Toolbar sx={{ minHeight: 72 }} />
        <Outlet />
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