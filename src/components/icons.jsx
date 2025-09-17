import React from 'react';
import {
  Calendar,
  Users,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Bell
} from 'lucide-react';

export const CalendarIcon = ({ size = 24, className = "" }) => (
  <Calendar size={size} className={className} />
);

export const PeopleIcon = ({ size = 24, className = "" }) => (
  <Users size={size} className={className} />
);

export const DescriptionIcon = ({ size = 24, className = "" }) => (
  <FileText size={size} className={className} />
);

export const SettingsIcon = ({ size = 24, className = "" }) => (
  <Settings size={size} className={className} />
);

export const BarChartIcon = ({ size = 24, className = "" }) => (
  <BarChart3 size={size} className={className} />
);

export const LogoutIcon = ({ size = 24, className = "" }) => (
  <LogOut size={size} className={className} />
);

export const AccountCircleIcon = ({ size = 24, className = "" }) => (
  <User size={size} className={className} />
);

export const KeyboardArrowDownIcon = ({ size = 24, className = "" }) => (
  <ChevronDown size={size} className={className} />
);

export const MenuIcon = ({ size = 24, className = "" }) => (
  <Menu size={size} className={className} />
);

export const CloseIcon = ({ size = 24, className = "" }) => (
  <X size={size} className={className} />
);

export const AutoAwesomeIcon = ({ size = 24, className = "" }) => (
  <Sparkles size={size} className={className} />
);

export const NotificationsIcon = ({ size = 24, className = "" }) => (
  <Bell size={size} className={className} />
);