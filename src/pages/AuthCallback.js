import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Box, CircularProgress, Typography } from '@mui/material';

const AuthCallback = () => {
  const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

  useEffect(() => {
        const handleCallback = async () => {
            try {
                const params = new URLSearchParams(location.search);
                const token = params.get('token');
                const error = params.get('error');

                if (error) {
                    console.error('Authentication error:', error);
                    navigate('/login');
                    return;
                }

                if (!token) {
                    console.error('No token received');
                    navigate('/login');
                    return;
                }

                // Set the token in the API service
                api.setToken(token);

                // Verify the token and get user info
                const user = await api.verifyToken();
                
                // Login the user
                login(token, user);

                // Redirect to meetings page
                navigate('/meetings');
            } catch (error) {
                console.error('Error processing authentication:', error);
                navigate('/login');
    }
        };

        handleCallback();
    }, [navigate, login, location]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: 2
            }}
        >
            <CircularProgress />
            <Typography>
                Completing sign in...
            </Typography>
        </Box>
    );
};

export default AuthCallback; 