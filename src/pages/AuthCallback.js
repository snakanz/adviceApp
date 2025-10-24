import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import {
  Loader2,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your credentials...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 AuthCallback: Starting OAuth callback processing...');
        setStatus('processing');
        setMessage('Verifying your credentials...');

        // Supabase automatically processes the hash fragment from the URL
        // We just need to wait for it to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Get the session directly from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error getting session:', error);
          throw error;
        }

        if (!session) {
          console.error('❌ No session found after OAuth callback');
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        console.log('✅ Session established:', session.user.email);

        // Note: Supabase automatically manages token storage in localStorage
        // No need to manually store the JWT token

        // Check if user profile exists and create if needed
        setMessage('Loading your profile...');
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

        try {
          const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (response.ok) {
            console.log('✅ Profile loaded successfully');
          } else {
            console.warn('⚠️ Profile endpoint returned:', response.status);
          }
        } catch (profileError) {
          console.warn('⚠️ Error fetching profile:', profileError);
        }

        // Auto-connect Google Calendar if user signed in with Google
        setMessage('Connecting your calendar...');
        try {
          const calendarResponse = await fetch(`${apiBaseUrl}/api/auth/auto-connect-calendar`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (calendarResponse.ok) {
            const calendarData = await calendarResponse.json();
            if (calendarData.success) {
              console.log('✅ Google Calendar auto-connected:', calendarData.message);
            } else {
              console.log('ℹ️ Calendar not connected:', calendarData.message);
            }
          } else {
            console.warn('⚠️ Calendar auto-connect returned:', calendarResponse.status);
          }
        } catch (calendarError) {
          console.warn('⚠️ Error auto-connecting calendar:', calendarError);
          // Don't fail the login if calendar connection fails
        }

        // Success - redirect to meetings
        setStatus('success');
        setMessage('Sign in successful! Redirecting...');

        // Redirect after a short delay
        setTimeout(() => {
          console.log('🔄 Redirecting to /meetings...');
          navigate('/meetings', { replace: true });
        }, 1000);

      } catch (err) {
        console.error('❌ Auth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

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