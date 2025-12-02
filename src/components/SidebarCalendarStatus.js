import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../services/api';
import { CALENDAR_PROVIDER_LOGOS } from '../utils/recallBotStatus';

function SidebarCalendarStatus() {
  const [integrations, setIntegrations] = useState({
    google: { connected: false, active: false },
    microsoft: { connected: false, active: false }
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkIntegrationStatus = useCallback(async () => {
    try {
      const response = await api.request('/calendar-connections');

      // API returns { success: true, connections: [...] }
      const connections = response.connections || response || [];

      const googleConnection = connections.find(c => c.provider === 'google');
      const microsoftConnection = connections.find(c => c.provider === 'microsoft');

      setIntegrations({
        google: {
          connected: !!googleConnection,
          active: googleConnection?.is_active || false,
          email: googleConnection?.provider_account_email
        },
        microsoft: {
          connected: !!microsoftConnection,
          active: microsoftConnection?.is_active || false,
          email: microsoftConnection?.provider_account_email
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
    const logoUrl = CALENDAR_PROVIDER_LOGOS[provider];
    if (logoUrl) {
      return <img src={logoUrl} alt={provider} className="w-5 h-5 object-contain" />;
    }
    return <CalendarIcon className="w-5 h-5" />;
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

  // If no integrations are connected, don't show anything
  if (!isLoading && connectedIntegrations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {connectedIntegrations.map(([provider, integration]) => (
        <div
          key={provider}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
            integration.active
              ? "bg-green-50 border border-green-200 text-green-900"
              : "bg-muted/30 text-muted-foreground"
          )}
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
        </div>
      ))}
    </div>
  );
}

export default SidebarCalendarStatus;

