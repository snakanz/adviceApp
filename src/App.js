import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './Layout';
import Clients from './pages/Clients';
import Meetings from './pages/Meetings';
import Pipeline from './pages/Pipeline';
import ActionItems from './pages/ActionItems';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import AskAdvicly from './pages/AskAdvicly';
import notificationService from './services/notificationService';

function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Initialize notification service when user is authenticated
    if (isAuthenticated) {
      notificationService.initialize();
    }
  }, [isAuthenticated]);

  console.log('PrivateRoute: isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<PrivateRoute />}>
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
          <Route path="*" element={<Navigate to="/meetings" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
