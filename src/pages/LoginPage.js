import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import GoogleIcon from '../components/GoogleIcon';

const LoginPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/meetings');
        }
    }, [isAuthenticated, navigate]);

    const handleGoogleLogin = async () => {
        // Fallback to hardcoded URL if environment variable is not set
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';
        const apiUrl = `${apiBaseUrl}/api/auth/google`;
        console.log('API Base URL:', apiBaseUrl);
        console.log('Full API URL:', apiUrl);

        try {
            const response = await fetch(apiUrl);
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                alert(`API Error: ${response.status} - ${errorText.substring(0, 200)}`);
                return;
            }

            const data = await response.json();
            console.log('API Response:', data);
            window.location.href = data.url;
        } catch (error) {
            console.error('Login error:', error);
            alert(`Login error: ${error.message}`);
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
                            Sign in with your Google account to get started.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Button
                            onClick={handleGoogleLogin}
                            className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-border shadow-soft hover:shadow-medium transition-all duration-150"
                        >
                            <GoogleIcon size={20} className="mr-3" />
                            Sign in with Google
                        </Button>
                        
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