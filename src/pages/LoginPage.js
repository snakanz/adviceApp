import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Box, Button, Container, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

const LoginPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/meetings');
        }
    }, [isAuthenticated, navigate]);

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:4000/api/calendar/auth/google';
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3
                }}
            >
                <Typography component="h1" variant="h4">
                    Welcome to Marloo Dashboard
                </Typography>
                
                <Typography variant="body1" color="text.secondary" align="center">
                    Sign in with your Google account to access your meetings and calendar.
                </Typography>

                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<GoogleIcon />}
                    onClick={handleGoogleLogin}
                    size="large"
                >
                    Sign in with Google
                </Button>
            </Box>
        </Container>
    );
};

export default LoginPage; 