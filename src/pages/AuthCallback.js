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
        setMessage('Setting up your account...');

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

        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

        // Fetch profile to check onboarding status
        let onboardingCompleted = false;
        try {
          const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (response.ok) {
            const profileData = await response.json();
            onboardingCompleted = profileData.onboarding_completed || false;
            console.log('✅ Profile loaded successfully. Onboarding completed:', onboardingCompleted);
          } else {
            console.warn('⚠️ Profile endpoint returned:', response.status);
          }
        } catch (profileError) {
          console.warn('⚠️ Error fetching profile:', profileError);
        }

        // Auto-connect Google Calendar in background (don't wait for it)
        // This runs asynchronously and won't block the redirect
        fetch(`${apiBaseUrl}/api/auth/auto-connect-calendar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              console.log('✅ Google Calendar auto-connected:', data.message);
            } else {
              console.log('ℹ️ Calendar not connected:', data.message);
            }
          })
          .catch(error => {
            console.warn('⚠️ Error auto-connecting calendar:', error);
          });

        // Success - redirect immediately (don't wait for calendar)
        setStatus('success');
        setMessage('Redirecting...');

        // Redirect immediately
        setTimeout(() => {
          if (onboardingCompleted) {
            console.log('🔄 Onboarding complete - Redirecting to /meetings...');
            navigate('/meetings', { replace: true });
          } else {
            console.log('🔄 Onboarding incomplete - Redirecting to /onboarding...');
            navigate('/onboarding', { replace: true });
          }
        }, 500);

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
            {status === 'processing' && 'Setting Up Your Account'}
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