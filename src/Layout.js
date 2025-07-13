import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  const location = useLocation();
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
    <div className="flex h-screen font-sans">
      {/* AppBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 h-18">
          {/* Hamburger for mobile */}
          <div className="block sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(!open)}
              className="text-gray-600"
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
                className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-gray-50"
              >
                <Avatar className="w-8 h-8 bg-blue-600 text-white text-sm font-semibold rounded-xl">
                  <AvatarFallback className="bg-blue-600 text-white text-sm font-semibold rounded-xl">
                    {getUserInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-gray-900">
                    {user?.name || 'User'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {user?.email || 'user@example.com'}
                  </span>
                </div>
                <KeyboardArrowDownIcon className="w-4 h-4 text-gray-400" />
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
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-sm z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-6 border-b border-gray-100">
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
                      "flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )
                  }
                >
                  <span className={cn(
                    "w-5 h-5",
                    location.pathname === item.path ? "text-blue-600" : "text-gray-500"
                  )}>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Analytics Section */}
            <div className="mt-6 px-4">
              <div className="mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                        "flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-semibold transition-all duration-200",
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      )
                    }
                  >
                    <span className={cn(
                      "w-5 h-5",
                      location.pathname === item.path ? "text-blue-600" : "text-gray-500"
                    )}>
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          {/* Sticky Footer with Plan Badge */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center justify-center">
              <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-xs font-bold px-3 py-1 rounded-xl tracking-wider shadow-sm">
                PRO PLAN
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-0 sm:ml-64 bg-gray-50 min-h-screen pt-18">
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Menu Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <img 
                src={process.env.PUBLIC_URL + '/logo-advicly.png'} 
                alt="Advicly Logo" 
                className="h-8 w-auto" 
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
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
                      "flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )
                  }
                >
                  <span className="w-5 h-5 text-gray-500">
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
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">New Meeting</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                >
                  <CloseIcon />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting Summary</label>
                <textarea
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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