import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
  AutoAwesomeIcon
} from './components/icons';

const navItems = [
  { label: 'Meetings', icon: <CalendarIcon />, path: '/meetings' },
  { label: 'Clients', icon: <PeopleIcon />, path: '/clients' },
  { label: 'Templates', icon: <DescriptionIcon />, path: '/templates' },
  { label: 'Ask Advicly', icon: <AutoAwesomeIcon />, path: '/ask-advicly' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const analyticsNav = [
  { label: 'Client Pipeline', icon: <BarChartIcon />, path: '/pipeline' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="flex h-screen font-sans bg-background">
      {/* AppBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50 shadow-soft">
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
      <aside className="fixed left-0 top-0 h-full w-64 bg-card/80 backdrop-blur-sm border-r border-border/50 shadow-soft z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-6 border-b border-border/50">
            <img 
              src={process.env.PUBLIC_URL + '/logo-advicly.png'} 
              alt="Advicly Logo" 
              className="h-10 w-auto" 
            />
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="px-4 space-y-1">
              {navItems.map((item) => (
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

          {/* Sticky Footer with Plan Badge */}
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center justify-center">
              <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold px-3 py-1 rounded-full tracking-wider shadow-soft">
                PRO PLAN
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-0 sm:ml-64 bg-background min-h-screen pt-18">
        <div className="h-full">
          <Outlet />
        </div>
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
    </div>
  );
} 