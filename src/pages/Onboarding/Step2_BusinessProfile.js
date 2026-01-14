import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Check } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

const BUSINESS_TYPES = [
    'Financial Advisor',
    'Wealth Manager',
    'Investment Advisor',
    'Insurance Advisor',
    'Mortgage Broker',
    'Financial Planner',
    'Other'
];

const TEAM_SIZES = [
    { value: 1, label: 'Just me' },
    { value: 2, label: '2-5 people' },
    { value: 6, label: '6-10 people' },
    { value: 11, label: '11-25 people' },
    { value: 26, label: '26+ people' }
];

const Step2_BusinessProfile = ({ data, onNext, user }) => {
    const { getAccessToken } = useAuth();
    const [formData, setFormData] = useState({
        business_name: data.business_name || '',
        business_type: data.business_type || 'Financial Advisor',
        team_size: data.team_size || 1,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    const [selectedPlan, setSelectedPlan] = useState(data.selected_plan || null);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.business_name.trim()) {
            setError('Please enter your business name');
            return;
        }

        if (!selectedPlan) {
            setError('Please select a plan to continue');
            return;
        }

        setIsLoading(true);

        try {
            const token = await getAccessToken();
            const response = await axios.post(
                `${API_BASE_URL}/api/auth/onboarding/business-profile`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('✅ Business profile saved:', response.data);

            // Determine the actual plan value to pass
            let planValue = selectedPlan;
            if (selectedPlan === 'professional' && billingCycle === 'annual') {
                planValue = 'professional_annual';
            }

            // If FREE plan, proceed to calendar setup
            if (selectedPlan === 'free') {
                onNext({
                    ...formData,
                    tenant_id: response.data.tenant_id,
                    selected_plan: planValue
                });
                return;
            }

            // If PAID plan, redirect directly to Stripe checkout (skip confirmation screen)
            console.log('💳 Redirecting to Stripe checkout...', { plan: planValue, billingCycle });

            // Get the correct price ID based on billing cycle
            const priceId = billingCycle === 'annual'
                ? process.env.REACT_APP_STRIPE_PRICE_ID_ANNUAL
                : process.env.REACT_APP_STRIPE_PRICE_ID;

            if (!priceId) {
                setError('Payment system is not configured. Please contact support.');
                setIsLoading(false);
                return;
            }

            // Create checkout session
            const checkoutResponse = await axios.post(
                `${API_BASE_URL}/api/billing/checkout`,
                { priceId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Save plan info before redirect
            sessionStorage.setItem('selectedPlan', planValue);
            sessionStorage.setItem('onboarding_data', JSON.stringify({
                ...formData,
                tenant_id: response.data.tenant_id,
                selected_plan: planValue
            }));

            // Redirect to Stripe Checkout
            if (checkoutResponse.data.sessionId) {
                const stripe = window.Stripe(STRIPE_PUBLIC_KEY);
                await stripe.redirectToCheckout({ sessionId: checkoutResponse.data.sessionId });
            } else {
                throw new Error('No session ID received from checkout');
            }
        } catch (err) {
            console.error('Error in submit:', err);
            setError(err.response?.data?.error || err.message || 'Failed to process. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* LEFT COLUMN - Content */}
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-foreground">
                            Tell us about your business
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            This helps us personalize your experience
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Business Name */}
                        <div className="space-y-2">
                            <Label htmlFor="business_name" className="text-sm font-medium text-foreground">
                                Business Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="business_name"
                                name="business_name"
                                type="text"
                                placeholder="e.g., Smith Financial Advisors"
                                value={formData.business_name}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                                className="text-base"
                            />
                        </div>

                        {/* Business Type - Button Pills */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                                Business Type
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {BUSINESS_TYPES.map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, business_type: type }))}
                                        disabled={isLoading}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                            formData.business_type === type
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border text-foreground hover:border-primary/50'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team Size - Button Pills */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                                Team Size
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {TEAM_SIZES.map(size => (
                                    <button
                                        key={size.value}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, team_size: size.value }))}
                                        disabled={isLoading}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                            formData.team_size === size.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border text-foreground hover:border-primary/50'
                                        }`}
                                    >
                                        {size.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Timezone */}
                        <div className="space-y-2">
                            <Label htmlFor="timezone" className="text-sm font-medium text-foreground">
                                Timezone
                            </Label>
                            <Input
                                id="timezone"
                                name="timezone"
                                type="text"
                                value={formData.timezone}
                                onChange={handleChange}
                                disabled={isLoading}
                                className="text-base"
                            />
                            <p className="text-xs text-muted-foreground">
                                Detected automatically from your browser
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-8">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isLoading}
                                className="ml-auto"
                            >
                                {isLoading ? 'Saving...' : 'Continue'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* RIGHT COLUMN - Plan Selection */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-foreground">
                            Choose Your Plan
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Select a plan to continue <span className="text-red-500">*</span>
                        </p>
                    </div>

                    {/* Free Plan Card */}
                    <Card
                        className={`cursor-pointer transition-all ${
                            selectedPlan === 'free'
                                ? 'border-2 border-primary shadow-lg'
                                : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedPlan('free')}
                    >
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-xl font-bold">Free</CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                        Try Advicly with 5 free meetings
                                    </CardDescription>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    selectedPlan === 'free'
                                        ? 'border-primary bg-primary'
                                        : 'border-border'
                                }`}>
                                    {selectedPlan === 'free' && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">£0</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    5 free AI-transcribed meetings
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm">5 AI-transcribed meetings</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm">Meeting summaries</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm">Client management</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm">Basic pipeline tracking</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Professional Plan Card */}
                    <Card
                        className={`cursor-pointer transition-all relative ${
                            selectedPlan === 'professional'
                                ? 'border-2 border-primary shadow-lg'
                                : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedPlan('professional')}
                    >
                        {/* Most Popular Badge */}
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-yellow-400 text-black border-0 px-3 py-1 text-xs font-bold">
                                MOST POPULAR
                            </Badge>
                        </div>

                        <CardHeader className="space-y-3 pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-xl font-bold">Professional</CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                        Unlimited meetings & AI features
                                    </CardDescription>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    selectedPlan === 'professional'
                                        ? 'border-primary bg-primary'
                                        : 'border-border'
                                }`}>
                                    {selectedPlan === 'professional' && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">
                                        {billingCycle === 'monthly' ? '£70' : '£56'}
                                    </span>
                                    <span className="text-muted-foreground text-sm">/month</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {billingCycle === 'monthly'
                                        ? 'Billed monthly'
                                        : 'Billed annually (£672/year)'}
                                </p>
                            </div>

                            {/* Billing Cycle Toggle */}
                            {selectedPlan === 'professional' && (
                                <div className="inline-flex items-center bg-muted rounded-full p-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBillingCycle('monthly');
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            billingCycle === 'monthly'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        Monthly
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBillingCycle('annual');
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            billingCycle === 'annual'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        Annual
                                        <Badge className="ml-1 bg-yellow-400 text-black border-0 text-[10px] px-1">
                                            -20%
                                        </Badge>
                                    </button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Unlimited AI-transcribed meetings</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Advanced AI summaries</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Full pipeline management</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Ask Advicly AI assistant</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Document uploads</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">Priority support</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Step2_BusinessProfile;

