import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import {
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

const AuthConfirm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const next = searchParams.get('next') || '/auth/callback';

        console.log('📧 AuthConfirm: Starting email confirmation...');
        console.log('📧 token_hash:', token_hash ? 'present' : 'missing');
        console.log('📧 type:', type);
        console.log('📧 next:', next);

        if (!token_hash || !type) {
          console.error('❌ Missing confirmation parameters');
          throw new Error('Missing confirmation parameters. Please use the link from your email.');
        }

        console.log('📧 Calling verifyOtp to exchange token for session...');

        // Exchange token_hash for session using PKCE flow
        const { data, error } = await supabase.auth.verifyOtp({
          type,
          token_hash,
        });

        if (error) {
          console.error('❌ Email confirmation error:', error);
          throw error;
        }

        console.log('✅ Email confirmed successfully!');
        console.log('✅ Session created:', data.session ? 'Yes' : 'No');
        console.log('✅ User:', data.user?.email);

        setStatus('success');
        setMessage('Email confirmed! Redirecting...');

        // Redirect to callback to complete auth flow
        // The callback will detect the session and complete onboarding
        setTimeout(() => {
          console.log('🔄 Redirecting to:', next);
          navigate(next, { replace: true });
        }, 1000);

      } catch (err) {
        console.error('❌ Confirmation error:', err);
        setStatus('error');
        setMessage(err.message || 'Email confirmation failed. Please try again or contact support.');
        
        // Redirect to login after 5 seconds
        setTimeout(() => {
          console.log('🔄 Redirecting to login...');
          navigate('/login', { replace: true });
        }, 5000);
      }
    };

    confirmEmail();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {status === 'processing' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <h2 className="text-xl font-semibold">Confirming Email</h2>
                <p className="text-muted-foreground">{message}</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-green-600">Success!</h2>
                <p className="text-muted-foreground">{message}</p>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h2 className="text-xl font-semibold text-red-600">Error</h2>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-sm text-gray-500">Redirecting to login page...</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirm;

