import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import {
  Loader2,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { getSession } = useAuth();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your credentials...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('processing');
        setMessage('Verifying your credentials...');

        // Supabase Auth automatically handles the OAuth callback
        // We just need to check if we have a session
        const session = await getSession();

        if (!session) {
          setStatus('error');
          setMessage('No session found. Please try logging in again.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Check if user has completed onboarding
        setMessage('Loading your profile...');
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';
        const token = session.access_token;

        // Store the JWT token in localStorage for API calls
        localStorage.setItem('jwt', token);
        console.log('✅ JWT token stored in localStorage');

        try {
          const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const profile = await response.json();

            setStatus('success');
            setMessage('Sign in successful! Redirecting...');

            // Always redirect to meetings (onboarding page doesn't exist yet)
            setTimeout(() => navigate('/meetings'), 1000);
          } else {
            // Profile endpoint error - redirect to meetings anyway
            console.warn('Profile endpoint error, redirecting to meetings');
            setStatus('success');
            setMessage('Sign in successful! Redirecting...');
            setTimeout(() => navigate('/meetings'), 1000);
          }
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
          // Fallback: redirect to meetings
          setStatus('success');
          setMessage('Sign in successful! Redirecting...');
          setTimeout(() => navigate('/meetings'), 1000);
        }

      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate, getSession]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-large">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className={`p-3 rounded-full ${
              status === 'processing' ? 'bg-primary/10' :
              status === 'success' ? 'bg-green-500/10' :
              'bg-red-500/10'
            }`}>
              {status === 'processing' && <Shield className="w-8 h-8 text-primary" />}
              {status === 'success' && <CheckCircle className="w-8 h-8 text-green-500" />}
              {status === 'error' && <XCircle className="w-8 h-8 text-red-500" />}
            </div>
          </div>

          {status === 'processing' && (
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          <h2 className="text-xl font-semibold text-foreground mb-2">
            {status === 'processing' && 'Completing Sign In'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Error'}
          </h2>

          <p className="text-sm text-muted-foreground">
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback; 