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
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: 0,
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
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: 'background.paper',
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" color="text.primary">
            Marloo Dashboard
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={handleLogout} color="primary">
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
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
            Marloo
          </Typography>
        </Toolbar>
        <Box sx={{ px: 2, py: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
          >
            New Meeting
          </Button>
        </Box>
        <List>
          {navItems.map((item) => (
            <ListItemButton
              key={item.label}
              component={NavLink}
              to={item.path}
              selected={location.pathname === item.path}
              sx={{
                mx: 1,
                borderRadius: 1,
                mb: 0.5,
                '&.active': {
                  bgcolor: 'primary.light',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 'bold',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton
            component={NavLink}
            to={pipelineNav.path}
            selected={location.pathname === pipelineNav.path}
            sx={{
              mx: 1,
              borderRadius: 1,
              mt: 2,
              '&.active': {
                bgcolor: 'primary.light',
                '& .MuiListItemIcon-root': {
                  color: 'primary.main',
                },
                '& .MuiListItemText-primary': {
                  color: 'primary.main',
                  fontWeight: 'bold',
                },
              },
            }}
          >
            <ListItemIcon>{pipelineNav.icon}</ListItemIcon>
            <ListItemText primary={pipelineNav.label} />
          </ListItemButton>
        </List>
      </Drawer>
      <Main>
        <Toolbar />
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Main>
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">New Meeting</Typography>
            <IconButton onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Meeting Summary"
              multiline
              rows={4}
              fullWidth
              variant="outlined"
            />
          </Box>
          </DialogContent>
          <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Save
          </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
} 