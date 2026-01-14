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
import { getMobileWaitTime, logMobileDebugInfo, isMobile } from '../utils/mobileAuthFix';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your credentials...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // MOBILE FIX: Log mobile debug info
        logMobileDebugInfo();

        // IMPROVED DETECTION LOGIC - Distinguish between OAuth and email confirmation
        const params = new URLSearchParams(window.location.search);
        const urlHash = new URLSearchParams(window.location.hash.substring(1));

        console.log('🔍 AuthCallback: Analyzing URL...', { isMobile: isMobile() });
        console.log('🔍 Query params:', window.location.search);
        console.log('🔍 Hash params:', window.location.hash);

        // OAuth callbacks have access_token or code in the URL
        // Google/Microsoft OAuth returns: #access_token=... or ?code=...
        const hasOAuthTokens = urlHash.has('access_token') ||
                               params.has('code') ||
                               urlHash.has('code');

        if (hasOAuthTokens) {
          // This is definitely OAuth (Google/Microsoft)
          console.log('🔐 AuthCallback: Detected OAuth callback flow (has access_token or code)');
          await handleOAuthCallback();
        } else {
          // No OAuth tokens in URL - check if we have a session
          // Email confirmations redirect without tokens but create a session
          console.log('📧 AuthCallback: No OAuth tokens found, checking for email confirmation...');

          // MOBILE FIX: Wait longer on mobile for session establishment
          const waitTime = getMobileWaitTime();
          console.log(`⏱️  Waiting ${waitTime}ms for session (mobile: ${isMobile()})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            // Session exists without OAuth tokens = email confirmation
            console.log('📧 AuthCallback: Detected email confirmation flow (session exists, no OAuth tokens)');
            await handleEmailConfirmation();
          } else {
            // No OAuth tokens and no session = error
            console.error('❌ AuthCallback: No OAuth tokens and no session found');
            setStatus('error');
            setMessage('Authentication failed. Please try again.');
            setTimeout(() => navigate('/login'), 3000);
          }
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

      // Get the session (already waited 500ms in detection logic)
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

      // Check if returning from onboarding OAuth redirect
      const onboardingState = sessionStorage.getItem('onboarding_state');

      if (onboardingState) {
        console.log('🔄 Detected onboarding OAuth return, restoring state...');
        const state = JSON.parse(onboardingState);

        // Mark OAuth as successful in sessionStorage for Step3 to detect
        sessionStorage.setItem('oauth_return', JSON.stringify({
          provider: state.selectedProvider,
          success: true
        }));

        // Clear onboarding state
        sessionStorage.removeItem('onboarding_state');

        // Success - redirect back to onboarding
        setStatus('success');
        setMessage('Calendar connected! Returning to onboarding...');

        setTimeout(() => {
          console.log(`🔄 Redirecting to onboarding step ${state.currentStep}...`);
          navigate('/onboarding', {
            replace: true,
            state: { restoredData: state }
          });
        }, 500);
        return;
      }

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