import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
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
  Clock,
  Users,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import CalendlySyncButton from './CalendlySyncButton';
import CalendlyPlanInfo from './CalendlyPlanInfo';
import { CALENDAR_PROVIDER_LOGOS } from '../utils/recallBotStatus';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Sync Progress Modal Component
function SyncProgressModal({ isOpen, syncProgress, onClose }) {
  if (!isOpen) return null;

  const { phase, meetingsFound, clientsDiscovered, isComplete, error, syncMethod, webhookMessage } = syncProgress;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3">
            {!isComplete && !error && (
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                <Sparkles className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            )}
            {isComplete && !error && (
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            )}
            {error && (
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">
                {error ? 'Sync Error' : isComplete ? 'Sync Complete!' : 'Syncing Calendly...'}
              </h3>
              <p className="text-sm text-white/80">
                {error ? 'Something went wrong' : isComplete ? 'Your data is ready' : phase}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error ? (
            <div className="text-center py-4">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Meetings Counter */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Meetings Found</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {meetingsFound > 0 ? (
                      <span className="animate-in slide-in-from-bottom-2 duration-300">
                        {meetingsFound}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                {meetingsFound > 0 && !isComplete && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Clients Counter */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Clients Discovered</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {clientsDiscovered > 0 ? (
                      <span className="animate-in slide-in-from-bottom-2 duration-300">
                        {clientsDiscovered}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                {clientsDiscovered > 0 && !isComplete && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sync Method Status */}
              {(syncMethod || webhookMessage) && (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  syncMethod === 'realtime'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    syncMethod === 'realtime' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    {syncMethod === 'realtime' ? '⚡' : '⏱️'}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      syncMethod === 'realtime' ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {syncMethod === 'realtime' ? 'Real-time Sync' : 'Polling Sync'}
                    </p>
                    <p className={`text-xs ${
                      syncMethod === 'realtime' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {webhookMessage || (syncMethod === 'realtime'
                        ? 'Events sync instantly via webhooks'
                        : 'Events sync every 15 minutes')}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress message */}
              {!isComplete && (
                <p className="text-center text-sm text-muted-foreground animate-pulse">
                  {phase === 'Connecting to Calendly...' && 'Establishing connection...'}
                  {phase === 'Fetching meetings...' && 'Retrieving your meeting history...'}
                  {phase === 'Processing meetings...' && 'Extracting client information...'}
                  {phase === 'Finalizing...' && 'Almost done...'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(isComplete || error) && (
          <div className="px-6 pb-6">
            <Button onClick={onClose} className="w-full">
              {error ? 'Close' : 'Done'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarSettings() {
  const { getAccessToken } = useAuth();
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCalendlyForm, setShowCalendlyForm] = useState(false);
  const [calendlyToken, setCalendlyToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  // calendlyAuthMethod removed - now using API token only
  const [webhookStatus, setWebhookStatus] = useState({});

  // Sync progress state
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    phase: 'Connecting to Calendly...',
    meetingsFound: 0,
    clientsDiscovered: 0,
    isComplete: false,
    error: null
  });

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

      // Note: Calendly uses API token connection (no OAuth popup needed)
      if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
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

      setSuccess(`✅ Transcription ${enabled ? 'enabled' : 'disabled'} - Advicly Assistant will ${enabled ? 'automatically record' : 'not record'} your meetings`);

      // Reload connections to show updated status
      setTimeout(() => loadConnections(), 500);
    } catch (err) {
      console.error('Error toggling transcription:', err);
      setError(err.response?.data?.error || 'Failed to update transcription setting');
      // Reload to reset the toggle if it failed
      setTimeout(() => loadConnections(), 500);
    }
  };

  // OAuth handler removed - now using API token only

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

  // Poll for sync progress
  const pollSyncProgress = useCallback(async (token) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    const poll = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/calendly/sync-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { meetings_count, clients_count, is_syncing } = response.data;

        setSyncProgress(prev => ({
          ...prev,
          phase: is_syncing ? 'Processing meetings...' : 'Finalizing...',
          meetingsFound: meetings_count || prev.meetingsFound,
          clientsDiscovered: clients_count || prev.clientsDiscovered,
        }));

        // Check if sync is complete
        if (!is_syncing && (meetings_count > 0 || attempts > 10)) {
          setSyncProgress(prev => ({
            ...prev,
            isComplete: true,
            phase: 'Complete!'
          }));
          return; // Stop polling
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          // Timeout - consider it complete
          setSyncProgress(prev => ({
            ...prev,
            isComplete: true,
            phase: 'Complete!'
          }));
        }
      } catch (err) {
        console.warn('Error polling sync status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Retry with longer delay on error
        }
      }
    };

    // Start polling after a short delay to let backend start syncing
    setTimeout(poll, 1500);
  }, []);

  // Calendly token handler with sync animation
  const handleConnectCalendlyToken = async () => {
    if (!calendlyToken.trim()) {
      setError('Please enter your Calendly API token');
      return;
    }

    try {
      setIsConnecting(true);
      setError('');
      setSuccess('');

      // Show sync progress modal
      setShowSyncProgress(true);
      setSyncProgress({
        phase: 'Connecting to Calendly...',
        meetingsFound: 0,
        clientsDiscovered: 0,
        isComplete: false,
        error: null
      });

      const token = await getAccessToken();

      // Update phase
      setSyncProgress(prev => ({ ...prev, phase: 'Validating token...' }));

      const response = await axios.post(
        `${API_BASE_URL}/api/calendar-connections/calendly`,
        { api_token: calendlyToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update phase to show webhook status
      const webhookData = response.data.webhook;
      if (webhookData) {
        const webhookMessage = webhookData.created
          ? '✅ Real-time sync enabled! Events sync instantly.'
          : webhookData.sync_method === 'polling'
            ? '⏱️ Polling sync enabled. Events sync every 15 minutes.'
            : 'Checking sync method...';

        setSyncProgress(prev => ({
          ...prev,
          phase: 'Fetching meetings...',
          webhookStatus: webhookData.status,
          syncMethod: webhookData.sync_method,
          webhookMessage
        }));
      } else {
        setSyncProgress(prev => ({ ...prev, phase: 'Fetching meetings...' }));
      }

      // If response includes sync stats, update immediately
      if (response.data.sync_stats) {
        setSyncProgress(prev => ({
          ...prev,
          meetingsFound: response.data.sync_stats.meetings_synced || 0,
          clientsDiscovered: response.data.sync_stats.clients_created || 0,
        }));
      }

      // Start polling for sync progress
      pollSyncProgress(token);

      setCalendlyToken('');
      setShowCalendlyForm(false);

      // Don't show success message - the modal handles it
      // loadConnections will be called when modal closes
    } catch (err) {
      console.error('Error connecting Calendly:', err);
      setSyncProgress(prev => ({
        ...prev,
        error: err.response?.data?.error || 'Failed to connect Calendly',
        isComplete: true
      }));
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle sync modal close
  const handleSyncModalClose = () => {
    setShowSyncProgress(false);
    loadConnections(); // Refresh connections after sync
    if (!syncProgress.error) {
      setSuccess('Calendly connected and synced successfully!');
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
    const logoUrl = CALENDAR_PROVIDER_LOGOS[provider] || CALENDAR_PROVIDER_LOGOS[provider === 'microsoft' ? 'outlook' : provider];
    if (logoUrl) {
      return <img src={logoUrl} alt={provider} className="w-8 h-8 object-contain" />;
    }
    return <Calendar className="w-8 h-8 text-muted-foreground" />;
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
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground">🎙️ Auto-record with Advicly Assistant</span>
                            </div>
                            <Switch
                              checked={connection.transcription_enabled || false}
                              onCheckedChange={(checked) => handleToggleTranscription(connection.id, checked)}
                              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400"
                            />
                          </div>

                          {/* Bot Name Display (Read-only) */}
                          {connection.transcription_enabled && (
                            <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/50">
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                Bot name (appears in your meeting)
                              </Label>
                              <Input
                                type="text"
                                value="Advicly Notetaker"
                                readOnly
                                disabled
                                className="bg-muted/30 text-sm cursor-not-allowed border-none h-8"
                              />
                            </div>
                          )}
                        </div>

                        {connection.is_active && connection.provider === 'calendly' && (
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
                        )}
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
                  <img src={CALENDAR_PROVIDER_LOGOS.google} alt="Google Calendar" className="w-10 h-10 object-contain" />
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
                  <img src={CALENDAR_PROVIDER_LOGOS.google} alt="Google Calendar" className="w-10 h-10 object-contain" />
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
                  <img src={CALENDAR_PROVIDER_LOGOS.calendly} alt="Calendly" className="w-10 h-10 object-contain" />
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
                  <img src={CALENDAR_PROVIDER_LOGOS.calendly} alt="Calendly" className="w-10 h-10 object-contain" />
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
                  <img src={CALENDAR_PROVIDER_LOGOS.outlook} alt="Microsoft Calendar" className="w-10 h-10 object-contain" />
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
                  <img src={CALENDAR_PROVIDER_LOGOS.outlook} alt="Microsoft Calendar" className="w-10 h-10 object-contain" />
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

      </div>

      {/* Calendly Connection Modal */}
      {showCalendlyForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header - matches SyncProgressModal style */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Connect Calendly</h3>
                  <p className="text-sm text-white/80">Sync your scheduling data</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Token Input */}
              <div className="space-y-2">
                <Label htmlFor="calendly-token" className="text-foreground font-medium">
                  Calendly API Token
                </Label>
                <Input
                  id="calendly-token"
                  type="password"
                  placeholder="Enter your Calendly API token"
                  value={calendlyToken}
                  onChange={(e) => setCalendlyToken(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API token from{' '}
                  <a
                    href="https://calendly.com/integrations/api_webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Calendly Settings → Integrations
                  </a>
                </p>
              </div>

              {/* Info about sync methods */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-foreground">Paid plans</span>
                  <span className="text-xs text-muted-foreground">- Real-time sync via webhooks</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-foreground">Free plan</span>
                  <span className="text-xs text-muted-foreground">- Auto-syncs every 15 min</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              <Button
                onClick={handleConnectCalendlyToken}
                disabled={isConnecting || !calendlyToken.trim()}
                className="w-full"
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
                className="w-full"
                onClick={() => {
                  setShowCalendlyForm(false);
                  setCalendlyToken('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncProgress}
        syncProgress={syncProgress}
        onClose={handleSyncModalClose}
      />
    </div>
  );
}

