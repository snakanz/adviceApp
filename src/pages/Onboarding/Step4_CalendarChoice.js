import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Calendar, CheckCircle2 } from 'lucide-react';

const Step4_CalendarChoice = ({ data, onNext, onBack, onSkip }) => {
    const { user } = useAuth();
    const [selectedProvider, setSelectedProvider] = useState(data.calendar_provider || null);

    // Auto-detect if user signed in with Google
    const signedInWithGoogle = user?.app_metadata?.provider === 'google';
    const userEmail = user?.email;

    // Auto-select Google Calendar if user signed in with Google
    useEffect(() => {
        if (signedInWithGoogle && !selectedProvider) {
            setSelectedProvider('google');
        }
    }, [signedInWithGoogle, selectedProvider]);

    const handleSelect = (provider) => {
        setSelectedProvider(provider);
    };

    const handleContinue = () => {
        if (selectedProvider) {
            onNext({ calendar_provider: selectedProvider });
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        Which calendar do you use?
                    </CardTitle>
                    <CardDescription className="text-base">
                        Select your primary calendar provider
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Show detected Google account */}
                    {signedInWithGoogle && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-blue-900">
                                    You signed in with Google
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    {userEmail}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4">
                        {/* Google Calendar Option */}
                        <button
                            onClick={() => handleSelect('google')}
                            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
                                selectedProvider === 'google'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                        >
                            {signedInWithGoogle && (
                                <div className="absolute top-4 right-4">
                                    <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                                        Recommended
                                    </span>
                                </div>
                            )}
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                    <svg className="w-12 h-12" viewBox="0 0 48 48">
                                        <path fill="#1976D2" d="M24,9.604c-6.4,0-10.4,3.199-12,9.597c2.4-3.199,5.2-4.398,8.4-3.599 c1.826,0.456,3.131,1.781,4.576,3.247C27.328,21.236,30.051,24,36,24c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6 c-1.825-0.456-3.13-1.781-4.575-3.247C32.672,12.367,29.948,9.604,24,9.604L24,9.604z M12,24c-6.4,0-10.4,3.199-12,9.598 c2.4-3.199,5.2-4.399,8.4-3.599c1.825,0.457,3.13,1.781,4.575,3.246c2.353,2.388,5.077,5.152,11.025,5.152 c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6c-1.826-0.456-3.131-1.781-4.576-3.246C20.672,26.764,17.949,24,12,24 L12,24z"/>
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1">
                                        {signedInWithGoogle ? 'Continue with Google Calendar' : 'Google Calendar'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {signedInWithGoogle
                                            ? `Connect your Google Calendar using ${userEmail}`
                                            : 'Connect your Google Calendar to automatically sync meetings'
                                        }
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedProvider === 'google'
                                            ? 'border-primary bg-primary'
                                            : 'border-muted-foreground'
                                    }`}>
                                        {selectedProvider === 'google' && (
                                            <div className="w-2 h-2 bg-white rounded-full" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Calendly Option - Fallback */}
                        <button
                            onClick={() => handleSelect('calendly')}
                            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
                                selectedProvider === 'calendly'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                        >
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                    <Calendar className="w-12 h-12 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1">
                                        Calendly
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Can't connect work calendar? Use Calendly instead
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedProvider === 'calendly'
                                            ? 'border-primary bg-primary'
                                            : 'border-muted-foreground'
                                    }`}>
                                        {selectedProvider === 'calendly' && (
                                            <div className="w-2 h-2 bg-white rounded-full" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-4">
                        <div className="flex space-x-3">
                            <Button
                                variant="outline"
                                onClick={onBack}
                            >
                                Back
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={onSkip}
                                className="text-muted-foreground"
                            >
                                Skip for now
                            </Button>
                        </div>
                        <Button
                            onClick={handleContinue}
                            disabled={!selectedProvider}
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

export default Step4_CalendarChoice;

