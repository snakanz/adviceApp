import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step5_CalendarConnect = ({ data, onNext, onBack, onSkip }) => {
    const { getAccessToken, user } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    const [calendlyToken, setCalendlyToken] = useState('');

    const provider = data.calendar_provider;
    const signedInWithGoogle = user?.app_metadata?.provider === 'google';
    const userEmail = user?.email;

    // Check if already connected
    useEffect(() => {
        checkConnectionStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkConnectionStatus = async () => {
        try {
            const token = await getAccessToken();
            
            if (provider === 'google') {
                const response = await axios.get(
                    `${API_BASE_URL}/api/auth/google/status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsConnected(response.data.connected);
            } else if (provider === 'calendly') {
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
            const response = await axios.get(
                `${API_BASE_URL}/api/auth/google`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Redirect to Google OAuth
            if (response.data.url) {
                window.location.href = response.data.url;
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
                `${API_BASE_URL}/api/calendar-connections/calendly/auth-url`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Redirect to Calendly OAuth
            if (response.data.url) {
                window.location.href = response.data.url;
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
        if (isConnected) {
            onNext();
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* LEFT COLUMN - Content */}
                <div className="space-y-8">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Question 4 of 4
                    </p>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-foreground">
                            {provider === 'google' ? 'Connect Google Calendar' : provider === 'outlook' ? 'Outlook Calendar' : 'Connect Calendly'}
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {provider === 'google'
                                ? 'Authorize Advicly to access your Google Calendar'
                                : provider === 'outlook'
                                ? 'Outlook integration coming soon. Please select a different provider.'
                                : 'Enter your Calendly API token to sync your meetings'
                            }
                        </p>
                    </div>

                    <div className="space-y-6">
                    {provider === 'outlook' ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center space-y-4">
                            <p className="text-sm font-medium text-yellow-900">
                                Outlook integration is coming soon!
                            </p>
                            <p className="text-sm text-yellow-800">
                                Please select Google Calendar or Calendly to continue with your onboarding.
                            </p>
                            <Button
                                variant="outline"
                                onClick={onBack}
                                className="w-full"
                            >
                                Go Back to Select Provider
                            </Button>
                        </div>
                    ) : !isConnected ? (
                        <>
                            {provider === 'google' && (
                                <div className="space-y-4">
                                    {signedInWithGoogle && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <p className="text-sm font-medium text-blue-900 mb-1">
                                                You'll connect the same Google account:
                                            </p>
                                            <p className="text-sm text-blue-700 font-semibold">
                                                {userEmail}
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                        <h4 className="font-semibold text-sm">What we'll access:</h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• View your calendar events</li>
                                            <li>• Read event details (title, time, attendees)</li>
                                            <li>• Receive notifications when events change</li>
                                        </ul>
                                        <p className="text-xs text-muted-foreground pt-2">
                                            We will never modify or delete your calendar events.
                                        </p>
                                    </div>

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
                                            signedInWithGoogle
                                                ? 'Grant Calendar Access'
                                                : 'Connect Google Calendar'
                                        )}
                                    </Button>
                                </div>
                            )}

                            {provider === 'calendly' && (
                                <div className="space-y-4">
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                        <h4 className="font-semibold text-sm">Choose your connection method:</h4>
                                        <div className="space-y-3">
                                            <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                                                <h5 className="font-medium text-sm mb-2">✨ OAuth (Recommended)</h5>
                                                <p className="text-xs text-muted-foreground mb-3">
                                                    Secure and easy - you'll be redirected to Calendly to authorize
                                                </p>
                                                <Button
                                                    onClick={handleCalendlyOAuthConnect}
                                                    disabled={isConnecting}
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    {isConnecting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                            Redirecting...
                                                        </>
                                                    ) : (
                                                        'Connect with Calendly OAuth'
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="border border-border rounded-lg p-3">
                                                <h5 className="font-medium text-sm mb-2">API Token (Manual)</h5>
                                                <p className="text-xs text-muted-foreground mb-3">
                                                    Paste your Calendly API token directly
                                                </p>
                                                <div className="space-y-2">
                                                    <Input
                                                        id="calendly_token"
                                                        type="password"
                                                        placeholder="Enter your Calendly API token"
                                                        value={calendlyToken}
                                                        onChange={(e) => setCalendlyToken(e.target.value)}
                                                        disabled={isConnecting}
                                                        size="sm"
                                                    />
                                                    <Button
                                                        onClick={handleCalendlyTokenConnect}
                                                        disabled={isConnecting || !calendlyToken.trim()}
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full"
                                                    >
                                                        {isConnecting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                                Connecting...
                                                            </>
                                                        ) : (
                                                            'Connect with Token'
                                                        )}
                                                    </Button>
                                                    <p className="text-xs text-muted-foreground">
                                                        Get your token from{' '}
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
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 space-y-4">
                            <div className="flex justify-center">
                                <CheckCircle2 className="w-16 h-16 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">
                                    Successfully Connected!
                                </h3>
                                <p className="text-muted-foreground">
                                    Your {provider === 'google' ? 'Google Calendar' : 'Calendly'} is now connected to Advicly
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {provider !== 'outlook' && (
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
                                disabled={!isConnected || isConnecting}
                                className="ml-auto"
                            >
                                Continue
                            </Button>
                        </div>
                    )}
                    </div>

                {/* RIGHT COLUMN - Illustration */}
                <div className="hidden lg:flex items-center justify-center">
                    <div className="w-full h-96 bg-gradient-to-br from-green-100 to-green-50 rounded-lg flex items-center justify-center border border-border">
                        <span className="text-muted-foreground text-sm">Connection Security Illustration</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step5_CalendarConnect;

