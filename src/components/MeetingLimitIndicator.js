import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Zap, ArrowUpCircle, Crown, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const MeetingLimitIndicator = ({ onUpgradeClick }) => {
    const { getAccessToken } = useAuth();
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchMeetingStats();
        // Refresh stats every 30 seconds
        const interval = setInterval(fetchMeetingStats, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchMeetingStats = async () => {
        try {
            const token = await getAccessToken();
            const response = await axios.get(
                `${API_BASE_URL}/api/billing/meeting-stats`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStats(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching meeting stats:', error);
            setIsLoading(false);
        }
    };

    if (isLoading || !stats) {
        return null;
    }

    // Show professional plan indicator for paid users
    if (stats.plan !== 'free') {
        return (
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm">
                <CardContent className="p-4 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">
                                Professional Plan
                            </span>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">
                                Unlimited AI-transcribed meetings
                            </p>
                        </div>
                    </div>

                    {/* Active Badge */}
                    <div className="pt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            Active
                        </span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Map backend property names to frontend variable names
    const { transcribed: meetingsUsed, freeLimit: meetingsLimit } = stats;
    const remaining = Math.max(0, meetingsLimit - meetingsUsed);
    const percentage = (meetingsUsed / meetingsLimit) * 100;
    const isNearLimit = remaining <= 1;
    const isAtLimit = remaining === 0;

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-semibold text-foreground">
                            Free Plan
                        </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {remaining} of {meetingsLimit} left
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                                isAtLimit
                                    ? 'bg-red-500'
                                    : isNearLimit
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {isAtLimit
                            ? 'No free meetings remaining'
                            : `${remaining} AI-transcribed meeting${remaining !== 1 ? 's' : ''} remaining`}
                    </p>
                </div>

                {/* Upgrade Button */}
                <Button
                    onClick={onUpgradeClick}
                    size="sm"
                    className={`w-full ${
                        isAtLimit
                            ? 'bg-red-600 hover:bg-red-700'
                            : isNearLimit
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-primary hover:bg-primary/90'
                    }`}
                >
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    {isAtLimit ? 'Upgrade Now' : 'Upgrade to Pro'}
                </Button>

                {/* Info Text */}
                {!isAtLimit && (
                    <p className="text-xs text-center text-muted-foreground">
                        Upgrade for unlimited AI meetings
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default MeetingLimitIndicator;

