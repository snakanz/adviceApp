import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
// TEMPORARILY DISABLED: Calendly integration hidden from UI
// import { Input } from '../../components/ui/input';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
// TEMPORARILY DISABLED: Calendly integration hidden from UI
// import CalendlyPlanInfo from '../../components/CalendlyPlanInfo';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step3_CalendarSetup = ({ data, onNext, onBack }) => {
    const { getAccessToken, user } = useAuth();
    const [selectedProvider, setSelectedProvider] = useState(data.calendar_provider || null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    // TEMPORARILY DISABLED: Calendly state
    // const [calendlyToken, setCalendlyToken] = useState('');
    // const [showTokenInput, setShowTokenInput] = useState(false);
    const [enableTranscription, setEnableTranscription] = useState(false);
    const [connectionTimeout, setConnectionTimeout] = useState(null);

    // Listen for OAuth messages from popup windows
    useEffect(() => {
        const handleOAuthMessage = (event) => {
            // Verify origin for security - accept from localhost, advicly domains, and render.com
            const validOrigins = ['localhost', 'advicly', 'render.com', 'onrender.com'];
            const isValidOrigin = validOrigins.some(origin => event.origin.includes(origin));

            if (!isValidOrigin) {
                console.warn('⚠️ Ignoring message from invalid origin:', event.origin);
                return;
            }

            console.log('📨 Received message from popup:', event.data);

            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
                console.log('✅ Google Calendar OAuth successful');
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setIsConnected(true);
                setIsConnecting(false);
                setError('');
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
                console.error('❌ Google Calendar OAuth error:', event.data.error);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setError(event.data.error || 'Failed to connect to Google Calendar');
                setIsConnecting(false);
            } else if (event.data.type === 'MICROSOFT_OAUTH_SUCCESS') {
                console.log('✅ Microsoft Calendar OAuth successful');
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setIsConnected(true);
                setIsConnecting(false);
                setError('');
            } else if (event.data.type === 'MICROSOFT_OAUTH_ERROR') {
                console.error('❌ Microsoft Calendar OAuth error:', event.data.error);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setError(event.data.error || 'Failed to connect to Microsoft Calendar');
                setIsConnecting(false);
            } else if (event.data.type === 'CALENDLY_OAUTH_SUCCESS') {
                console.log('✅ Calendly OAuth successful');
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setIsConnected(true);
                setIsConnecting(false);
                setError('');
            } else if (event.data.type === 'CALENDLY_OAUTH_ERROR') {
                console.error('❌ Calendly OAuth error:', event.data.error);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                setError(event.data.error || 'Failed to connect to Calendly');
                setIsConnecting(false);
            }
        };

        window.addEventListener('message', handleOAuthMessage);
        return () => {
            window.removeEventListener('message', handleOAuthMessage);
            if (connectionTimeout) clearTimeout(connectionTimeout);
        };
    }, [connectionTimeout]);

    // Check if already connected on mount (from auto-connect)
    useEffect(() => {
        checkForExistingConnection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check if already connected when provider is selected
    useEffect(() => {
        if (selectedProvider) {
            checkConnectionStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProvider]);

    const checkForExistingConnection = async () => {
        try {
            const token = await getAccessToken();

            // Check if Google Calendar is already connected (from auto-connect)
            const googleResponse = await axios.get(
                `${API_BASE_URL}/api/auth/google/status`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (googleResponse.data.connected) {
                console.log('✅ Google Calendar already connected (auto-connect)');
                setSelectedProvider('google');
                setIsConnected(true);
                // Don't auto-skip - let user see they're connected and choose to continue
            }
        } catch (err) {
            console.error('Error checking for existing connection:', err);
        }
    };

    const checkConnectionStatus = async () => {
        try {
            const token = await getAccessToken();

            if (selectedProvider === 'google') {
                const response = await axios.get(
                    `${API_BASE_URL}/api/auth/google/status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsConnected(response.data.connected);
            } else if (selectedProvider === 'microsoft') {
                const response = await axios.get(
                    `${API_BASE_URL}/api/auth/microsoft/status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsConnected(response.data.connected);
            } else if (selectedProvider === 'calendly') {
                const response = await axios.get(
                    `${API_BASE_URL}/api/calendly/status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsConnected(response.data.connected);
            }
        } catch (err) {
            console.error('Error checking connection status:', err);
        }
    };

    const handleGoogleConnect = async () => {
        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();

            // Get OAuth URL from auth endpoint with state parameter for popup mode
            // This endpoint returns a URL that can be used for popup-based OAuth
            const response = await axios.get(
                `${API_BASE_URL}/api/auth/google?state=${user.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.url && user?.id) {
                // OAuth URL already includes state parameter from backend
                const oauthUrl = response.data.url;

                // Open OAuth in popup window instead of full-page redirect
                // IMPORTANT: Must open popup synchronously in response to user click
                // to avoid browser popup blocker converting it to a new tab
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;

                const popup = window.open(
                    oauthUrl,
                    'Google Calendar OAuth',
                    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
                );

                if (!popup || popup.closed) {
                    setError('Popup blocked. Please allow popups and try again.');
                    setIsConnecting(false);
                } else {
                    console.log('✅ Google OAuth popup opened successfully');

                    // Set 30-second timeout for OAuth completion
                    const timeout = setTimeout(() => {
                        if (isConnecting) {
                            console.warn('⚠️ OAuth connection timed out after 30 seconds');
                            setError('Connection timed out. The backend may be starting up. Please try again in a moment.');
                            setIsConnecting(false);
                        }
                    }, 30000);

                    setConnectionTimeout(timeout);
                }
            }
        } catch (err) {
            console.error('Error connecting to Google:', err);
            setError('Failed to connect to Google Calendar');
            setIsConnecting(false);
        }
    };

    const handleMicrosoftConnect = async () => {
        setIsConnecting(true);
        setError('');

        try {
            console.log('🔵 Starting Microsoft OAuth flow...');
            const token = await getAccessToken();
            console.log('✅ Access token obtained');

            // Get OAuth URL from auth endpoint with state parameter for popup mode
            console.log('📡 Requesting OAuth URL from backend...');
            const response = await axios.get(
                `${API_BASE_URL}/api/auth/microsoft?state=${user.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('📥 Backend response:', response.data);

            if (!response.data.url) {
                console.error('❌ No OAuth URL in response:', response.data);
                setError('Failed to get Microsoft OAuth URL. Please try again.');
                setIsConnecting(false);
                return;
            }

            if (!user?.id) {
                console.error('❌ No user ID available');
                setError('User session error. Please refresh and try again.');
                setIsConnecting(false);
                return;
            }

            // OAuth URL already includes state parameter from backend
            const oauthUrl = response.data.url;
            console.log('🔗 OAuth URL received (length:', oauthUrl.length, ')');
            console.log('🔗 OAuth URL preview:', oauthUrl.substring(0, 100) + '...');

            // Open OAuth in popup window instead of full-page redirect
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            console.log('🪟 Opening popup window...');
            const popup = window.open(
                oauthUrl,
                'Microsoft Calendar OAuth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
            );

            if (!popup || popup.closed) {
                console.error('❌ Popup was blocked or failed to open');
                setError('Popup blocked. Please allow popups and try again.');
                setIsConnecting(false);
            } else {
                console.log('✅ Microsoft OAuth popup opened successfully');
                console.log('🪟 Popup object:', popup);

                // Monitor popup to see if it closes unexpectedly
                const popupMonitor = setInterval(() => {
                    if (popup.closed) {
                        console.log('🪟 Popup was closed');
                        clearInterval(popupMonitor);
                        if (isConnecting) {
                            console.warn('⚠️ Popup closed without completing OAuth');
                            setError('OAuth window was closed. Please try again.');
                            setIsConnecting(false);
                        }
                    }
                }, 500);

                // Set 30-second timeout for OAuth completion
                const timeout = setTimeout(() => {
                    clearInterval(popupMonitor);
                    if (isConnecting) {
                        console.warn('⚠️ OAuth connection timed out after 30 seconds');
                        setError('Connection timed out. Please try again.');
                        setIsConnecting(false);
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                    }
                }, 30000);

                setConnectionTimeout(timeout);
            }
        } catch (err) {
            console.error('❌ Error connecting to Microsoft:', err);
            console.error('  - Error message:', err.message);
            console.error('  - Error response:', err.response?.data);
            console.error('  - Error status:', err.response?.status);

            let errorMessage = 'Failed to connect to Microsoft Calendar';
            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            setIsConnecting(false);
        }
    };

    // TEMPORARILY DISABLED: Calendly OAuth handler
    // eslint-disable-next-line no-unused-vars
    const handleCalendlyOAuthConnect = async () => {
        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();
            const response = await axios.get(
                `${API_BASE_URL}/api/calendar/calendly/auth-url`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.url && user?.id) {
                // Add state parameter with user ID for popup-based flow
                const oauthUrl = `${response.data.url}&state=${user.id}`;

                // Open OAuth in popup window instead of full-page redirect
                // IMPORTANT: Must open popup synchronously in response to user click
                // to avoid browser popup blocker converting it to a new tab
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;

                const popup = window.open(
                    oauthUrl,
                    'Calendly OAuth',
                    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
                );

                if (!popup || popup.closed) {
                    setError('Popup blocked. Please allow popups and try again.');
                    setIsConnecting(false);
                } else {
                    console.log('✅ Calendly OAuth popup opened successfully');

                    // Set 30-second timeout for OAuth completion
                    const timeout = setTimeout(() => {
                        if (isConnecting) {
                            console.warn('⚠️ OAuth connection timed out after 30 seconds');
                            setError('Connection timed out. The backend may be starting up. Please try again in a moment.');
                            setIsConnecting(false);
                        }
                    }, 30000);

                    setConnectionTimeout(timeout);
                }
            }
        } catch (err) {
            console.error('Error connecting to Calendly via OAuth:', err);
            setError(err.response?.data?.error || 'Failed to connect to Calendly');
            setIsConnecting(false);
        }
    };

    // TEMPORARILY DISABLED: Calendly token handler
    // eslint-disable-next-line no-unused-vars
    const handleCalendlyTokenConnect = async () => {
        // if (!calendlyToken.trim()) {
        //     setError('Please enter your Calendly API token');
        //     return;
        // }
        }

        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();
            await axios.post(
                `${API_BASE_URL}/api/calendar-connections/calendly`,
                { api_token: calendlyToken },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setIsConnected(true);
            setIsConnecting(false);
        } catch (err) {
            console.error('Error connecting to Calendly:', err);
            setError(err.response?.data?.error || 'Failed to connect to Calendly');
            setIsConnecting(false);
        }
    };

    const handleContinue = async () => {
        if (selectedProvider && isConnected) {
            // If transcription is enabled, update the calendar connection
            if (enableTranscription) {
                try {
                    const token = await getAccessToken();

                    // Get the active calendar connection ID
                    const connectionsResponse = await axios.get(
                        `${API_BASE_URL}/api/calendar-connections`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    const activeConnection = connectionsResponse.data.find(
                        conn => conn.is_active && conn.provider === selectedProvider
                    );

                    if (activeConnection) {
                        // Enable transcription for this connection
                        await axios.patch(
                            `${API_BASE_URL}/api/calendar-connections/${activeConnection.id}/toggle-transcription`,
                            { transcription_enabled: true },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        console.log('✅ Transcription enabled for calendar connection');
                    }
                } catch (err) {
                    console.error('Error enabling transcription:', err);
                    // Don't block the flow if transcription update fails
                }
            }

            onNext({
                calendar_provider: selectedProvider,
                enable_transcription: enableTranscription
            });
        }
    };

    const handleSkip = () => {
        onNext({
            calendar_provider: null,
            enable_transcription: false
        });
    };

    const handleSelectProvider = (provider) => {
        setSelectedProvider(provider);
        setIsConnected(false);
        setError('');
        setShowTokenInput(false);
        setCalendlyToken('');
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* LEFT COLUMN - Content */}
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-foreground">
                            {!selectedProvider ? 'Which calendar do you use?' : 'Connect your calendar'}
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {!selectedProvider
                                ? 'Select your primary calendar provider or skip to set up later'
                                : selectedProvider === 'google'
                                ? 'Authorize Advicly to access your Google Calendar'
                                : selectedProvider === 'microsoft'
                                ? 'Authorize Advicly to access your Outlook Calendar'
                                : 'Connect your Calendly account'
                            }
                        </p>
                    </div>

                    {/* Provider Selection */}
                    {!selectedProvider ? (
                        <div className="space-y-3">
                            {/* Google Calendar */}
                            <button
                                onClick={() => handleSelectProvider('google')}
                                className="w-full p-4 border-2 border-border rounded-lg text-left hover:border-primary/50 hover:bg-muted/50 transition-all"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <svg className="w-12 h-12" viewBox="0 0 48 48">
                                            <path fill="#1976D2" d="M24,9.604c-6.4,0-10.4,3.199-12,9.597c2.4-3.199,5.2-4.398,8.4-3.599 c1.826,0.456,3.131,1.781,4.576,3.247C27.328,21.236,30.051,24,36,24c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6 c-1.825-0.456-3.13-1.781-4.575-3.247C32.672,12.367,29.948,9.604,24,9.604L24,9.604z M12,24c-6.4,0-10.4,3.199-12,9.598 c2.4-3.199,5.2-4.399,8.4-3.599c1.825,0.457,3.13,1.781,4.575,3.246c2.353,2.388,5.077,5.152,11.025,5.152 c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6c-1.826-0.456-3.131-1.781-4.576-3.246C20.672,26.764,17.949,24,12,24 L12,24z"/>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground">Google Calendar</h3>
                                        <p className="text-sm text-muted-foreground">Connect your Google Calendar</p>
                                    </div>
                                </div>
                            </button>

                            {/* Outlook Calendar */}
                            <button
                                onClick={() => handleSelectProvider('microsoft')}
                                className="w-full p-4 border-2 border-border rounded-lg text-left hover:border-primary/50 hover:bg-muted/50 transition-all"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <svg className="w-12 h-12" viewBox="0 0 48 48">
                                            <rect fill="#0078D4" width="48" height="48" rx="4"/>
                                            <path fill="white" d="M12 14h24v20H12z" opacity="0.2"/>
                                            <path fill="white" d="M14 16h20v16H14z"/>
                                            <path fill="#0078D4" d="M16 18h16v12H16z"/>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground">Outlook Calendar</h3>
                                        <p className="text-sm text-muted-foreground">Connect your Outlook Calendar</p>
                                    </div>
                                </div>
                            </button>

                            {/* TEMPORARILY DISABLED: Calendly */}
                            {/* <button
                                onClick={() => handleSelectProvider('calendly')}
                                className="w-full p-4 border-2 border-border rounded-lg text-left hover:border-primary/50 hover:bg-muted/50 transition-all"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <svg className="w-12 h-12" viewBox="0 0 48 48">
                                            <rect fill="#006B3F" width="48" height="48" rx="4"/>
                                            <path fill="white" d="M14 12h20v24H14z"/>
                                            <rect fill="#006B3F" x="16" y="14" width="3" height="20"/>
                                            <rect fill="#006B3F" x="22" y="14" width="3" height="20"/>
                                            <rect fill="#006B3F" x="28" y="14" width="3" height="20"/>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground">Calendly</h3>
                                        <p className="text-sm text-muted-foreground">Connect your Calendly account</p>
                                    </div>
                                </div>
                            </button> */}
                        </div>
                    ) : (
                        /* Connection UI */
                        <div className="space-y-6">
                            {isConnected ? (
                                <>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
                                        <div className="flex justify-center">
                                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-green-900">Connected!</h3>
                                            <p className="text-sm text-green-700 mt-1">
                                                Your {selectedProvider === 'google' ? 'Google Calendar' : selectedProvider === 'microsoft' ? 'Outlook Calendar' : 'Calendly'} is connected
                                            </p>
                                        </div>
                                    </div>

                                    {/* Transcription Opt-in */}
                                    <div className="border border-border rounded-lg p-4 space-y-3">
                                        <div className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                id="enable-transcription"
                                                checked={enableTranscription}
                                                onChange={(e) => setEnableTranscription(e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label htmlFor="enable-transcription" className="flex-1 cursor-pointer">
                                                <div className="font-medium text-foreground">
                                                    Enable AI Meeting Transcription
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Automatically record and transcribe your meetings with AI-powered bots.
                                                    You can change this setting later for individual meetings.
                                                </p>
                                            </label>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {selectedProvider === 'google' && (
                                        <Button
                                            onClick={handleGoogleConnect}
                                            disabled={isConnecting}
                                            size="lg"
                                            className="w-full"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                'Connect Google Calendar'
                                            )}
                                        </Button>
                                    )}

                                    {selectedProvider === 'microsoft' && (
                                        <Button
                                            onClick={handleMicrosoftConnect}
                                            disabled={isConnecting}
                                            size="lg"
                                            className="w-full"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                'Connect Outlook Calendar'
                                            )}
                                        </Button>
                                    )}

                                    {/* TEMPORARILY DISABLED: Calendly connection UI */}
                                    {/* {selectedProvider === 'calendly' && (
                                        <>
                                            <CalendlyPlanInfo variant="onboarding" />

                                            <Button
                                                onClick={handleCalendlyOAuthConnect}
                                                disabled={isConnecting}
                                                size="lg"
                                                className="w-full"
                                            >
                                                {isConnecting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    'Connect with Calendly'
                                                )}
                                            </Button>

                                            {!showTokenInput && (
                                                <button
                                                    onClick={() => setShowTokenInput(true)}
                                                    className="w-full text-sm text-primary hover:underline"
                                                >
                                                    Or use API token instead
                                                </button>
                                            )}

                                            {showTokenInput && (
                                                <div className="space-y-3">
                                                    <Input
                                                        type="password"
                                                        placeholder="Enter your Calendly API token"
                                                        value={calendlyToken}
                                                        onChange={(e) => setCalendlyToken(e.target.value)}
                                                    />
                                                    <Button
                                                        onClick={handleCalendlyTokenConnect}
                                                        disabled={isConnecting || !calendlyToken.trim()}
                                                        size="lg"
                                                        className="w-full"
                                                    >
                                                        {isConnecting ? 'Connecting...' : 'Connect with Token'}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )} */}
                                </>
                            )}

                            {error && (
                                <div className="flex items-start space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => handleSelectProvider(null)}
                                className="w-full"
                            >
                                Change Provider
                            </Button>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-8">
                        <Button
                            variant="outline"
                            onClick={onBack}
                            disabled={isConnecting}
                        >
                            Back
                        </Button>
                        {!selectedProvider && (
                            <Button
                                variant="ghost"
                                onClick={handleSkip}
                                disabled={isConnecting}
                                className="ml-auto"
                            >
                                Skip for now
                            </Button>
                        )}
                        <Button
                            onClick={handleContinue}
                            disabled={!selectedProvider || !isConnected || isConnecting}
                            className={!selectedProvider ? 'ml-auto' : ''}
                        >
                            Continue
                        </Button>
                    </div>
                </div>

                {/* RIGHT COLUMN - Illustration */}
                <div className="hidden lg:flex items-center justify-center">
                    <div className="w-full h-96 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-lg flex items-center justify-center border border-border">
                        <span className="text-muted-foreground text-sm">Calendar Setup Illustration</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step3_CalendarSetup;

