import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import {
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  Lock,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Mail
} from 'lucide-react';
import { getMobileWaitTime, logMobileDebugInfo, isMobile } from '../utils/mobileAuthFix';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your credentials...');
  const [enterpriseError, setEnterpriseError] = useState(null);
  const [copied, setCopied] = useState(null); // 'url' or 'email'

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

        // **NEW**: Check for explicit error parameter from backend
        const errorParam = params.get('error');
        const successParam = params.get('success');
        const providerParam = params.get('provider');
        const isOnboarding = params.get('onboarding') === 'true';
        const errorType = params.get('error_type');
        const adminConsentUrl = params.get('admin_consent_url');
        const userAction = params.get('user_action');

        if (errorParam) {
          // Backend returned explicit error (e.g., from calendar OAuth)
          console.error('❌ AuthCallback: Backend returned error:', errorParam);
          console.log('📋 Error type:', errorType);
          console.log('📋 Admin consent URL:', adminConsentUrl);

          // Check if this is an enterprise admin consent error
          if (errorType === 'admin_consent_required' && adminConsentUrl) {
            console.log('🔒 Enterprise admin consent required - showing specialized UI');

            // Generate email template
            const emailTemplate = `Hi IT Team,

I'm trying to use Advicly to manage my client meetings. It needs access to my Microsoft calendar, but requires administrator approval for our organization.

Could you please approve the app using this link?
${decodeURIComponent(adminConsentUrl)}

The app only needs to read calendar events - it won't modify or delete anything.

Permissions requested:
- Read calendar events (Calendars.Read)
- Read user profile (User.Read)
- Offline access for background sync

Thank you!`;

            setEnterpriseError({
              type: errorType,
              message: decodeURIComponent(errorParam),
              adminConsentUrl: decodeURIComponent(adminConsentUrl),
              userAction: userAction ? decodeURIComponent(userAction) : 'Please share the admin approval link with your IT team.',
              emailTemplate,
              provider: providerParam,
              isOnboarding
            });
            setStatus('enterprise_error');
            return;
          }

          if (isOnboarding) {
            // Restore onboarding state and show error
            const onboardingState = sessionStorage.getItem('onboarding_state');
            if (onboardingState) {
              const state = JSON.parse(onboardingState);

              // Mark OAuth as failed
              sessionStorage.setItem('oauth_return', JSON.stringify({
                provider: providerParam || state.selectedProvider,
                success: false,
                error: decodeURIComponent(errorParam)
              }));

              // Clear onboarding state
              sessionStorage.removeItem('onboarding_state');

              // Redirect back to onboarding with error
              setStatus('error');
              setMessage(`Calendar connection failed: ${decodeURIComponent(errorParam)}`);

              setTimeout(() => {
                navigate('/onboarding', {
                  replace: true,
                  state: { restoredData: state }
                });
              }, 2000);
              return;
            }
          }

          // Not onboarding - regular error
          setStatus('error');
          setMessage(decodeURIComponent(errorParam));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (successParam === 'true' && providerParam) {
          // **NEW**: Backend explicitly confirmed success (calendar OAuth)
          console.log('✅ AuthCallback: Backend confirmed calendar connection success:', providerParam);
          console.log('🔍 Onboarding flag from URL:', isOnboarding);

          // **FIX**: Check onboarding flag from URL query parameter (not sessionStorage)
          // This is more reliable as sessionStorage can be cleared during OAuth redirects
          if (isOnboarding) {
            console.log('✅ Onboarding calendar connection detected from URL parameter');

            // Mark OAuth as successful for Step3 to detect
            sessionStorage.setItem('oauth_return', JSON.stringify({
              provider: providerParam,
              success: true
            }));

            // Try to restore onboarding state from sessionStorage (if it survived)
            const onboardingState = sessionStorage.getItem('onboarding_state');
            let restoredData = null;

            if (onboardingState) {
              try {
                restoredData = JSON.parse(onboardingState);
                console.log('✅ Restored onboarding state from sessionStorage');
                sessionStorage.removeItem('onboarding_state');
              } catch (e) {
                console.warn('⚠️  Could not parse onboarding state:', e);
              }
            } else {
              console.log('⚠️  SessionStorage was cleared, user will need to complete remaining steps');
            }

            // Redirect back to onboarding
            setStatus('success');
            setMessage('Calendar connected successfully!');

            setTimeout(() => {
              navigate('/onboarding', {
                replace: true,
                state: restoredData ? { restoredData } : undefined
              });
            }, 1000);
            return;
          }

          // Not onboarding - this is a post-login calendar connection from Settings
          // Check if user is logged in and redirect to dashboard
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('✅ User already logged in, redirecting to dashboard');
            setStatus('success');
            setMessage('Calendar connected successfully!');
            setTimeout(() => navigate('/dashboard'), 1500);
            return;
          }

          // No session - they need to log in
          console.log('⚠️  No session found - redirecting to login');
          setStatus('error');
          setMessage('Please log in to continue');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

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

  // Handle copy to clipboard
  const handleCopy = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle try again for Microsoft
  const handleTryAgain = async () => {
    setStatus('processing');
    setMessage('Connecting to Microsoft Calendar...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';
      const response = await fetch(`${apiBaseUrl}/api/auth/microsoft?onboarding=${enterpriseError?.isOnboarding || false}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        setStatus('error');
        setMessage('Failed to start Microsoft connection');
      }
    } catch (err) {
      console.error('Error retrying Microsoft connection:', err);
      setStatus('error');
      setMessage('Failed to connect to Microsoft');
    }
  };

  // Render enterprise error UI
  if (status === 'enterprise_error' && enterpriseError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-border/50 shadow-large">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex items-center justify-center mb-6">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-foreground text-center mb-2">
              IT Approval Required
            </h2>

            <p className="text-sm text-muted-foreground text-center mb-6">
              {enterpriseError.message}
            </p>

            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">What to do:</h3>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">1</span>
                  <span>Copy the admin approval link below</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">2</span>
                  <span>Send it to your IT administrator using the email template</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">3</span>
                  <span>Once approved, come back and click "Try Again"</span>
                </li>
              </ol>
            </div>

            {/* Admin Consent URL */}
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Admin Approval Link:
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono overflow-hidden">
                  <span className="truncate block">{enterpriseError.adminConsentUrl}</span>
                </div>
                <button
                  onClick={() => handleCopy(enterpriseError.adminConsentUrl, 'url')}
                  className="flex-shrink-0 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  {copied === 'url' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Email Template */}
            <div className="mb-6">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Email Template for IT:
              </label>
              <div className="relative">
                <pre className="bg-muted rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {enterpriseError.emailTemplate}
                </pre>
                <button
                  onClick={() => handleCopy(enterpriseError.emailTemplate, 'email')}
                  className="absolute top-2 right-2 px-2 py-1 bg-background/80 border border-border rounded text-xs font-medium hover:bg-background transition-colors flex items-center gap-1"
                >
                  {copied === 'email' ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Mail className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleTryAgain}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.open(enterpriseError.adminConsentUrl, '_blank')}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </button>
            </div>

            {/* Skip for now */}
            <button
              onClick={() => {
                if (enterpriseError.isOnboarding) {
                  navigate('/onboarding');
                } else {
                  navigate('/settings');
                }
              }}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now - I'll connect later
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

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