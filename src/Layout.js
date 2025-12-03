import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Button } from './components/ui/button';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu';
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
import SidebarCalendarStatus from './components/SidebarCalendarStatus';
import MeetingLimitIndicator from './components/MeetingLimitIndicator';
import UpgradeModal from './components/UpgradeModal';
import { CheckCircle2 } from 'lucide-react';

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeSuccessMessage, setUpgradeSuccessMessage] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, user } = useAuth();

  // Detect successful upgrade from Stripe checkout
  useEffect(() => {
    const upgraded = searchParams.get('upgraded');
    if (upgraded === 'true') {
      console.log('🎉 User successfully upgraded to Professional!');
      setUpgradeSuccessMessage('🎉 Welcome to Professional! You now have unlimited AI-transcribed meetings.');

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setUpgradeSuccessMessage('');
      }, 5000);

      // Clean up URL (remove ?upgraded=true parameter)
      searchParams.delete('upgraded');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleLogout = () => {
    logout();
  };

  // Get user's display name from Supabase Auth user_metadata
  const getUserDisplayName = () => {
    // Check user_metadata first (where updateUser stores it)
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (metaName) return metaName;

    // Fallback to email username
    if (user?.email) {
      return user.email.split('@')[0];
    }

    return 'User';
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex h-screen font-sans layout-bg">
      {/* AppBar - Glass-Morphism */}
      <header className="fixed top-0 left-0 sm:left-64 right-0 z-50 bg-card/90 border-b border-border/20 backdrop-blur-lg shadow-card">
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

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-accent"
              >
                <Avatar className="w-8 h-8 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    {getUserInitials(getUserDisplayName())}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-foreground">
                    {getUserDisplayName()}
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

      {/* Sidebar Drawer - Glass-Morphism */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-card/90 border-r border-border/20 backdrop-blur-lg shadow-card z-40 pt-20 hidden sm:block">
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

            {/* Calendar Integrations Status */}
            <div className="p-3">
              <SidebarCalendarStatus />
            </div>

            {/* Advicly Logo */}
            <div className="px-4 py-6">
              <div className="flex items-center justify-center">
                <img
                  src="https://xjqjzievgepqpgtggcjx.supabase.co/storage/v1/object/sign/assets/Advicly%20Logo.svg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81NTIwYjQ4Yi00ZTE5LTQ1ZGQtYTYxNC1kZTk5NzMwZTBiMmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvQWR2aWNseSBMb2dvLnN2ZyIsImlhdCI6MTc2NDc2OTczOCwiZXhwIjoxNzk2MzA1NzM4fQ.px5dOI9ijCo5xxdumxq2ebKO_wxm-teU7BKyORhLU48"
                  alt="Advicly"
                  className="w-full max-w-[180px]"
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
      </main>

      {/* Mobile Menu Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-card/95 backdrop-blur-lg shadow-large">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <img
                src="https://xjqjzievgepqpgtggcjx.supabase.co/storage/v1/object/sign/assets/Advicly%20Logo.svg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81NTIwYjQ4Yi00ZTE5LTQ1ZGQtYTYxNC1kZTk5NzMwZTBiMmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvQWR2aWNseSBMb2dvLnN2ZyIsImlhdCI6MTc2NDc2OTczOCwiZXhwIjoxNzk2MzA1NzM4fQ.px5dOI9ijCo5xxdumxq2ebKO_wxm-teU7BKyORhLU48"
                alt="Advicly"
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

            {/* Calendar Integrations Status - Mobile */}
            <div className="px-4 py-3 border-t border-border/50 mt-4" onClick={() => setOpen(false)}>
              <SidebarCalendarStatus />
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

      {/* Upgrade Success Toast */}
      {upgradeSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{upgradeSuccessMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}