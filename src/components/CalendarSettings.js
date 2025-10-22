import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  Star,
  Power
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export default function CalendarSettings() {
  const { getAccessToken } = useAuth();
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Calendly connection state
  const [showCalendlyForm, setShowCalendlyForm] = useState(false);
  const [calendlyToken, setCalendlyToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = await getAccessToken();
      
      const response = await axios.get(`${API_BASE_URL}/api/calendar-connections`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setConnections(response.data.connections || []);
    } catch (err) {
      console.error('Error loading calendar connections:', err);
      setError('Failed to load calendar connections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (connectionId, provider) => {
    if (!window.confirm(`Are you sure you want to disconnect this ${provider} calendar? Your meetings will not be synced anymore.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      const token = await getAccessToken();
      
      await axios.delete(`${API_BASE_URL}/api/calendar-connections/${connectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`${provider} calendar disconnected successfully`);
      loadConnections();
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      setError(err.response?.data?.error || 'Failed to disconnect calendar');
    }
  };

  const handleToggleSync = async (connectionId, currentStatus) => {
    try {
      setError('');
      setSuccess('');
      const token = await getAccessToken();
      
      await axios.patch(
        `${API_BASE_URL}/api/calendar-connections/${connectionId}/toggle-sync`,
        { sync_enabled: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(`Sync ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      loadConnections();
    } catch (err) {
      console.error('Error toggling sync:', err);
      setError(err.response?.data?.error || 'Failed to toggle sync');
    }
  };

  const handleSetPrimary = async (connectionId) => {
    try {
      setError('');
      setSuccess('');
      const token = await getAccessToken();
      
      await axios.patch(
        `${API_BASE_URL}/api/calendar-connections/${connectionId}/set-primary`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Primary calendar updated successfully');
      loadConnections();
    } catch (err) {
      console.error('Error setting primary calendar:', err);
      setError(err.response?.data?.error || 'Failed to set primary calendar');
    }
  };

  const handleConnectCalendly = async () => {
    if (!calendlyToken.trim()) {
      setError('Please enter your Calendly API token');
      return;
    }

    try {
      setIsConnecting(true);
      setError('');
      setSuccess('');
      const token = await getAccessToken();
      
      await axios.post(
        `${API_BASE_URL}/api/calendar-connections/calendly`,
        { api_token: calendlyToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Calendly connected successfully!');
      setCalendlyToken('');
      setShowCalendlyForm(false);
      loadConnections();
    } catch (err) {
      console.error('Error connecting Calendly:', err);
      setError(err.response?.data?.error || 'Failed to connect Calendly');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnectGoogle = async () => {
    try {
      setError('');
      const token = await getAccessToken();
      
      const response = await axios.get(`${API_BASE_URL}/api/auth/google`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      console.error('Error reconnecting Google Calendar:', err);
      setError('Failed to reconnect Google Calendar');
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'google':
        return '🗓️';
      case 'calendly':
        return '📅';
      case 'outlook':
        return '📧';
      default:
        return '📆';
    }
  };

  const getProviderName = (provider) => {
    switch (provider) {
      case 'google':
        return 'Google Calendar';
      case 'calendly':
        return 'Calendly';
      case 'outlook':
        return 'Outlook Calendar';
      default:
        return provider;
    }
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Calendar Integrations</h2>
        <p className="text-muted-foreground">
          Manage your calendar connections and sync settings
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Connected Calendars */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Connected Calendars</h3>
        
        {connections.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No calendars connected</p>
              <Button onClick={handleReconnectGoogle}>
                <Plus className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>
        ) : (
          connections.map((connection) => (
            <Card key={connection.id} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{getProviderIcon(connection.provider)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">
                          {getProviderName(connection.provider)}
                        </h4>
                        {connection.is_primary && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                            <Star className="w-3 h-3" />
                            Primary
                          </span>
                        )}
                      </div>
                      
                      {connection.provider_account_email && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {connection.provider_account_email}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {connection.is_active ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600">Inactive</span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <RefreshCw className="w-4 h-4" />
                          <span>Last sync: {formatLastSync(connection.last_sync_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!connection.is_primary && connections.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(connection.id)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Set as Primary
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleSync(connection.id, connection.sync_enabled)}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {connection.sync_enabled ? 'Disable Sync' : 'Enable Sync'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id, getProviderName(connection.provider))}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Calendar Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Add Calendar</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Calendar */}
          <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer" onClick={handleReconnectGoogle}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🗓️</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Google Calendar</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect your Google Calendar to sync meetings
                  </p>
                </div>
                <Plus className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Calendly */}
          <Card 
            className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setShowCalendlyForm(!showCalendlyForm)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">📅</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Calendly</h4>
                  <p className="text-sm text-muted-foreground">
                    Can't connect work calendar? Use Calendly instead
                  </p>
                </div>
                <Plus className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendly Connection Form */}
        {showCalendlyForm && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Connect Calendly</CardTitle>
              <CardDescription>
                Enter your Calendly API token to sync your scheduled events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calendly-token">Calendly API Token</Label>
                <Input
                  id="calendly-token"
                  type="password"
                  placeholder="Enter your Calendly API token"
                  value={calendlyToken}
                  onChange={(e) => setCalendlyToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API token from{' '}
                  <a
                    href="https://calendly.com/integrations/api_webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Calendly Settings → Integrations
                  </a>
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConnectCalendly}
                  disabled={isConnecting || !calendlyToken.trim()}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Connect Calendly
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCalendlyForm(false);
                    setCalendlyToken('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

