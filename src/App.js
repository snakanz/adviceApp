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
import AuthCallback from './pages/AuthCallback';
import OnboardingFlow from './pages/Onboarding/OnboardingFlow';
import AskAdvicly from './pages/AskAdvicly';
import notificationService from './services/notificationService';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

function PrivateRoute() {
  const { isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize notification service when user is authenticated
    if (isAuthenticated) {
      notificationService.initialize();
      checkOnboardingStatus();
    }
  }, [isAuthenticated]);

  const checkOnboardingStatus = async () => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE_URL}/api/auth/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setOnboardingStatus(response.data);
      setCheckingOnboarding(false);

      // Redirect to onboarding if not completed
      if (!response.data.onboarding_completed) {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setCheckingOnboarding(false);
    }
  };

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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route element={<PrivateRoute />}>
            {/* Onboarding route (outside Layout) */}
            <Route path="/onboarding" element={<OnboardingFlow />} />

            {/* Main app routes (inside Layout) */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/meetings" replace />} />
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
          <Route path="*" element={<Navigate to="/meetings" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
