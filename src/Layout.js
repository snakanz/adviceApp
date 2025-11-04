import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Button } from './components/ui/button';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import ConnectedIntegrations from './components/ConnectedIntegrations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu';
import { supabase } from './lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { cn } from './lib/utils';
import {
  CalendarIcon,
  PeopleIcon,
  DescriptionIcon,
  SettingsIcon,
  BarChartIcon,
  LogoutIcon,
  AccountCircleIcon,
  KeyboardArrowDownIcon,
  MenuIcon,
  CloseIcon,
  AutoAwesomeIcon,
  NotificationsIcon
} from './components/icons';
import CalendarSyncButton from './components/CalendarSyncButton';
import MeetingLimitIndicator from './components/MeetingLimitIndicator';
import UpgradeModal from './components/UpgradeModal';

const navItems = [
  { label: 'Meetings', icon: <CalendarIcon />, path: '/meetings' },
  { label: 'Clients', icon: <PeopleIcon />, path: '/clients' },
  { label: 'Action Items', icon: <NotificationsIcon />, path: '/action-items' },
  { label: 'Templates', icon: <DescriptionIcon />, path: '/templates' },
  { label: 'Ask Advicly', icon: <AutoAwesomeIcon />, path: '/ask-advicly' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const analyticsNav = [
  { label: 'Client Pipeline', icon: <BarChartIcon />, path: '/pipeline' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [calendarConnection, setCalendarConnection] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { logout, user } = useAuth();

  // Fetch active calendar connection for transcription status with real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const fetchCalendarConnection = async () => {
      try {
        const { data } = await supabase
          .from('calendar_connections')
          .select('id, provider, provider_account_email, transcription_enabled, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (data) {
          setCalendarConnection(data);
        }
      } catch (err) {
        console.error('Error fetching calendar connection:', err);
      }
    };

    // Initial fetch
    fetchCalendarConnection();

    // Subscribe to real-time updates on calendar_connections table
    const subscription = supabase
      .channel(`calendar_connections:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_connections',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Update on ANY change to the connection (transcription_enabled, is_active, etc.)
          if (payload.new) {
            setCalendarConnection(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="flex h-screen font-sans layout-bg">
      {/* AppBar */}
      <header className="fixed top-0 left-0 sm:left-64 right-0 z-50 bg-card/80 border-b border-border/50 shadow-soft">
        <div className="flex items-center justify-between px-6 py-4 h-18">
          {/* Hamburger for mobile */}
          <div className="block sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(!open)}
              className="text-muted-foreground hover:text-foreground"
            >
              <MenuIcon />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Transcription Status Indicator */}
          {calendarConnection && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 mr-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${calendarConnection.transcription_enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-blue-900">
                    {calendarConnection.transcription_enabled ? '🟢 Transcription ON' : '🔴 Transcription OFF'}
                  </span>
                  <span className="text-xs text-blue-700">
                    {calendarConnection.provider_account_email}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-accent"
              >
                <Avatar className="w-8 h-8 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    {getUserInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-foreground">
                    {user?.name || 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email || 'user@example.com'}
                  </span>
                </div>
                <KeyboardArrowDownIcon className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 mt-2">
              <DropdownMenuItem className="flex items-center gap-2">
                <AccountCircleIcon className="w-4 h-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={handleLogout}
              >
                <LogoutIcon className="w-4 h-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar Drawer */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-card/80 border-r border-border/50 shadow-soft z-40 pt-20 hidden sm:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-6">
            <div className="px-4 flex flex-col gap-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "sidebar-item text-base px-4 py-3 font-medium",
                      isActive && "active text-base"
                    )
                  }
                >
                  <span className="w-5 h-5">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Analytics Section */}
            <div className="mt-6 px-4">
              <div className="mb-2">
                <span className="label">
                  Analytics
                </span>
              </div>
              <div className="space-y-1">
                {analyticsNav.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "sidebar-item",
                        isActive && "active"
                      )
                    }
                  >
                    <span className="w-5 h-5">
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          {/* Sticky Footer with Quick Access and Logo */}
          <div className="border-t border-border/50">
            {/* Meeting Limit Indicator */}
            <div className="p-3">
              <MeetingLimitIndicator onUpgradeClick={() => setShowUpgradeModal(true)} />
            </div>

            {/* Calendar Integrations Quick Access */}
            <div className="p-3">
              <CalendarSyncButton />
            </div>

            {/* Advicly Logo */}
            <div className="p-4">
              <div className="flex items-center justify-center">
                <img
                  src={process.env.PUBLIC_URL + '/logo-advicly.png'}
                  alt="Advicly Logo"
                  className="h-8 w-auto mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-0 sm:ml-64 bg-background min-h-screen pt-20">
        <div className="h-full w-full overflow-hidden">
          <Outlet />
        </div>
        {/* Connected Integrations Status */}
        <ConnectedIntegrations />
      </main>

      {/* Mobile Menu Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-card/95 backdrop-blur-sm shadow-large">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <img 
                src={process.env.PUBLIC_URL + '/logo-advicly.png'} 
                alt="Advicly Logo" 
                className="h-8 w-auto" 
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <CloseIcon />
              </Button>
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "sidebar-item",
                      isActive && "active"
                    )
                  }
                >
                  <span className="w-5 h-5">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Calendar Integrations Quick Access - Mobile */}
            <div className="px-4 py-3 border-t border-border/50 mt-4" onClick={() => setOpen(false)}>
              <CalendarSyncButton />
            </div>
          </div>
        </div>
      )}

      {/* New Meeting Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <Card className="w-full max-w-md border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">New Meeting</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <CloseIcon />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Meeting Summary</label>
                <textarea
                  className="w-full h-24 px-3 py-2 border border-border bg-background text-foreground rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter meeting summary..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}