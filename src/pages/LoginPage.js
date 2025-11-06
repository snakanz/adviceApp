import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import GoogleIcon from '../components/GoogleIcon';
import OutlookIcon from '../components/OutlookIcon';

const LoginPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, signInWithEmail, signInWithOAuth } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/meetings');
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(''); // Clear error when user types
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.email.trim() || !formData.password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);

        try {
            const result = await signInWithEmail(formData.email, formData.password);

            if (!result.success) {
                setError(result.error || 'Login failed');
                setIsLoading(false);
                return;
            }

            // Success - AuthContext will handle redirect
            console.log('✅ Login successful');
        } catch (err) {
            console.error('Login error:', err);
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError('');
            const result = await signInWithOAuth('google', {
                redirectTo: `${window.location.origin}/auth/callback`
            });

            if (!result.success) {
                console.error('Login error:', result.error);
                setError(`Login error: ${result.error}`);
            }
            // Supabase will redirect to Google OAuth automatically
        } catch (error) {
            console.error('Login error:', error);
            setError(`Login error: ${error.message}`);
        }
    };

    const handleMicrosoftLogin = async () => {
        try {
            setError('');
            const result = await signInWithOAuth('azure', {
                redirectTo: `${window.location.origin}/auth/callback`
            });

            if (!result.success) {
                console.error('Microsoft login error:', result.error);
                setError(`Microsoft login error: ${result.error}`);
            }
            // Supabase will redirect to Microsoft OAuth automatically
        } catch (error) {
            console.error('Microsoft login error:', error);
            setError(`Microsoft login error: ${error.message}`);
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
                            Welcome to Advicly
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground max-w-sm mx-auto">
                            Your AI-powered dashboard for managing meetings, clients, and insights.
                            Sign in with your account to get started.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* OAuth Sign In Buttons */}
                        <div className="space-y-3">
                            <Button
                                onClick={handleGoogleLogin}
                                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                                disabled={isLoading}
                            >
                                <GoogleIcon size={20} className="mr-3" />
                                Sign in with Google
                            </Button>

                            <Button
                                onClick={handleMicrosoftLogin}
                                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                                disabled={isLoading}
                            >
                                <OutlookIcon size={20} className="mr-3" />
                                Sign in with Microsoft
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

                        {/* Email Login Form */}
                        <form onSubmit={handleEmailLogin} className="space-y-4">
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
                                {isLoading ? 'Signing in...' : 'Sign in'}
                            </Button>
                        </form>

                        <div className="text-center text-sm text-muted-foreground">
                            Don't have an account?{' '}
                            <Link
                                to="/pricing"
                                className="text-primary hover:underline font-medium"
                            >
                                Sign up
                            </Link>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            By signing in, you agree to our Terms of Service and Privacy Policy
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LoginPage; 