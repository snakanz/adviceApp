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
        const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/google`);
        const data = await response.json();
        window.location.href = data.url;
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <Card className="shadow-lg border-0">
                    <CardHeader className="text-center space-y-4">
                        <CardTitle className="text-3xl font-bold text-foreground">
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
                            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                        >
                            <GoogleIcon size={20} className="mr-2" />
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