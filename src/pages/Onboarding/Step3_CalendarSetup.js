import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step3_CalendarSetup = ({ data, onNext, onBack }) => {
    const { getAccessToken, user } = useAuth();
    const [selectedProvider, setSelectedProvider] = useState(data.calendar_provider || null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    const [calendlyToken, setCalendlyToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);

    // Listen for OAuth messages from popup windows
    useEffect(() => {
        const handleOAuthMessage = (event) => {
            // Verify origin for security
            if (!event.origin.includes('localhost') && !event.origin.includes('advicly')) {
                return;
            }

            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
                console.log('✅ Google Calendar OAuth successful');
                setIsConnected(true);
                setIsConnecting(false);
                setError('');
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
                console.error('❌ Google Calendar OAuth error:', event.data.error);
                setError(event.data.error || 'Failed to connect to Google Calendar');
                setIsConnecting(false);
            } else if (event.data.type === 'CALENDLY_OAUTH_SUCCESS') {
                console.log('✅ Calendly OAuth successful');
                setIsConnected(true);
                setIsConnecting(false);
                setError('');
            } else if (event.data.type === 'CALENDLY_OAUTH_ERROR') {
                console.error('❌ Calendly OAuth error:', event.data.error);
                setError(event.data.error || 'Failed to connect to Calendly');
                setIsConnecting(false);
            }
        };

        window.addEventListener('message', handleOAuthMessage);
        return () => window.removeEventListener('message', handleOAuthMessage);
    }, []);

    // Check if already connected
    useEffect(() => {
        if (selectedProvider) {
            checkConnectionStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProvider]);

    const checkConnectionStatus = async () => {
        try {
            const token = await getAccessToken();
            
            if (selectedProvider === 'google') {
                const response = await axios.get(
                    `${API_BASE_URL}/api/auth/google/status`,
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

            // Get OAuth URL from calendar endpoint (not auth endpoint)
            // This endpoint returns a URL that can be used for popup-based OAuth
            const response = await axios.get(
                `${API_BASE_URL}/api/calendar/auth/google`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.url && user?.id) {
                // Add state parameter with user ID for popup-based flow
                const oauthUrl = `${response.data.url}&state=${user.id}`;

                // Open OAuth in popup window instead of full-page redirect
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;

                const popup = window.open(
                    oauthUrl,
                    'Google Calendar OAuth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );

                if (!popup) {
                    setError('Popup blocked. Please allow popups and try again.');
                    setIsConnecting(false);
                }
            }
        } catch (err) {
            console.error('Error connecting to Google:', err);
            setError('Failed to connect to Google Calendar');
            setIsConnecting(false);
        }
    };

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
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;

                const popup = window.open(
                    oauthUrl,
                    'Calendly OAuth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );

                if (!popup) {
                    setError('Popup blocked. Please allow popups and try again.');
                    setIsConnecting(false);
                }
            }
        } catch (err) {
            console.error('Error connecting to Calendly via OAuth:', err);
            setError(err.response?.data?.error || 'Failed to connect to Calendly');
            setIsConnecting(false);
        }
    };

    const handleCalendlyTokenConnect = async () => {
        if (!calendlyToken.trim()) {
            setError('Please enter your Calendly API token');
            return;
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

    const handleContinue = () => {
        if (selectedProvider && isConnected) {
            onNext({ calendar_provider: selectedProvider });
        }
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Question 3 of 4
                    </p>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-foreground">
                            {!selectedProvider ? 'Which calendar do you use?' : 'Connect your calendar'}
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {!selectedProvider 
                                ? 'Select your primary calendar provider'
                                : selectedProvider === 'google'
                                ? 'Authorize Advicly to access your Google Calendar'
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

                            {/* Outlook Calendar - Disabled */}
                            <button
                                disabled
                                className="w-full p-4 border-2 border-border rounded-lg text-left opacity-50 cursor-not-allowed"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <svg className="w-12 h-12" viewBox="0 0 48 48">
                                            <rect fill="#0078D4" width="48" height="48" rx="4"/>
                                            <path fill="white" d="M12 14h24v20H12z" opacity="0.2"/>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-foreground">Outlook Calendar</h3>
                                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                                Coming Soon
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Coming soon</p>
                                    </div>
                                </div>
                            </button>

                            {/* Calendly */}
                            <button
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
                            </button>
                        </div>
                    ) : (
                        /* Connection UI */
                        <div className="space-y-6">
                            {isConnected ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
                                    <div className="flex justify-center">
                                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-green-900">Connected!</h3>
                                        <p className="text-sm text-green-700 mt-1">
                                            Your {selectedProvider === 'google' ? 'Google Calendar' : 'Calendly'} is connected
                                        </p>
                                    </div>
                                </div>
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

                                    {selectedProvider === 'calendly' && (
                                        <>
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
                                    )}
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
                        <Button
                            onClick={handleContinue}
                            disabled={!selectedProvider || !isConnected || isConnecting}
                            className="ml-auto"
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

