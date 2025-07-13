import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { 
  Loader2, 
  CheckCircle, 
  XCircle,
  Shield
} from 'lucide-react';

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
          alert('Authentication error: ' + error);
          navigate('/login');
          return;
        }

        if (!token) {
          console.error('No token received');
          alert('No token received');
          navigate('/login');
          return;
        }

        console.log('Received token:', token);
        // Set the token in the API service
        api.setToken(token);
        console.log('Token set in ApiService.');
        
        // Login the user with the token (now async)
        const loginSuccess = await login(token);
        console.log('Login result:', loginSuccess);
        
        if (loginSuccess) {
          console.log('User logged in successfully, redirecting to /meetings');
          navigate('/meetings');
        } else {
          console.error('Login failed');
          alert('Login failed - unable to verify token');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error processing authentication:', error);
        alert('Error processing authentication: ' + error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, login, location]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-large">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Completing Sign In
          </h2>
          
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your credentials and set up your session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback; 