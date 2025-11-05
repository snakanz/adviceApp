import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CheckCircle2, Calendar, Users, BarChart3, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step8_Complete = ({ data, selectedPlan = 'free', onComplete }) => {
    const { getAccessToken } = useAuth();
    const [syncStatus, setSyncStatus] = useState('initializing'); // initializing, syncing, complete, error
    const [syncStats, setSyncStats] = useState({ meetingsCount: 0, clientsCount: 0 });
    const [error, setError] = useState(null);

    useEffect(() => {
        // Auto-trigger sync and create subscription on mount
        initializeUserAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initializeUserAccount = async () => {
        try {
            const token = await getAccessToken();

            // Step 1: Create subscription (free or paid already handled by Stripe)
            setSyncStatus('initializing');

            // Only create free subscription if user selected free plan
            if (selectedPlan === 'free') {
                await axios.post(
                    `${API_BASE_URL}/api/billing/create-trial`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('✅ Free subscription created (5 free meetings)');
            } else {
                console.log('✅ Paid subscription already created via Stripe');
            }

            // Step 2: Trigger calendar sync
            setSyncStatus('syncing');
            const syncResponse = await axios.post(
                `${API_BASE_URL}/api/calendar/sync`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('✅ Calendar sync complete:', syncResponse.data);

            // Update stats from sync results
            const results = syncResponse.data.results || syncResponse.data;
            const { added = 0, updated = 0, restored = 0, clientsCreated = 0, clientsLinked = 0 } = results;
            setSyncStats({
                meetingsCount: added + updated + restored,
                clientsCount: clientsCreated
            });

            setSyncStatus('complete');
        } catch (err) {
            console.error('Error initializing account:', err);
            setError(err.response?.data?.error || 'Failed to initialize account');
            setSyncStatus('error');
        }
    };
    const features = [
        {
            icon: <Calendar className="w-6 h-6 text-primary" />,
            title: 'Meetings Dashboard',
            description: 'View all your meetings in one place with automatic sync'
        },
        {
            icon: <Users className="w-6 h-6 text-primary" />,
            title: 'Client Management',
            description: 'Track client relationships and business opportunities'
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-primary" />,
            title: 'Pipeline Tracking',
            description: 'Monitor your sales pipeline and expected revenue'
        },
        {
            icon: <MessageSquare className="w-6 h-6 text-primary" />,
            title: 'AI Assistant',
            description: 'Get insights and summaries powered by AI'
        }
    ];

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold">
                        {syncStatus === 'complete' ? "You're all set!" : "Setting up your account..."}
                    </CardTitle>
                    <CardDescription className="text-base">
                        {syncStatus === 'complete'
                            ? `Welcome to Advicly, ${data.business_name}! 🎉`
                            : syncStatus === 'syncing'
                            ? 'Importing your calendar meetings...'
                            : syncStatus === 'error'
                            ? 'There was an issue setting up your account'
                            : 'Creating your free account...'
                        }
                    </CardDescription>

                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Sync Status */}
                    {syncStatus !== 'complete' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                            <div className="flex items-center justify-center space-x-3">
                                {syncStatus === 'error' ? (
                                    <>
                                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                            <span className="text-red-600 text-xl">⚠️</span>
                                        </div>
                                        <p className="text-sm text-red-600">{error}</p>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                        <p className="text-sm text-muted-foreground">
                                            {syncStatus === 'initializing'
                                                ? 'Creating your free account (5 free AI-transcribed meetings)...'
                                                : 'Syncing your calendar meetings...'
                                            }
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sync Results */}
                    {syncStatus === 'complete' && syncStats.meetingsCount > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-3">
                            <h4 className="font-semibold text-green-800">✅ Calendar Synced!</h4>
                            <p className="text-sm text-green-700">
                                Imported {syncStats.meetingsCount} meeting{syncStats.meetingsCount !== 1 ? 's' : ''}
                                {syncStats.clientsCount > 0 && ` and ${syncStats.clientsCount} client${syncStats.clientsCount !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    )}

                    {/* Free Meetings Banner */}
                    {syncStatus === 'complete' && selectedPlan === 'free' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                            <h4 className="font-semibold text-primary">🎁 5 Free AI-Transcribed Meetings</h4>
                            <p className="text-sm text-muted-foreground">
                                Your first 5 meetings with AI transcription are free! After that, upgrade to £70/month for unlimited AI-transcribed meetings.
                            </p>
                        </div>
                    )}

                    {/* Paid Plan Welcome */}
                    {syncStatus === 'complete' && selectedPlan !== 'free' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-3">
                            <h4 className="font-semibold text-green-800">🎉 Welcome to Advicly Professional!</h4>
                            <p className="text-sm text-green-700">
                                You now have unlimited AI-transcribed meetings and access to all premium features.
                            </p>
                        </div>
                    )}

                    {/* Features Grid */}
                    {syncStatus === 'complete' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase text-muted-foreground text-center">
                                What you can do now:
                            </h3>
                        <div className="grid gap-4">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">
                                            {feature.title}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Tips */}
                    {syncStatus === 'complete' && (
                        <div className="bg-muted/50 border border-border rounded-lg p-6 space-y-3">
                            <h4 className="font-semibold">💡 Quick Tips</h4>
                            <ul className="text-sm text-muted-foreground space-y-2">
                                <li>• Your calendar meetings are automatically synced</li>
                                <li>• AI transcription will join your first 5 meetings for free</li>
                                <li>• Use the Pipeline page to track your business opportunities</li>
                                <li>• Ask the AI assistant questions about your clients and meetings</li>
                            </ul>
                        </div>
                    )}

                    {/* CTA Button */}
                    <Button
                        onClick={onComplete}
                        size="lg"
                        className="w-full text-lg h-14"
                        disabled={syncStatus !== 'complete'}
                    >
                        {syncStatus === 'complete' ? 'Go to Dashboard' : 'Please wait...'}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        Need help? Check out our{' '}
                        <button onClick={() => {}} className="underline hover:text-foreground">
                            Getting Started Guide
                        </button>
                        {' '}or{' '}
                        <button onClick={() => {}} className="underline hover:text-foreground">
                            Contact Support
                        </button>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step8_Complete;

