import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Upload, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const ConnectedIntegrations = () => {
  const [integrations, setIntegrations] = useState({
    google: { connected: false, loading: true },
    calendly: { connected: false, loading: true },
    manual: { connected: true, loading: false } // Always available
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  const checkIntegrationStatus = async () => {
    try {
      // Check Google Calendar status
      setIntegrations(prev => ({
        ...prev,
        google: { ...prev.google, loading: true }
      }));

      try {
        const googleResponse = await api.request('/auth/google/status');
        setIntegrations(prev => ({
          ...prev,
          google: { 
            connected: googleResponse.connected || false, 
            loading: false,
            user: googleResponse.user
          }
        }));
      } catch (error) {
        setIntegrations(prev => ({
          ...prev,
          google: { connected: false, loading: false, error: 'Failed to check status' }
        }));
      }

      // Check Calendly status
      setIntegrations(prev => ({
        ...prev,
        calendly: { ...prev.calendly, loading: true }
      }));

      try {
        const calendlyResponse = await api.request('/calendly/status');
        setIntegrations(prev => ({
          ...prev,
          calendly: { 
            connected: calendlyResponse.connected || false, 
            loading: false,
            configured: calendlyResponse.configured || false,
            user: calendlyResponse.user,
            error: calendlyResponse.error
          }
        }));
      } catch (error) {
        setIntegrations(prev => ({
          ...prev,
          calendly: { 
            connected: false, 
            loading: false, 
            configured: false,
            error: 'Failed to check status' 
          }
        }));
      }

    } catch (error) {
      console.error('Error checking integration status:', error);
    }
  };

  const handleCalendlySync = async () => {
    if (!integrations.calendly.connected) return;
    
    setSyncing(true);
    try {
      const response = await api.request('/calendly/sync', {
        method: 'POST'
      });
      
      if (response.success) {
        // Show success message or refresh data
        console.log('Calendly sync successful:', response.message);
      }
    } catch (error) {
      console.error('Error syncing Calendly:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (integration) => {
    if (integration.loading) {
      return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
    }
    if (integration.connected) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusText = (key, integration) => {
    if (integration.loading) return 'Checking...';
    if (key === 'calendly' && !integration.configured) return 'Not configured';
    if (integration.connected) return 'Connected';
    return 'Disconnected';
  };

  const getIntegrationName = (key) => {
    switch (key) {
      case 'google': return 'Google Calendar';
      case 'calendly': return 'Calendly';
      case 'manual': return 'Manual Upload';
      default: return key;
    }
  };

  const getIntegrationIcon = (key) => {
    switch (key) {
      case 'google': 
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'calendly': 
        return <Calendar className="w-4 h-4 text-orange-500" />;
      case 'manual': 
        return <Upload className="w-4 h-4 text-gray-600" />;
      default: 
        return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed State */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 hover:shadow-xl transition-shadow duration-200 flex items-center space-x-2"
        >
          <div className="flex items-center space-x-1">
            {Object.entries(integrations).map(([key, integration]) => (
              <div key={key} className="relative">
                {getStatusIcon(integration)}
              </div>
            ))}
          </div>
          <span className="text-sm font-medium text-gray-700">Integrations</span>
        </button>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Connected Integrations</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={checkIntegrationStatus}
                className="p-1 hover:bg-gray-100 rounded"
                title="Refresh status"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(integrations).map(([key, integration]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getIntegrationIcon(key)}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {getIntegrationName(key)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getStatusText(key, integration)}
                    </div>
                    {integration.user && (
                      <div className="text-xs text-gray-400">
                        {integration.user.email || integration.user.name}
                      </div>
                    )}
                    {integration.error && (
                      <div className="text-xs text-red-500">
                        {integration.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(integration)}
                  {key === 'calendly' && integration.connected && (
                    <button
                      onClick={handleCalendlySync}
                      disabled={syncing}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-50"
                      title="Sync Calendly meetings"
                    >
                      {syncing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Configuration hints */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {!integrations.calendly.configured && (
                <div className="mb-1">
                  💡 Add CALENDLY_PERSONAL_ACCESS_TOKEN to enable Calendly sync
                </div>
              )}
              <div>
                Meetings from all connected sources appear in your meetings list
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectedIntegrations;
