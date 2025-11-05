import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

const Step6_SubscriptionPlan = ({ data, onNext, onBack, selectedPlan = 'paid' }) => {
    const { getAccessToken } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Determine if this is annual or monthly plan
    const isAnnual = selectedPlan === 'paid_annual';
    const monthlyPrice = isAnnual ? '£56' : '£70';
    const billingInfo = isAnnual ? 'Billed annually (£672/year)' : 'Billed monthly';

    const features = [
        'Unlimited meetings',
        'Automatic Recall.ai transcription',
        'AI meeting summaries',
        'Client pipeline management',
        'Action items & follow-ups',
        'Ask Advicly AI assistant',
        'Document uploads',
        'Email templates'
    ];

    const handleStartPayment = async () => {
        setIsLoading(true);
        setError('');

        try {
            const token = await getAccessToken();

            // Get the correct price ID based on selected plan
            const priceId = isAnnual
                ? process.env.REACT_APP_STRIPE_PRICE_ID_ANNUAL
                : process.env.REACT_APP_STRIPE_PRICE_ID;

            if (!priceId) {
                setError('Payment system is not configured. Please contact support.');
                setIsLoading(false);
                return;
            }

            // Create checkout session
            const response = await axios.post(
                `${API_BASE_URL}/api/billing/checkout`,
                { priceId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Redirect to Stripe Checkout
            if (response.data.sessionId) {
                const stripe = window.Stripe(STRIPE_PUBLIC_KEY);
                await stripe.redirectToCheckout({ sessionId: response.data.sessionId });
            }
        } catch (err) {
            console.error('Error starting payment:', err);
            setError(err.response?.data?.error || 'Failed to start payment process');
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        Complete Your Payment
                    </CardTitle>
                    <CardDescription className="text-base">
                        Unlock unlimited AI-transcribed meetings and premium features
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Pricing Card */}
                    <div className="border-2 border-primary rounded-lg p-8 bg-primary/5">
                        <div className="space-y-4">
                            {/* Plan Name */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold">Professional Plan</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Everything you need to manage your advisory business
                                    </p>
                                </div>
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                    Most Popular
                                </Badge>
                            </div>

                            {/* Price */}
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">{monthlyPrice}</span>
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {billingInfo}
                                </p>
                            </div>

                            {/* Features List */}
                            <div className="space-y-3 pt-4">
                                {features.map((feature, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Payment Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                                <p className="text-sm text-blue-900">
                                    <strong>Secure Payment:</strong> Your payment is processed securely by Stripe.
                                    Cancel anytime, no questions asked.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                        <Button
                            onClick={handleStartPayment}
                            disabled={isLoading}
                            size="lg"
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Continue to Payment'
                            )}
                        </Button>

                        <Button
                            onClick={onBack}
                            disabled={isLoading}
                            variant="outline"
                            size="lg"
                            className="w-full"
                        >
                            Back
                        </Button>
                    </div>

                    {/* Footer Info */}
                    <div className="text-xs text-muted-foreground text-center space-y-1">
                        <p>Secure payment powered by Stripe. Cancel anytime from your account settings.</p>
                        <p>By continuing, you agree to our Terms of Service and Privacy Policy.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step6_SubscriptionPlan;

