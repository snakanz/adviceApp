import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
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
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        Tell us about your business
                    </CardTitle>
                    <CardDescription className="text-base">
                        This helps us personalize your experience
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="business_name">
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
                            <p className="text-sm text-muted-foreground">
                                This will be displayed on your dashboard and reports
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="business_type">
                                Business Type
                            </Label>
                            <select
                                id="business_type"
                                name="business_type"
                                value={formData.business_type}
                                onChange={handleChange}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {BUSINESS_TYPES.map(type => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="team_size">
                                Team Size
                            </Label>
                            <select
                                id="team_size"
                                name="team_size"
                                value={formData.team_size}
                                onChange={handleChange}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {TEAM_SIZES.map(size => (
                                    <option key={size.value} value={size.value}>
                                        {size.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="timezone">
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
                            <p className="text-sm text-muted-foreground">
                                Detected automatically from your browser
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isLoading}
                                className="min-w-[150px]"
                            >
                                {isLoading ? 'Saving...' : 'Continue'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step2_BusinessProfile;

