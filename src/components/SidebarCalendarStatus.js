import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../services/api';
import { CALENDAR_PROVIDER_LOGOS } from '../utils/recallBotStatus';

function SidebarCalendarStatus() {
  const [integrations, setIntegrations] = useState({
    google: { connected: false, active: false },
    microsoft: { connected: false, active: false },
    calendly: { connected: false, active: false, healthy: true }
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkIntegrationStatus = useCallback(async () => {
    try {
      const response = await api.request('/calendar-connections');

      // API returns { success: true, connections: [...] }
      const connections = response.connections || response || [];

      const googleConnection = connections.find(c => c.provider === 'google');
      const microsoftConnection = connections.find(c => c.provider === 'microsoft');
      const calendlyConnection = connections.find(c => c.provider === 'calendly');

      // Check Calendly health if connected
      let calendlyHealthy = true;
      if (calendlyConnection?.is_active) {
        try {
          const healthRes = await api.request('/calendly/status');
          if (healthRes.configured && !healthRes.connected) {
            calendlyHealthy = false;
          }
        } catch {
          // If health check fails, don't mark as unhealthy (could be network issue)
        }
      }

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
        },
        calendly: {
          connected: !!calendlyConnection,
          active: calendlyConnection?.is_active || false,
          email: calendlyConnection?.provider_account_email,
          healthy: calendlyHealthy
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
      case 'calendly':
        return 'Calendly';
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
      {connectedIntegrations.map(([provider, integration]) => {
        const isUnhealthy = provider === 'calendly' && integration.active && !integration.healthy;

        return (
          <div
            key={provider}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
              isUnhealthy
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : integration.active
                  ? "bg-green-50 border border-green-200 text-green-900"
                  : "bg-muted/30 text-muted-foreground"
            )}
          >
            <div className="relative flex-shrink-0">
              {getIntegrationIcon(provider)}
              {isUnhealthy ? (
                <div className="absolute -bottom-1 -right-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 bg-white rounded-full" />
                </div>
              ) : integration.active && (
                <div className="absolute -bottom-1 -right-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {getIntegrationName(provider)}
              </div>
              {isUnhealthy ? (
                <div className="text-xs text-amber-600 font-medium">Connection issue</div>
              ) : integration.active && (
                <div className="text-xs text-green-600 font-medium">Connected</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SidebarCalendarStatus;
