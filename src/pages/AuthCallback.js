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
        // DETECTION LOGIC - Check URL parameters to determine auth type
        const params = new URLSearchParams(window.location.search);
        const urlHash = new URLSearchParams(window.location.hash.substring(1));

        // Email confirmation URLs have 'type=signup' or 'token_hash' parameter
        const isEmailConfirmation = params.get('type') === 'signup' ||
                                     params.get('type') === 'email' ||
                                     urlHash.get('type') === 'signup' ||
                                     params.has('token_hash') ||
                                     urlHash.has('token_hash');

        if (isEmailConfirmation) {
          console.log('📧 AuthCallback: Detected email confirmation flow');
          await handleEmailConfirmation();
        } else {
          console.log('🔐 AuthCallback: Detected OAuth callback flow');
          await handleOAuthCallback();
        }

      } catch (err) {
        console.error('❌ Auth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    // Handle email confirmation flow (email/password signup)
    const handleEmailConfirmation = async () => {
      console.log('📧 Processing email confirmation...');
      setStatus('processing');
      setMessage('Confirming your email...');

      // Wait a moment for Supabase to establish the session after email confirmation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Error getting session after email confirmation:', error);
        throw error;
      }

      if (!session) {
        console.error('❌ No session found after email confirmation');
        setStatus('error');
        setMessage('Email confirmation failed. Please try logging in.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      console.log('✅ Email confirmed, session established:', session.user.email);

      // Complete the auth flow (shared logic)
      await completeAuthFlow(session, false); // false = don't auto-connect calendar for email users
    };

    // Handle OAuth callback flow (Google/Microsoft)
    const handleOAuthCallback = async () => {
      console.log('🔐 Processing OAuth callback...');
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

      console.log('✅ OAuth session established:', session.user.email);

      // Complete the auth flow (shared logic)
      await completeAuthFlow(session, true); // true = auto-connect calendar for OAuth users
    };

    // Shared completion logic for both email and OAuth flows
    const completeAuthFlow = async (session, shouldAutoConnectCalendar) => {
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

      // Auto-connect calendar only for OAuth users (Google/Microsoft)
      if (shouldAutoConnectCalendar) {
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
      }

      // Success - redirect
      setStatus('success');
      setMessage('Redirecting...');

      setTimeout(() => {
        if (onboardingCompleted) {
          console.log('🔄 Onboarding complete - Redirecting to /meetings...');
          navigate('/meetings', { replace: true });
        } else {
          console.log('🔄 Onboarding incomplete - Redirecting to /onboarding...');
          navigate('/onboarding', { replace: true });
        }
      }, 500);
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