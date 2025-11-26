import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
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
  Zap,
  Clock
} from 'lucide-react';
// import CalendlySyncButton from './CalendlySyncButton';
import CalendlyPlanInfo from './CalendlyPlanInfo';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export default function CalendarSettings() {
  const { getAccessToken } = useAuth();
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCalendlyForm, setShowCalendlyForm] = useState(false);
  const [calendlyToken, setCalendlyToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [calendlyAuthMethod, setCalendlyAuthMethod] = useState('oauth'); // 'oauth' or 'token'
  const [webhookStatus, setWebhookStatus] = useState({});

  useEffect(() => {
    loadConnections();

    // ✅ FIX: Listen for postMessage from OAuth popup windows
    const handleOAuthMessage = (event) => {
      // Accept messages from backend (Render) and frontend (Cloudflare Pages)
      // The popup is hosted on the backend, so we need to accept its origin
      const validOrigins = [
        window.location.origin, // Frontend origin
        'https://adviceapp-9rgw.onrender.com', // Render backend
        'http://localhost:3001', // Local development
      ];

      const isValidOrigin = validOrigins.some(origin => event.origin === origin || event.origin.includes(origin));
      if (!isValidOrigin) {
        console.warn('⚠️ Ignoring postMessage from untrusted origin:', event.origin);
        return;
      }

      if (event.data.type === 'CALENDLY_OAUTH_SUCCESS') {
        console.log('✅ Received CALENDLY_OAUTH_SUCCESS from popup');
        setSuccess('Calendly connected successfully!');
        // Reload connections to show updated status
        setTimeout(() => loadConnections(), 500);
      } else if (event.data.type === 'CALENDLY_OAUTH_ERROR') {
        console.error('❌ Received CALENDLY_OAUTH_ERROR from popup:', event.data.error);
        setError(`Calendly connection failed: ${event.data.error}`);
      } else if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
        console.log('✅ Received GOOGLE_OAUTH_SUCCESS from popup');
        setSuccess('Google Calendar connected successfully!');
        // Reload connections to show updated status
        setTimeout(() => loadConnections(), 500);
      } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
        console.error('❌ Received GOOGLE_OAUTH_ERROR from popup:', event.data.error);
        setError(`Google Calendar connection failed: ${event.data.error}`);
      } else if (event.data.type === 'MICROSOFT_OAUTH_SUCCESS') {
        console.log('✅ Received MICROSOFT_OAUTH_SUCCESS from popup');
        setSuccess('Microsoft Calendar connected successfully!');
        // Reload connections to show updated status
        setTimeout(() => loadConnections(), 500);
      } else if (event.data.type === 'MICROSOFT_OAUTH_ERROR') {
        console.error('❌ Received MICROSOFT_OAUTH_ERROR from popup:', event.data.error);
        setError(`Microsoft Calendar connection failed: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleOAuthMessage);

    // Also check for legacy redirect-based callback (backward compatibility)
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'CalendlyConnected') {
      setSuccess('Calendly connected successfully!');
      setTimeout(() => loadConnections(), 500);
    }

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
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

      const connections = response.data.connections || [];
      setConnections(connections);

      // Load webhook status for each connection
      const statusMap = {};
      for (const conn of connections) {
        try {
          const statusResponse = await axios.get(
            `${API_BASE_URL}/api/calendar-connections/${conn.id}/webhook-status`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          statusMap[conn.id] = statusResponse.data.webhook_status;
        } catch (err) {
          console.warn(`Failed to load webhook status for ${conn.id}:`, err.message);
        }
      }
      setWebhookStatus(statusMap);
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

  const handleSwitchCalendar = async (connectionId, provider) => {
    try {
      setError('');
      setSuccess('');
      const token = await getAccessToken();

      console.log(`🔄 Switching to ${getProviderName(provider)}...`);

      // Activate this connection (which deactivates others)
      await axios.patch(
        `${API_BASE_URL}/api/calendar-connections/${connectionId}/toggle-sync`,
        { sync_enabled: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(`✅ Switched to ${getProviderName(provider)} - Now fetching meetings from this calendar`);

      // Reload connections to show updated status
      setTimeout(() => loadConnections(), 500);
    } catch (err) {
      console.error('Error switching calendar:', err);
      setError(err.response?.data?.error || `Failed to switch to ${getProviderName(provider)}`);
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

      // ✅ If disconnecting Calendly, log out of Calendly to allow fresh re-login
      if (provider.toLowerCase() === 'calendly') {
        console.log('🔓 Disconnecting Calendly - clearing session for fresh re-login...');

        // Step 1: Clear Calendly session via logout endpoint
        try {
          const logoutIframe = document.createElement('iframe');
          logoutIframe.style.display = 'none';
          logoutIframe.src = 'https://calendly.com/logout';
          document.body.appendChild(logoutIframe);

          // Remove iframe after 2 seconds
          setTimeout(() => {
            if (document.body.contains(logoutIframe)) {
              document.body.removeChild(logoutIframe);
            }
            console.log('✅ Calendly session cleared');
          }, 2000);
        } catch (logoutErr) {
          console.warn('⚠️  Could not clear Calendly session via iframe:', logoutErr);
        }

        // Step 2: Clear any cached OAuth popups by opening and closing a fresh one
        // This ensures the next OAuth flow starts completely fresh
        console.log('🔄 Clearing cached OAuth popup...');
        const clearPopup = window.open('about:blank', 'CalendlyOAuth_clear', 'width=1,height=1');
        if (clearPopup) {
          setTimeout(() => {
            try {
              clearPopup.close();
              console.log('✅ Cached OAuth popup cleared');
            } catch (e) {
              console.warn('⚠️  Could not close popup:', e);
            }
          }, 100);
        }
      }

      setSuccess(`${provider} calendar disconnected successfully`);
      loadConnections();
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      setError(err.response?.data?.error || 'Failed to disconnect calendar');
    }
  };

  const handleToggleTranscription = async (connectionId, enabled) => {
    try {
      setError('');
      const token = await getAccessToken();

      await axios.patch(
        `${API_BASE_URL}/api/calendar-connections/${connectionId}/toggle-transcription`,
        { transcription_enabled: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(`✅ Transcription ${enabled ? 'enabled' : 'disabled'} - Recall.ai will ${enabled ? 'automatically record' : 'not record'} your meetings`);

      // Reload connections to show updated status
      setTimeout(() => loadConnections(), 500);
    } catch (err) {
      console.error('Error toggling transcription:', err);
      setError(err.response?.data?.error || 'Failed to update transcription setting');
      // Reload to reset the toggle if it failed
      setTimeout(() => loadConnections(), 500);
    }
  };

  // TEMPORARILY DISABLED: Calendly OAuth handler
  // eslint-disable-next-line no-unused-vars
  const handleConnectCalendlyOAuth = async () => {
    try {
      setIsConnecting(true);
      setError('');
      setSuccess('');
      const token = await getAccessToken();

      // ✅ STEP 1: Prepare OAuth by clearing old session
      console.log('🔓 Step 1: Preparing Calendly OAuth - clearing old session...');
      try {
        await axios.post(
          `${API_BASE_URL}/api/calendar-connections/calendly/prepare-oauth`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ OAuth preparation complete');
      } catch (prepareErr) {
        console.warn('⚠️  OAuth preparation warning:', prepareErr.message);
        // Continue anyway - this is non-critical
      }

      // ✅ STEP 2: Clear Calendly cookies from browser
      console.log('🔓 Step 2: Clearing Calendly browser cookies...');
      // Clear any Calendly-related cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        if (name.toLowerCase().includes('calendly') || name.toLowerCase().includes('auth')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.calendly.com`;
        }
      });
      console.log('✅ Cookies cleared');

      // ✅ STEP 3: Get OAuth URL
      console.log('🔓 Step 3: Getting Calendly OAuth URL...');
      const response = await axios.get(
        `${API_BASE_URL}/api/calendar-connections/calendly/auth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        // Get current user ID from token to pass in state parameter
        const userIdFromToken = await getUserIdFromToken();
        const urlWithState = `${response.data.url}&state=${userIdFromToken}`;

        // ✅ STEP 4: Open OAuth popup with unique name and cache-busting
        // Use unique popup name with timestamp to force fresh window
        // This prevents browser from reusing old popup with cached Calendly session
        const popupName = `CalendlyOAuth_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // ✅ FIX: Open OAuth in popup window instead of full page redirect
        // This keeps the main window intact and returns focus after auth
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        console.log(`🔓 Step 4: Opening fresh Calendly OAuth popup: ${popupName}`);
        const popup = window.open(
          urlWithState,
          popupName,
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup) {
          setError('Popup blocked. Please allow popups for this site and try again.');
          setIsConnecting(false);
          return;
        }

        // Poll for popup closure and reload connections
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            setIsConnecting(false);
            console.log('✅ Calendly OAuth popup closed');
            // Reload connections to show updated status
            setTimeout(() => loadConnections(), 500);
          }
        }, 500);
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

  // TEMPORARILY DISABLED: Calendly token handler
  // eslint-disable-next-line no-unused-vars
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
        // Get current user ID from token to pass in state parameter
        const userIdFromToken = await getUserIdFromToken();
        const urlWithState = `${response.data.url}&state=${userIdFromToken}`;

        // ✅ FIX: Open OAuth in popup window instead of full page redirect
        // This keeps the main window intact and returns focus after auth
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          urlWithState,
          'GoogleOAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup) {
          setError('Popup blocked. Please allow popups for this site and try again.');
          return;
        }

        // Poll for popup closure and reload connections
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            // Reload connections to show updated status
            setTimeout(() => loadConnections(), 500);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error reconnecting Google Calendar:', err);
      setError('Failed to reconnect Google Calendar');
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      setError('');
      const token = await getAccessToken();

      const response = await axios.get(`${API_BASE_URL}/api/auth/microsoft`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.url) {
        // Get current user ID from token to pass in state parameter
        const userIdFromToken = await getUserIdFromToken();
        const urlWithState = `${response.data.url}&state=${userIdFromToken}`;

        // Open OAuth in popup window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          urlWithState,
          'MicrosoftOAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup) {
          setError('Popup blocked. Please allow popups for this site and try again.');
          return;
        }

        // Poll for popup closure and reload connections
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            // Reload connections to show updated status
            setTimeout(() => loadConnections(), 500);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error connecting Microsoft Calendar:', err);
      setError('Failed to connect Microsoft Calendar');
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'google':
        return '🗓️';
      case 'calendly':
        return '📅';
      case 'outlook':
      case 'microsoft':
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
      case 'microsoft':
        return 'Microsoft Calendar';
      default:
        return provider;
    }
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

      {/* Calendar Status Overview - Show all calendars */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Your Calendars</h3>
        <p className="text-sm text-muted-foreground">
          Select which calendar to sync meetings from
        </p>

        {connections.length === 0 ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No calendars connected</p>
              <p className="text-sm text-muted-foreground mb-6">Connect a calendar to start syncing your meetings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <Card
                key={connection.id}
                className={`border-2 transition-all cursor-pointer ${
                  connection.is_active
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-border/50 bg-muted/20 hover:border-border'
                }`}
                onClick={() => {
                  if (!connection.is_active) {
                    handleSwitchCalendar(connection.id, connection.provider);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Icon and Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-3xl flex-shrink-0">{getProviderIcon(connection.provider)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-semibold ${connection.is_active ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                            {getProviderName(connection.provider)}
                          </h4>
                          {connection.is_active ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full flex-shrink-0 animate-pulse">
                              <Zap className="w-3 h-3" />
                              ACTIVE - Fetching Meetings
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-200/50 text-gray-600 text-xs font-medium rounded-full flex-shrink-0">
                              <CheckCircle className="w-3 h-3" />
                              Connected
                            </span>
                          )}
                        </div>
                        {connection.provider_account_email && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {connection.provider_account_email}
                          </p>
                        )}

                        {/* Webhook Status */}
                        {connection.is_active && webhookStatus[connection.id] && (
                          <div className="mt-2 flex items-center gap-1">
                            {webhookStatus[connection.id].sync_method === 'webhook' ? (
                              <>
                                <Zap className="w-3 h-3 text-blue-600" />
                                <span className="text-xs text-blue-600 font-medium">⚡ Real-time sync active</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span className="text-xs text-amber-600 font-medium">🕐 Polling sync (15 min)</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Last Sync Time */}
                        {connection.is_active && connection.last_sync_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last synced: {new Date(connection.last_sync_at).toLocaleTimeString()}
                          </p>
                        )}

                        {/* Transcription Toggle */}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`transcription-${connection.id}`}
                            checked={connection.transcription_enabled || false}
                            onChange={(e) => handleToggleTranscription(connection.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label
                            htmlFor={`transcription-${connection.id}`}
                            className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                          >
                            <span>🎙️ Auto-record with Recall.ai</span>
                          </label>
                        </div>

                        {/* TEMPORARILY DISABLED: Calendly Plan Info & Sync Button */}
                        {/* {connection.is_active && connection.provider === 'calendly' && (
                          <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <CalendlyPlanInfo
                              variant="compact"
                              hasWebhook={webhookStatus[connection.id]?.has_webhook || false}
                            />

                            {!webhookStatus[connection.id]?.has_webhook && (
                              <CalendlySyncButton
                                connectionId={connection.id}
                                onSyncComplete={() => loadConnections()}
                                variant="outline"
                                size="sm"
                                showEstimate={true}
                              />
                            )}
                          </div>
                        )} */}
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      {connection.is_active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect(connection.id, getProviderName(connection.provider));
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 whitespace-nowrap"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchCalendar(connection.id, connection.provider);
                          }}
                          className="whitespace-nowrap bg-blue-600 hover:bg-blue-700"
                        >
                          Switch to This
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Reconnect Calendar Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {connections.length === 0 ? 'Connect a Calendar' : 'Add Another Calendar'}
        </h3>

        {connections.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Add another calendar to switch between them
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Calendar */}
          {!connections.some(c => c.provider === 'google') ? (
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
                      Connect to sync meetings
                    </p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🗓️</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">Google Calendar</h4>
                    <p className="text-sm text-green-600">
                      ✓ Connected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendly */}
          {!connections.some(c => c.provider === 'calendly') ? (
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
                      Connect to sync meetings
                    </p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">📅</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">Calendly</h4>
                    <p className="text-sm text-green-600">
                      ✓ Connected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Microsoft Calendar */}
          {!connections.some(c => c.provider === 'microsoft' || c.provider === 'outlook') ? (
            <Card
              className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={handleConnectMicrosoft}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">📧</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">Microsoft Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect to sync meetings
                    </p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">📧</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">Microsoft Calendar</h4>
                    <p className="text-sm text-green-600">
                      ✓ Connected
                    </p>
                  </div>
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
              <CalendlyPlanInfo variant="settings" hasWebhook={false} showSyncButton={true} />

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
        )} */}
      </div>
    </div>
  );
}

