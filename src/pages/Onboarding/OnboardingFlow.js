import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import BusinessProfile from './Step2_BusinessProfile';
import CalendarChoice from './Step3_CalendarChoice';
import CalendarConnect from './Step4_CalendarConnect';
import InitialSync from './Step5_InitialSync';
import Complete from './Step6_Complete';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const OnboardingFlow = () => {
    const navigate = useNavigate();
    const { user, getAccessToken, isAuthenticated } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [onboardingData, setOnboardingData] = useState({
        business_name: '',
        business_type: '',
        team_size: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendar_provider: null,
        tenant_id: null
    });

    // Load onboarding status on mount
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        loadOnboardingStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, navigate]);

    const loadOnboardingStatus = async () => {
        try {
            const token = await getAccessToken();
            const response = await axios.get(`${API_BASE_URL}/api/auth/onboarding/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { onboarding_completed, onboarding_step, business_name, tenant_id } = response.data;

            // If onboarding is already complete, redirect to main app
            if (onboarding_completed) {
                console.log('✅ Onboarding already completed, redirecting to app...');
                navigate('/meetings');
                return;
            }

            // Resume from saved step (or start at step 2 if step is 0 or 1)
            const resumeStep = onboarding_step > 1 ? onboarding_step : 2;
            setCurrentStep(resumeStep);

            // Load any saved data
            setOnboardingData(prev => ({
                ...prev,
                business_name: business_name || '',
                tenant_id: tenant_id || null
            }));

            setIsLoading(false);
        } catch (error) {
            console.error('Error loading onboarding status:', error);
            setIsLoading(false);
            // Start from step 2 if there's an error
            setCurrentStep(2);
        }
    };

    const updateOnboardingStep = async (step) => {
        try {
            const token = await getAccessToken();
            await axios.put(
                `${API_BASE_URL}/api/auth/onboarding/step`,
                { step },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Error updating onboarding step:', error);
        }
    };

    const handleNext = async (stepData = {}) => {
        // Update onboarding data with step-specific data
        setOnboardingData(prev => ({ ...prev, ...stepData }));

        // Move to next step
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);

        // Save progress to database
        await updateOnboardingStep(nextStep);
    };

    const handleBack = () => {
        if (currentStep > 2) {
            const prevStep = currentStep - 1;
            setCurrentStep(prevStep);
            updateOnboardingStep(prevStep);
        }
    };

    const handleSkipCalendar = async () => {
        try {
            const token = await getAccessToken();
            await axios.post(
                `${API_BASE_URL}/api/auth/onboarding/skip-calendar`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Jump to completion step
            setCurrentStep(6);
        } catch (error) {
            console.error('Error skipping calendar:', error);
        }
    };

    const handleComplete = async () => {
        try {
            const token = await getAccessToken();
            await axios.post(
                `${API_BASE_URL}/api/auth/onboarding/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('✅ Onboarding completed!');
            navigate('/meetings');
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Progress Bar */}
            <div className="bg-card border-b border-border">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <img 
                                src={process.env.PUBLIC_URL + '/logo-advicly.png'} 
                                alt="Advicly" 
                                className="h-8 w-auto" 
                            />
                            <span className="text-sm font-medium text-muted-foreground">
                                Setup
                            </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            Step {currentStep - 1} of 5
                        </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                        <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Step Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                {currentStep === 2 && (
                    <BusinessProfile
                        data={onboardingData}
                        onNext={handleNext}
                        user={user}
                    />
                )}

                {currentStep === 3 && (
                    <CalendarChoice
                        data={onboardingData}
                        onNext={handleNext}
                        onBack={handleBack}
                        onSkip={handleSkipCalendar}
                    />
                )}

                {currentStep === 4 && (
                    <CalendarConnect
                        data={onboardingData}
                        onNext={handleNext}
                        onBack={handleBack}
                        onSkip={handleSkipCalendar}
                    />
                )}

                {currentStep === 5 && (
                    <InitialSync
                        data={onboardingData}
                        onNext={handleNext}
                        onBack={handleBack}
                    />
                )}

                {currentStep === 6 && (
                    <Complete
                        data={onboardingData}
                        onComplete={handleComplete}
                    />
                )}
            </div>
        </div>
    );
};

export default OnboardingFlow;

