import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../utils/api';

// Integration icons
const GoogleCalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z" fill="#4285F4"/>
    <path d="M12 11C10.34 11 9 12.34 9 14C9 15.66 10.34 17 12 17C13.66 17 15 15.66 15 14C15 12.34 13.66 11 12 11Z" fill="#EA4335"/>
    <path d="M12 11V14L15 14C15 12.34 13.66 11 12 11Z" fill="#FBBC04"/>
    <path d="M12 14V17C13.66 17 15 15.66 15 14H12Z" fill="#34A853"/>
  </svg>
);

const MicrosoftCalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#0078D4"/>
    <path d="M8 7H16V9H8V7Z" fill="white"/>
    <path d="M8 11H16V13H8V11Z" fill="white"/>
    <path d="M8 15H13V17H8V15Z" fill="white"/>
  </svg>
);

function SidebarCalendarStatus() {
  const [integrations, setIntegrations] = useState({
    google: { connected: false, active: false },
    microsoft: { connected: false, active: false }
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkIntegrationStatus = useCallback(async () => {
    try {
      const response = await api.request('/calendar-connections');
      
      const googleConnection = response.find(c => c.provider === 'google_calendar');
      const microsoftConnection = response.find(c => c.provider === 'microsoft_calendar');
      
      setIntegrations({
        google: {
          connected: !!googleConnection,
          active: googleConnection?.is_active || false,
          email: googleConnection?.connected_account
        },
        microsoft: {
          connected: !!microsoftConnection,
          active: microsoftConnection?.is_active || false,
          email: microsoftConnection?.connected_account
        }
      });
    } catch (error) {
      console.error('Error checking integration status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkIntegrationStatus();
    // Refresh every 30 seconds
    const interval = setInterval(checkIntegrationStatus, 30000);
    return () => clearInterval(interval);
  }, [checkIntegrationStatus]);

  const getIntegrationIcon = (provider) => {
    switch (provider) {
      case 'google':
        return <GoogleCalendarIcon />;
      case 'microsoft':
        return <MicrosoftCalendarIcon />;
      default:
        return <CalendarIcon className="w-5 h-5" />;
    }
  };

  const getIntegrationName = (provider) => {
    switch (provider) {
      case 'google':
        return 'Google Calendar';
      case 'microsoft':
        return 'Microsoft Calendar';
      default:
        return provider;
    }
  };

  // Filter to only show connected integrations
  const connectedIntegrations = Object.entries(integrations).filter(
    ([_, integration]) => integration.connected
  );

  // If no integrations are connected, show a link to settings
  if (!isLoading && connectedIntegrations.length === 0) {
    return (
      <NavLink
        to="/settings/calendar"
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )
        }
      >
        <CalendarIcon className="w-4 h-4" />
        <span>Connect Calendar</span>
      </NavLink>
    );
  }

  return (
    <div className="space-y-2">
      {connectedIntegrations.map(([provider, integration]) => (
        <NavLink
          key={provider}
          to="/settings/calendar"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
              integration.active
                ? "bg-green-50 border border-green-200 text-green-900 hover:bg-green-100"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )
          }
        >
          <div className="relative flex-shrink-0">
            {getIntegrationIcon(provider)}
            {integration.active && (
              <div className="absolute -bottom-1 -right-1">
                <CheckCircle2 className="w-3 h-3 text-green-600 bg-white rounded-full" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {getIntegrationName(provider)}
            </div>
            {integration.active && (
              <div className="text-xs text-green-600 font-medium">Connected</div>
            )}
          </div>
        </NavLink>
      ))}
    </div>
  );
}

export default SidebarCalendarStatus;

