import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './Layout';
import Clients from './pages/Clients';
import Meetings from './pages/Meetings';
import Pipeline from './pages/Pipeline';
import ActionItems from './pages/ActionItems';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PricingPage from './pages/PricingPage';
import AuthCallback from './pages/AuthCallback';
import AuthConfirm from './pages/AuthConfirm';
import OnboardingFlow from './pages/Onboarding/OnboardingFlow';
import AskAdvicly from './pages/AskAdvicly';
import notificationService from './services/notificationService';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

function PrivateRoute() {
  const { isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const navigate = useNavigate();

  // Safety timeout: If still loading after 10 seconds, stop loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (checkingOnboarding) {
        console.warn('⚠️ Onboarding check timeout - stopping loading state');
        setCheckingOnboarding(false);
      }
    }, 10000); // 10 seconds

    return () => clearTimeout(timeout);
  }, [checkingOnboarding]);

  useEffect(() => {
    console.log('🔍 PrivateRoute useEffect:', { isAuthenticated, hasCheckedOnboarding, isLoading });

    // Only check onboarding status once when user first authenticates
    if (isAuthenticated && !hasCheckedOnboarding) {
      setHasCheckedOnboarding(true);

      console.log('✅ User authenticated, checking onboarding and subscription status...');

      // Initialize notification service
      notificationService.initialize();

      // Check onboarding and subscription status
      const checkOnboardingAndSubscription = async () => {
        try {
          const token = await getAccessToken();
          console.log('🔑 Got access token:', token ? 'Present' : 'Missing');

          // Check onboarding status
          const onboardingResponse = await axios.get(`${API_BASE_URL}/api/auth/onboarding/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          console.log('📋 Onboarding status response:', onboardingResponse.data);

          // Check subscription status
          try {
            const subscriptionResponse = await axios.get(`${API_BASE_URL}/api/billing/subscription`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log('💳 Subscription status:', subscriptionResponse.data);

            // Check if subscription is valid
            const validStatuses = ['active', 'trialing'];
            if (subscriptionResponse.data && !validStatuses.includes(subscriptionResponse.data.status)) {
              console.warn('⚠️ Invalid subscription status:', subscriptionResponse.data.status);
              // Don't redirect here - let the backend middleware handle it
              // This is just for better UX and logging
            }
          } catch (subError) {
            console.warn('⚠️ Could not fetch subscription status:', subError.message);
            // Don't fail the whole check if subscription fetch fails
          }

          setCheckingOnboarding(false);

          // Redirect to onboarding if not completed
          if (!onboardingResponse.data.onboarding_completed) {
            console.log('🔄 Redirecting to onboarding...');
            navigate('/onboarding');
          } else {
            console.log('✅ Onboarding completed, staying on current route');
          }
        } catch (error) {
          console.error('❌ Error checking onboarding status:', error);
          console.error('❌ Error details:', error.response?.data || error.message);

          // If we get a 401, the user is not properly authenticated
          if (error.response?.status === 401) {
            console.error('❌ 401 Unauthorized - token may be invalid');
          }

          // If we get a 403 with subscription error, redirect to pricing
          if (error.response?.status === 403 && error.response?.data?.error?.includes('subscription')) {
            console.log('🔄 Redirecting to pricing due to subscription issue...');
            navigate('/pricing');
          }

          setCheckingOnboarding(false);
        }
      };

      checkOnboardingAndSubscription();
    } else if (!isAuthenticated) {
      // Reset check flag when user logs out
      console.log('👋 User not authenticated, resetting onboarding check');
      setHasCheckedOnboarding(false);
      setCheckingOnboarding(true);
    } else if (!isLoading && isAuthenticated && hasCheckedOnboarding) {
      // User is authenticated and we've already checked - stop loading
      console.log('✅ Already checked onboarding, stopping loading state');
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, hasCheckedOnboarding, isLoading, getAccessToken, navigate]);

  console.log('PrivateRoute: isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  if (isLoading || checkingOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/meetings" /> : <Navigate to="/pricing" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public routes */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />

          {/* Protected routes */}
          <Route element={<PrivateRoute />}>
            {/* Onboarding route (outside Layout) */}
            <Route path="/onboarding" element={<OnboardingFlow />} />

            {/* Main app routes (inside Layout) */}
            <Route element={<Layout />}>
              <Route path="meetings" element={<Meetings />} />
              <Route path="clients" element={<Clients />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="action-items" element={<ActionItems />} />
              <Route path="templates" element={<Templates />} />
              <Route path="settings" element={<Settings />} />
              <Route path="ask-advicly" element={<AskAdvicly />} />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/pricing" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
