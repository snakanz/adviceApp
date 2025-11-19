import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';
import { supabase } from '../lib/supabase';

const RegisterPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const selectedPlan = searchParams.get('plan') || 'free'; // Get plan from URL
    const { isAuthenticated, signUpWithEmail, signInWithOAuth } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // Store selected plan in session storage on mount
    useEffect(() => {
        if (selectedPlan) {
            sessionStorage.setItem('selectedPlan', selectedPlan);
        }
    }, [selectedPlan]);

    useEffect(() => {
        if (isAuthenticated) {
            // Get plan from session storage (in case of OAuth redirect)
            const plan = sessionStorage.getItem('selectedPlan') || selectedPlan;
            // Pass selected plan to onboarding
            navigate(`/onboarding?plan=${plan}`);
        }
    }, [isAuthenticated, navigate, selectedPlan]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(''); // Clear error when user types
    };

    const handleEmailRegister = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.name.trim()) {
            setError('Please enter your name');
            return;
        }

        if (!formData.email.trim()) {
            setError('Please enter your email');
            return;
        }

        if (!formData.password) {
            setError('Please enter a password');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            // Attempt to sign up
            const result = await signUpWithEmail(
                formData.email,
                formData.password,
                { name: formData.name }
            );

            if (!result.success) {
                // Check if error indicates user already exists
                const errorMsg = result.error?.toLowerCase() || '';

                console.log('📧 Signup error:', result.error);

                // Supabase returns "User already registered" when email exists
                if (errorMsg.includes('already registered') ||
                    errorMsg.includes('already exists') ||
                    errorMsg.includes('user already registered')) {
                    console.log('❌ User already exists');
                    setError(
                        <span>
                            An account with this email already exists. Please{' '}
                            <Link to="/login" className="text-primary hover:underline font-semibold">
                                sign in
                            </Link>{' '}
                            instead.
                        </span>
                    );
                } else {
                    setError(result.error || 'Registration failed');
                }
                setIsLoading(false);
                return;
            }

            // Supabase may return success even if user exists (for security)
            // Check if we got a user back
            if (result.data?.user) {
                // Check if this is a new signup or existing user
                // New signups with email confirmation will have identities
                const isNewUser = result.data.user.identities && result.data.user.identities.length > 0;

                if (!isNewUser && !result.data.session) {
                    // User exists but no session = already registered, email not confirmed
                    console.log('❌ User already exists (no identities, no session)');
                    setError(
                        <span>
                            An account with this email already exists. Please{' '}
                            <Link to="/login" className="text-primary hover:underline font-semibold">
                                sign in
                            </Link>{' '}
                            instead, or check your email for the confirmation link.
                        </span>
                    );
                    setIsLoading(false);
                    return;
                }
            }

            // Check if email confirmation is required
            if (result.data?.user && !result.data?.session) {
                console.log('✅ Registration successful - email confirmation required');
                setEmailSent(true);
                setIsLoading(false);
                return;
            }

            // Success - redirect to onboarding
            console.log('✅ Registration successful, redirecting to onboarding...');
            navigate('/onboarding');
        } catch (err) {
            console.error('Registration error:', err);
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        try {
            setError('');
            const result = await signInWithOAuth('google', {
                redirectTo: `${window.location.origin}/auth/callback`
            });

            if (!result.success) {
                console.error('Google registration error:', result.error);
                setError(`Google registration error: ${result.error}`);
            }
            // Supabase will redirect to Google OAuth automatically
        } catch (error) {
            console.error('Google registration error:', error);
            setError(`Google registration error: ${error.message}`);
        }
    };

    const handleMicrosoftRegister = async () => {
        try {
            setError('');
            const result = await signInWithOAuth('azure', {
                redirectTo: `${window.location.origin}/auth/callback`
            });

            if (!result.success) {
                console.error('Microsoft registration error:', result.error);
                setError(`Microsoft registration error: ${result.error}`);
            }
            // Supabase will redirect to Microsoft OAuth automatically
        } catch (error) {
            console.error('Microsoft registration error:', error);
            setError(`Microsoft registration error: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <Card className="shadow-large border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="text-center space-y-4">
                        <div className="flex justify-center mb-4">
                            <img 
                                src={process.env.PUBLIC_URL + '/logo-advicly.png'} 
                                alt="Advicly Logo" 
                                className="h-12 w-auto" 
                            />
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground">
                            Create Your Account
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground max-w-sm mx-auto">
                            Join Advicly to manage your meetings, clients, and insights with AI-powered tools.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* OAuth Sign Up Buttons */}
                        <div className="space-y-3">
                            <Button
                                onClick={handleGoogleRegister}
                                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                                disabled={isLoading}
                            >
                                <GoogleIcon size={20} className="mr-3" />
                                Sign up with Google
                            </Button>

                            <Button
                                onClick={handleMicrosoftRegister}
                                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                                disabled={isLoading}
                            >
                                <OutlookIcon size={20} className="mr-3" />
                                Sign up with Microsoft
                            </Button>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">
                                    Or continue with email
                                </span>
                            </div>
                        </div>

                        {/* Email Registration Form */}
                        <form onSubmit={handleEmailRegister} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                    {error}
                                </div>
                            )}

                            {emailSent && (
                                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md space-y-2">
                                    <p className="font-semibold">✅ Check your email!</p>
                                    <p>We've sent a confirmation link to <strong>{formData.email}</strong>. Click the link in the email to complete your registration.</p>
                                    <p className="text-xs text-green-600 mt-2">Don't see it? Check your spam folder.</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-medium"
                                disabled={isLoading || emailSent}
                            >
                                {isLoading ? 'Creating Account...' : emailSent ? 'Email Sent - Check Your Inbox' : 'Create Account'}
                            </Button>
                        </form>

                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link 
                                to="/login" 
                                className="text-primary hover:underline font-medium"
                            >
                                Sign in
                            </Link>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            By creating an account, you agree to our{' '}
                            <button onClick={() => {}} className="underline hover:text-foreground">Terms of Service</button>
                            {' '}and{' '}
                            <button onClick={() => {}} className="underline hover:text-foreground">Privacy Policy</button>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default RegisterPage;

