import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CheckCircle2, Calendar, Users, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Step5_InitialSync = ({ data, onNext, onBack }) => {
    const { getAccessToken } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncComplete, setSyncComplete] = useState(false);
    const [syncStats, setSyncStats] = useState({
        meetings: 0,
        clients: 0
    });
    const [error, setError] = useState('');

    const provider = data.calendar_provider;

    const handleSync = async () => {
        setIsSyncing(true);
        setError('');

        try {
            const token = await getAccessToken();

            if (provider === 'google') {
                // Sync Google Calendar meetings
                const response = await axios.post(
                    `${API_BASE_URL}/api/calendar/sync`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setSyncStats({
                    meetings: response.data.meetingsCount || 0,
                    clients: response.data.clientsCount || 0
                });
            } else if (provider === 'calendly') {
                // Sync Calendly meetings
                const response = await axios.post(
                    `${API_BASE_URL}/api/calendly/sync`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setSyncStats({
                    meetings: response.data.meetingsCount || 0,
                    clients: response.data.clientsCount || 0
                });
            }

            setSyncComplete(true);
            setIsSyncing(false);
        } catch (err) {
            console.error('Error syncing calendar:', err);
            setError(err.response?.data?.error || 'Failed to sync calendar');
            setIsSyncing(false);
        }
    };

    const handleContinue = () => {
        onNext();
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        Sync your meetings
                    </CardTitle>
                    <CardDescription className="text-base">
                        Import your existing meetings and client data
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!syncComplete ? (
                        <>
                            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                                <h4 className="font-semibold text-sm uppercase text-muted-foreground">
                                    What we'll import:
                                </h4>
                                <div className="grid gap-3">
                                    <div className="flex items-start space-x-3">
                                        <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium">Upcoming meetings</p>
                                            <p className="text-xs text-muted-foreground">
                                                All your scheduled meetings from the next 6 months
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                        <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium">Client information</p>
                                            <p className="text-xs text-muted-foreground">
                                                Automatically extract client details from meeting attendees
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                    {error}
                                </div>
                            )}

                            <Button
                                onClick={handleSync}
                                disabled={isSyncing}
                                size="lg"
                                className="w-full"
                            >
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    'Start Sync'
                                )}
                            </Button>
                        </>
                    ) : (
                        <div className="text-center py-8 space-y-6">
                            <div className="flex justify-center">
                                <CheckCircle2 className="w-16 h-16 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">
                                    Sync Complete!
                                </h3>
                                <p className="text-muted-foreground">
                                    Your calendar data has been imported successfully
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <div className="text-3xl font-bold text-primary mb-1">
                                        {syncStats.meetings}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Meetings imported
                                    </div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <div className="text-3xl font-bold text-primary mb-1">
                                        {syncStats.clients}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Clients identified
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={onBack}
                            disabled={isSyncing}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleContinue}
                            disabled={!syncComplete || isSyncing}
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

export default Step5_InitialSync;

