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
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  Power,
  Clock
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendlyAuthMethod, setCalendlyAuthMethod] = useState('oauth'); // 'oauth' or 'token'

  useEffect(() => {
    loadConnections();

    // Check if redirected from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'CalendlyConnected') {
      setSuccess('Calendly connected successfully!');
      // Reload connections to show updated status
      setTimeout(() => loadConnections(), 500);
    }
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

      // Provide more helpful error messages
      if (err.response?.status === 404) {
        setError('Calendar settings endpoint not found. The backend may still be deploying. Please wait a moment and refresh.');
      } else if (err.response?.status === 503) {
        setError('Database service unavailable. Please try again in a moment.');
      } else {
        setError(err.response?.data?.error || 'Failed to load calendar connections');
      }
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

  const handleConnectCalendlyOAuth = async () => {
    try {
      setIsConnecting(true);
      setError('');
      setSuccess('');
      const token = await getAccessToken();

      const response = await axios.get(
        `${API_BASE_URL}/api/calendar-connections/calendly/auth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        // Get current user ID from token to pass in state parameter
        // This ensures the OAuth callback knows which user is connecting
        const userIdFromToken = await getUserIdFromToken();
        const urlWithState = `${response.data.url}&state=${userIdFromToken}`;
        window.location.href = urlWithState;
      }
    } catch (err) {
      console.error('Error connecting Calendly via OAuth:', err);
      setError(err.response?.data?.error || 'Failed to connect Calendly');
      setIsConnecting(false);
    }
  };

  const getUserIdFromToken = async () => {
    try {
      const token = await getAccessToken();
      // Decode JWT to get user ID
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      return payload.sub || payload.id || '';
    } catch (err) {
      console.error('Error extracting user ID from token:', err);
      return '';
    }
  };

  const handleConnectCalendlyToken = async () => {
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
      setCalendlyAuthMethod('oauth');
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

  const handleReconnectCalendly = async () => {
    try {
      setIsConnecting(true);
      setError('');
      setSuccess('');
      const token = await getAccessToken();

      const response = await axios.get(
        `${API_BASE_URL}/api/calendar-connections/calendly/auth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        // Get current user ID from token to pass in state parameter
        const userIdFromToken = await getUserIdFromToken();
        const urlWithState = `${response.data.url}&state=${userIdFromToken}`;
        window.location.href = urlWithState;
      }
    } catch (err) {
      console.error('Error reconnecting Calendly:', err);
      setError(err.response?.data?.error || 'Failed to reconnect Calendly');
      setIsConnecting(false);
    }
  };

  const handleManualSyncCalendly = async () => {
    try {
      setIsSyncing(true);
      setError('');
      setSuccess('');
      const token = await getAccessToken();

      const response = await axios.post(
        `${API_BASE_URL}/api/calendly/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Calendly sync started. Meetings will be updated shortly.');
      // Reload connections after a short delay to show updated sync status
      setTimeout(() => loadConnections(), 2000);
    } catch (err) {
      console.error('Error syncing Calendly:', err);
      setError(err.response?.data?.error || 'Failed to sync Calendly meetings');
    } finally {
      setIsSyncing(false);
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

      {/* Current Connection Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Current Connection</h3>

        {connections.length === 0 ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No calendar connected</p>
              <p className="text-sm text-muted-foreground mb-6">Connect a calendar to start syncing your meetings</p>
              <Button onClick={handleReconnectGoogle} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Show only active connections (should be max 1)
          connections
            .filter(conn => conn.is_active)
            .map((connection) => (
              <Card key={connection.id} className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{getProviderIcon(connection.provider)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-foreground text-lg">
                            {getProviderName(connection.provider)}
                          </h4>
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-600 text-xs font-medium rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Connected
                          </span>
                        </div>

                        {connection.provider_account_email && (
                          <p className="text-sm text-muted-foreground mb-3">
                            <span className="font-medium">Account:</span> {connection.provider_account_email}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Last sync: {formatLastSync(connection.last_sync_at)}</span>
                          </div>

                          {connection.sync_enabled && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span>Sync enabled</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {connection.provider === 'calendly' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleManualSyncCalendly}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Manual Sync
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReconnectCalendly}
                            disabled={isConnecting}
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Reconnecting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Reconnect
                              </>
                            )}
                          </Button>
                        </>
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

      {/* Switch Calendar Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {connections.length > 0 ? 'Switch Calendar' : 'Add Calendar'}
        </h3>

        {connections.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Connecting a different calendar will disconnect your current one
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Calendar */}
          <Card
            className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={handleReconnectGoogle}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🗓️</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Google Calendar</h4>
                  <p className="text-sm text-muted-foreground">
                    {connections.some(c => c.provider === 'google' && c.is_active)
                      ? 'Currently connected'
                      : 'Connect your Google Calendar to sync meetings'}
                  </p>
                </div>
                <Plus className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Calendly - Only show if NOT already connected */}
          {!connections.some(c => c.provider === 'calendly' && c.is_active) && (
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
          )}
        </div>

        {/* Calendly Connection Form */}
        {showCalendlyForm && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Connect Calendly</CardTitle>
              <CardDescription>
                Choose how you'd like to connect your Calendly account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Authentication Method Selection */}
              <div className="space-y-3">
                <Label>Connection Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCalendlyAuthMethod('oauth')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      calendlyAuthMethod === 'oauth'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold text-sm">OAuth (Recommended)</div>
                    <div className="text-xs text-muted-foreground">Secure & easy</div>
                  </button>
                  <button
                    onClick={() => setCalendlyAuthMethod('token')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      calendlyAuthMethod === 'token'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold text-sm">API Token</div>
                    <div className="text-xs text-muted-foreground">Manual setup</div>
                  </button>
                </div>
              </div>

              {/* OAuth Method */}
              {calendlyAuthMethod === 'oauth' && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Click the button below to authorize Advicly with your Calendly account. You'll be redirected to Calendly to approve access.
                  </p>
                  <Button
                    onClick={handleConnectCalendlyOAuth}
                    disabled={isConnecting}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecting to Calendly...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Connect with Calendly OAuth
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Token Method */}
              {calendlyAuthMethod === 'token' && (
                <div className="space-y-4">
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
                      onClick={handleConnectCalendlyToken}
                      disabled={isConnecting || !calendlyToken.trim()}
                      className="flex-1"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Connect with Token
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Cancel Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowCalendlyForm(false);
                  setCalendlyToken('');
                  setCalendlyAuthMethod('oauth');
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

