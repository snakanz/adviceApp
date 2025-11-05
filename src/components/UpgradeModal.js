import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Check, X, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

const UpgradeModal = ({ isOpen, onClose }) => {
    const { getAccessToken } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const freePlanFeatures = [
        { text: '5 AI-transcribed meetings', included: true },
        { text: 'Meeting summaries', included: true },
        { text: 'Client management', included: true },
        { text: 'Basic pipeline tracking', included: true },
        { text: 'Unlimited AI meetings', included: false },
        { text: 'Advanced AI assistant', included: false },
        { text: 'Document uploads', included: false },
        { text: 'Email templates', included: false }
    ];

    const proPlanFeatures = [
        'Unlimited AI-transcribed meetings',
        'Advanced AI meeting summaries',
        'Full client pipeline management',
        'Action items & follow-ups',
        'Ask Advicly AI assistant',
        'Document uploads',
        'Email templates',
        'Priority support'
    ];

    const handleUpgrade = async () => {
        setIsLoading(true);
        setError('');

        try {
            const token = await getAccessToken();

            // Get the monthly price ID from environment
            const priceId = process.env.REACT_APP_STRIPE_PRICE_ID;
            const publicKey = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

            // Enhanced error logging
            console.log('=== UPGRADE MODAL DEBUG ===');
            console.log('Environment variables check:');
            console.log('- REACT_APP_STRIPE_PRICE_ID:', priceId ? `${priceId.substring(0, 15)}...` : 'MISSING');
            console.log('- REACT_APP_STRIPE_PUBLIC_KEY:', publicKey ? `${publicKey.substring(0, 15)}...` : 'MISSING');
            console.log('- API_BASE_URL:', API_BASE_URL);
            console.log('- STRIPE_PUBLIC_KEY constant:', STRIPE_PUBLIC_KEY ? `${STRIPE_PUBLIC_KEY.substring(0, 15)}...` : 'MISSING');

            if (!priceId) {
                const errorMsg = 'Payment system is not configured. Missing REACT_APP_STRIPE_PRICE_ID environment variable.';
                console.error('ERROR:', errorMsg);
                console.log('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')));
                setError(errorMsg);
                setIsLoading(false);
                return;
            }

            if (!STRIPE_PUBLIC_KEY) {
                const errorMsg = 'Payment system is not configured. Missing Stripe public key.';
                console.error('ERROR:', errorMsg);
                setError(errorMsg);
                setIsLoading(false);
                return;
            }

            console.log('Creating checkout session...');
            console.log('Request payload:', { priceId });

            // Create checkout session
            const response = await axios.post(
                `${API_BASE_URL}/api/billing/checkout`,
                { priceId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('Checkout session created:', response.data.sessionId ? 'SUCCESS' : 'FAILED');

            // Redirect to Stripe Checkout using direct URL (avoids ad blocker issues)
            if (response.data.url) {
                console.log('Redirecting to Stripe Checkout...');
                console.log('Checkout URL:', response.data.url);
                // Use direct redirect instead of stripe.redirectToCheckout() to avoid ad blocker issues
                window.location.href = response.data.url;
            } else {
                throw new Error('No checkout URL returned from server');
            }
        } catch (err) {
            console.error('=== UPGRADE ERROR ===');
            console.error('Error type:', err.name);
            console.error('Error message:', err.message);
            console.error('Full error:', err);
            if (err.response) {
                console.error('Response status:', err.response.status);
                console.error('Response data:', err.response.data);
                console.error('Response headers:', err.response.headers);
            }
            setError(err.response?.data?.error || err.message || 'Failed to start upgrade process');
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <Card className="shadow-2xl border-border/50">
                    <CardHeader className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                        <div className="text-center space-y-2 pr-12">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Sparkles className="w-6 h-6 text-yellow-500" />
                                <CardTitle className="text-3xl font-bold">
                                    Upgrade to Professional
                                </CardTitle>
                            </div>
                            <CardDescription className="text-base">
                                Unlock unlimited AI-transcribed meetings and premium features
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Pricing Comparison */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Free Plan */}
                            <div className="border border-border rounded-lg p-6 space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Free Plan</h3>
                                    <p className="text-sm text-muted-foreground">Your current plan</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold">£0</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        5 free AI-transcribed meetings
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {freePlanFeatures.map((feature, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            {feature.included ? (
                                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <X className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                            )}
                                            <span className={`text-sm ${!feature.included ? 'text-muted-foreground line-through' : ''}`}>
                                                {feature.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pro Plan */}
                            <div className="border-2 border-primary rounded-lg p-6 space-y-4 bg-primary/5 relative">
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <Badge className="bg-yellow-400 text-black border-0 px-3 py-1 text-xs font-bold">
                                        RECOMMENDED
                                    </Badge>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Professional</h3>
                                    <p className="text-sm text-muted-foreground">Unlimited everything</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold">£70</span>
                                        <span className="text-muted-foreground">/month</span>
                                    </div>
                                    <p className="text-sm text-green-600 font-medium">
                                        Billed monthly
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {proPlanFeatures.map((feature, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-sm font-medium">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={isLoading}
                            >
                                Maybe Later
                            </Button>
                            <Button
                                onClick={handleUpgrade}
                                className="flex-1 bg-primary hover:bg-primary/90"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Upgrade to Professional
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Footer Info */}
                        <div className="text-center text-xs text-muted-foreground">
                            <p>Secure payment powered by Stripe</p>
                            <p className="mt-1">Cancel anytime, no questions asked</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UpgradeModal;

