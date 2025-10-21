import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step4_CalendarConnect = ({ data, onNext, onBack, onSkip }) => {
    const { getAccessToken } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    const [calendlyToken, setCalendlyToken] = useState('');

    const provider = data.calendar_provider;

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

    const handleCalendlyConnect = async () => {
        if (!calendlyToken.trim()) {
            setError('Please enter your Calendly API token');
            return;
        }

        setIsConnecting(true);
        setError('');

        try {
            // TODO: Implement Calendly connection endpoint
            // For now, just simulate success
            await new Promise(resolve => setTimeout(resolve, 1000));
            setIsConnected(true);
            setIsConnecting(false);
        } catch (err) {
            console.error('Error connecting to Calendly:', err);
            setError('Failed to connect to Calendly');
            setIsConnecting(false);
        }
    };

    const handleContinue = () => {
        if (isConnected) {
            onNext();
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        {provider === 'google' ? 'Connect Google Calendar' : 'Connect Calendly'}
                    </CardTitle>
                    <CardDescription className="text-base">
                        {provider === 'google' 
                            ? 'Authorize Advicly to access your Google Calendar'
                            : 'Enter your Calendly API token to sync your meetings'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!isConnected ? (
                        <>
                            {provider === 'google' && (
                                <div className="space-y-4">
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
                                            'Connect Google Calendar'
                                        )}
                                    </Button>
                                </div>
                            )}

                            {provider === 'calendly' && (
                                <div className="space-y-4">
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                        <h4 className="font-semibold text-sm">How to get your Calendly API token:</h4>
                                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                            <li>Go to Calendly Settings → Integrations</li>
                                            <li>Click "API & Webhooks"</li>
                                            <li>Generate a Personal Access Token</li>
                                            <li>Copy and paste it below</li>
                                        </ol>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="calendly_token">Calendly API Token</Label>
                                        <Input
                                            id="calendly_token"
                                            type="password"
                                            placeholder="Enter your Calendly API token"
                                            value={calendlyToken}
                                            onChange={(e) => setCalendlyToken(e.target.value)}
                                            disabled={isConnecting}
                                        />
                                    </div>

                                    <Button
                                        onClick={handleCalendlyConnect}
                                        disabled={isConnecting || !calendlyToken.trim()}
                                        size="lg"
                                        className="w-full"
                                    >
                                        {isConnecting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            'Connect Calendly'
                                        )}
                                    </Button>
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
                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="flex space-x-3">
                            <Button
                                variant="outline"
                                onClick={onBack}
                                disabled={isConnecting}
                            >
                                Back
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={onSkip}
                                disabled={isConnecting}
                                className="text-muted-foreground"
                            >
                                Skip for now
                            </Button>
                        </div>
                        <Button
                            onClick={handleContinue}
                            disabled={!isConnected || isConnecting}
                            size="lg"
                            className="min-w-[150px]"
                        >
                            Continue
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step4_CalendarConnect;

