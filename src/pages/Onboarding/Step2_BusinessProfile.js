import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

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

        setIsLoading(true);

        try {
            const token = await getAccessToken();
            const response = await axios.post(
                `${API_BASE_URL}/api/auth/onboarding/business-profile`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('✅ Business profile saved:', response.data);

            // Pass tenant_id to next step
            onNext({
                ...formData,
                tenant_id: response.data.tenant_id
            });
        } catch (err) {
            console.error('Error saving business profile:', err);
            setError(err.response?.data?.error || 'Failed to save business profile');
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* LEFT COLUMN - Content */}
                <div className="space-y-8">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Question 1 of 4
                    </p>

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

                {/* RIGHT COLUMN - Illustration */}
                <div className="hidden lg:flex items-center justify-center">
                    <div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border">
                        <span className="text-muted-foreground text-sm">Business Setup Illustration</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step2_BusinessProfile;

