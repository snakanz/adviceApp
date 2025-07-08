import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Button, Container, Typography, Card, Stack } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

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
        <Box
            sx={{
                minHeight: '100vh',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3
            }}
        >
            <Container maxWidth="sm">
                <Card
                    sx={{
                        p: 6,
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E5E5'
                    }}
                >
                    <Stack spacing={4} alignItems="center">
                        <Box textAlign="center">
                            <Typography 
                                variant="h1" 
                                sx={{ 
                                    fontSize: '32px',
                                    fontWeight: 700,
                                    color: '#1E1E1E',
                                    mb: 2
                                }}
                            >
                                Welcome to Dashboard
                            </Typography>
                            
                            <Typography 
                                variant="body1" 
                                sx={{ 
                                    color: '#3C3C3C',
                                    fontSize: '16px',
                                    lineHeight: 1.6,
                                    maxWidth: '400px',
                                    mx: 'auto'
                                }}
                            >
                                Your AI-powered dashboard for managing meetings, clients, and insights. 
                                Sign in with your Google account to get started.
                            </Typography>
                        </Box>

                        <Button
                            variant="contained"
                            startIcon={<GoogleIcon />}
                            onClick={handleGoogleLogin}
                            sx={{
                                backgroundColor: '#007AFF',
                                color: '#FFFFFF',
                                fontWeight: 500,
                                fontSize: '16px',
                                py: 2,
                                px: 4,
                                borderRadius: '8px',
                                textTransform: 'none',
                                boxShadow: 'none',
                                minWidth: '240px',
                                '&:hover': {
                                    backgroundColor: '#0056CC',
                                    boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
                                }
                            }}
                        >
                            Sign in with Google
                        </Button>

                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: '#999999',
                                fontSize: '12px',
                                textAlign: 'center',
                                mt: 3
                            }}
                        >
                            By signing in, you agree to our Terms of Service and Privacy Policy
                        </Typography>
                    </Stack>
                </Card>
            </Container>
        </Box>
    );
};

export default LoginPage; 