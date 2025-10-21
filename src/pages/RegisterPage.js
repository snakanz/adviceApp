import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import GoogleIcon from '../components/GoogleIcon';

const RegisterPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, signUpWithEmail, signInWithOAuth } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/onboarding');
        }
    }, [isAuthenticated, navigate]);

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
            const result = await signUpWithEmail(
                formData.email,
                formData.password,
                { name: formData.name }
            );

            if (!result.success) {
                setError(result.error || 'Registration failed');
                setIsLoading(false);
                return;
            }

            // Check if email confirmation is required
            if (result.data?.user && !result.data?.session) {
                setError('Please check your email to confirm your account');
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
                        {/* Google Sign Up Button */}
                        <Button
                            onClick={handleGoogleRegister}
                            className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                            disabled={isLoading}
                        >
                            <GoogleIcon size={20} className="mr-3" />
                            Sign up with Google
                        </Button>

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

                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-medium"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Creating Account...' : 'Create Account'}
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
                            <a href="#" className="underline hover:text-foreground">Terms of Service</a>
                            {' '}and{' '}
                            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default RegisterPage;

