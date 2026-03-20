import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Check } from 'lucide-react';

const PricingPage = () => {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'annual'

    const freePlanFeatures = [
        '5 AI-transcribed meetings',
        'Meeting summaries',
        'Client management',
        'Basic pipeline tracking',
        'Action items & follow-ups'
    ];

    const paidPlanFeatures = [
        'Unlimited AI-transcribed meetings',
        'Advanced AI meeting summaries',
        'Full client pipeline management',
        'Action items & follow-ups',
        'Ask Advicly AI assistant',
        'Document uploads',
        'Email templates',
        'Priority support'
    ];

    const handleSelectPlan = () => {
        // Navigate to register page (plan selection happens in onboarding)
        navigate('/register');
    };

    const handleSignIn = () => {
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <img
                            src="https://xjqjzievgepqpgtggcjx.supabase.co/storage/v1/object/sign/assets/Advicly%20(400%20x%20100%20px).svg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81NTIwYjQ4Yi00ZTE5LTQ1ZGQtYTYxNC1kZTk5NzMwZTBiMmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvQWR2aWNseSAoNDAwIHggMTAwIHB4KS5zdmciLCJpYXQiOjE3NjUyODM0NTcsImV4cCI6MTgyODM1NTQ1N30.yJa3VGx3OEyV3yrCDZ20KS2FMKr6fNiNp7McqkQ17jo"
                            alt="Advicly Logo"
                            className="h-8 w-auto"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        onClick={handleSignIn}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Sign in
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8">
                        Start with 5 free AI-transcribed meetings, then upgrade for unlimited access
                    </p>

                    {/* Billing Toggle */}
                    <div className="inline-flex items-center bg-muted rounded-full p-1">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                                billingCycle === 'monthly'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Monthly Billing
                        </button>
                        <button
                            onClick={() => setBillingCycle('annual')}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                                billingCycle === 'annual'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Annual Billing
                            <Badge className="ml-2 bg-accent text-accent-foreground border-0 text-xs">
                                Save 20%
                            </Badge>
                        </button>
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg">
                        <span className="font-bold">Step 1</span>
                        <span className="text-sm">Add users & select your plan</span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Free Plan */}
                    <Card className="shadow-large border-border/50 hover:shadow-xl transition-shadow">
                        <CardHeader className="space-y-4">
                            <div>
                                <CardTitle className="text-2xl font-bold mb-2">
                                    Free
                                </CardTitle>
                                <CardDescription className="text-base">
                                    Explore the Advicly platform to find leads, manage pipeline & close deals.
                                </CardDescription>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-bold">£0</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    5 free AI-transcribed meetings
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Features List */}
                            <div className="space-y-3">
                                {freePlanFeatures.map((feature, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Button */}
                            <Button
                                onClick={handleSelectPlan}
                                size="lg"
                                className="w-full text-base h-12 bg-primary hover:bg-primary/90"
                            >
                                Get started
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Paid Plan */}
                    <Card className="shadow-large border-2 border-primary hover:shadow-xl transition-shadow relative">
                        {/* Most Popular Badge */}
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-accent text-accent-foreground border-0 px-4 py-1 text-sm font-bold">
                                MOST POPULAR
                            </Badge>
                        </div>

                        <CardHeader className="space-y-4 pt-8">
                            <div>
                                <CardTitle className="text-2xl font-bold mb-2">
                                    Professional
                                </CardTitle>
                                <CardDescription className="text-base">
                                    Optimize your sales process with multi-touch outreach, AI & automation.
                                </CardDescription>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-bold">
                                        {billingCycle === 'monthly' ? '£70' : '£56'}
                                    </span>
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {billingCycle === 'monthly' 
                                        ? 'Billed monthly' 
                                        : 'Billed annually (£672/year)'}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Features List */}
                            <div className="space-y-3">
                                {paidPlanFeatures.map((feature, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-medium">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Button */}
                            <Button
                                onClick={handleSelectPlan}
                                size="lg"
                                className="w-full text-base h-12 bg-primary hover:bg-primary/90"
                            >
                                Get started
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-muted-foreground">
                                    Cancel anytime
                                </p>
                            </div>

                            {/* Credits Info */}
                            <div className="pt-4 border-t border-border">
                                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <span>💳</span>
                                    <div>
                                        <p className="font-medium">Unlimited AI transcription credits</p>
                                        <p className="text-xs">per user/month granted upfront</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer Info */}
                <div className="text-center mt-12 text-sm text-muted-foreground">
                    <p>All plans include automatic calendar sync and client management</p>
                    <p className="mt-2">
                        By signing up, you agree to our{' '}
                        <button className="underline hover:text-foreground">Terms of Service</button>
                        {' '}and{' '}
                        <button className="underline hover:text-foreground">Privacy Policy</button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;

