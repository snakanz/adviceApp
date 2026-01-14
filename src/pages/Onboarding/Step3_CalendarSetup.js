import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
// TEMPORARILY DISABLED: Calendly integration hidden from UI
// import { Input } from '../../components/ui/input';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { CALENDAR_PROVIDER_LOGOS } from '../../utils/recallBotStatus';
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

    // Check if returning from OAuth redirect
    useEffect(() => {
        const checkOAuthReturn = async () => {
            console.log('🔍 Checking for OAuth return in sessionStorage...');
            const oauthReturn = sessionStorage.getItem('oauth_return');

            if (oauthReturn) {
                console.log('🔍 OAuth return found:', oauthReturn);
                const { provider, success, error: oauthError } = JSON.parse(oauthReturn);
                sessionStorage.removeItem('oauth_return');

                if (success) {
                    console.log(`✅ ${provider} Calendar OAuth successful - Setting connected state`);
                    setSelectedProvider(provider);
                    setIsConnected(true);
                    setError('');
                } else {
                    console.error(`❌ ${provider} Calendar OAuth error:`, oauthError);
                    setError(oauthError || `Failed to connect to ${provider} Calendar`);
                }
                setIsConnecting(false);
            } else {
                console.log('🔍 No OAuth return found - User has not attempted OAuth yet');
            }
        };

        checkOAuthReturn();
    }, []);

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
        console.log('🔵 Starting Google Calendar connection...');
        console.log('🔵 Current user:', user?.email, 'User ID:', user?.id);
        console.log('🔵 Onboarding data:', data);

        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();
            console.log('🔵 Access token obtained:', token ? 'YES' : 'NO');

            // Get OAuth URL from auth endpoint
            const response = await axios.get(
                `${API_BASE_URL}/api/auth/google`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('🔵 OAuth URL response:', response.data);

            if (response.data.url && user?.id) {
                console.log('🔵 Saving onboarding state to sessionStorage...');

                const stateToSave = {
                    currentStep: 3,
                    selectedProvider: 'google',
                    selectedPlan: data.selected_plan,
                    business_name: data.business_name,
                    business_type: data.business_type,
                    team_size: data.team_size,
                    timezone: data.timezone,
                    enable_transcription: enableTranscription,
                    user_id: user.id
                };

                console.log('🔵 State to save:', stateToSave);

                // Save onboarding state to sessionStorage before redirect
                sessionStorage.setItem('onboarding_state', JSON.stringify(stateToSave));

                console.log('🔵 Redirecting to OAuth URL...');
                // Redirect to OAuth (no popup blockers!)
                window.location.href = response.data.url;
            } else {
                console.error('❌ Missing OAuth URL or user ID');
                setError('Failed to initiate calendar connection');
                setIsConnecting(false);
            }
        } catch (err) {
            console.error('❌ Error connecting to Google:', err);
            console.error('❌ Error details:', err.response?.data);
            setError('Failed to connect to Google Calendar');
            setIsConnecting(false);
        }
    };

    const handleMicrosoftConnect = async () => {
        console.log('🔵 Starting Microsoft Calendar connection...');
        console.log('🔵 Current user:', user?.email, 'User ID:', user?.id);
        console.log('🔵 Onboarding data:', data);

        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();
            console.log('🔵 Access token obtained:', token ? 'YES' : 'NO');

            // Get OAuth URL from auth endpoint
            const response = await axios.get(
                `${API_BASE_URL}/api/auth/microsoft`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('🔵 OAuth URL response:', response.data);

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

            console.log('🔵 Saving onboarding state to sessionStorage...');

            const stateToSave = {
                currentStep: 3,
                selectedProvider: 'microsoft',
                selectedPlan: data.selected_plan,
                business_name: data.business_name,
                business_type: data.business_type,
                team_size: data.team_size,
                timezone: data.timezone,
                enable_transcription: enableTranscription,
                user_id: user.id
            };

            console.log('🔵 State to save:', stateToSave);

            // Save onboarding state to sessionStorage before redirect
            sessionStorage.setItem('onboarding_state', JSON.stringify(stateToSave));

            console.log('🔵 Redirecting to OAuth URL...');
            // Redirect to OAuth (no popup blockers!)
            window.location.href = response.data.url;
        } catch (err) {
            console.error('❌ Error connecting to Microsoft:', err);
            console.error('❌ Error details:', err.response?.data);
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
                console.log('🔄 Saving onboarding state and redirecting to Calendly OAuth...');

                // Save onboarding state to sessionStorage before redirect
                sessionStorage.setItem('onboarding_state', JSON.stringify({
                    currentStep: 3,
                    selectedProvider: 'calendly',
                    selectedPlan: data.selected_plan,
                    business_name: data.business_name,
                    business_type: data.business_type,
                    team_size: data.team_size,
                    timezone: data.timezone,
                    enable_transcription: enableTranscription,
                    user_id: user.id
                }));

                // Add state parameter with user ID and redirect
                const oauthUrl = `${response.data.url}&state=${user.id}`;
                window.location.href = oauthUrl;
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

        setIsConnecting(true);
        setError('');

        try {
            const token = await getAccessToken();
            await axios.post(
                `${API_BASE_URL}/api/calendar-connections/calendly`,
                { api_token: '' }, // calendlyToken commented out
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
        // TEMPORARILY DISABLED: Calendly state setters
        // setShowTokenInput(false);
        // setCalendlyToken('');
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
                                        <img
                                            src={CALENDAR_PROVIDER_LOGOS.google}
                                            alt="Google Calendar"
                                            className="w-12 h-12 object-contain"
                                        />
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
                                        <img
                                            src={CALENDAR_PROVIDER_LOGOS.outlook}
                                            alt="Outlook Calendar"
                                            className="w-12 h-12 object-contain"
                                        />
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

