import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================================
// AUTH CONTEXT - SUPABASE AUTH VERSION
// ============================================================================
// This context manages authentication state using Supabase Auth
// Replaces the previous custom JWT implementation
// ============================================================================

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state and listen for changes
  useEffect(() => {
    console.log('🔄 Initializing Supabase Auth...');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 URL Hash:', window.location.hash);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Error getting session:', error);
      }

      console.log('📋 Initial session:', session ? 'Found' : 'None');
      if (session) {
        console.log('✅ Session user:', session.user.email);
        console.log('✅ Session expires at:', new Date(session.expires_at * 1000).toLocaleString());
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state changed:', event);
        console.log('📋 Session:', session ? 'Present' : 'None');
        console.log('📋 User:', session?.user?.email || 'None');

        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ User signed in:', session?.user?.email);
            // Verify webhooks are active on login
            verifyWebhooksOnLogin(session);
            break;
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed successfully');
            break;
          case 'USER_UPDATED':
            console.log('📝 User updated');
            break;
          case 'INITIAL_SESSION':
            console.log('🎯 Initial session loaded:', session?.user?.email);
            // Verify webhooks on initial session load
            if (session) {
              verifyWebhooksOnLogin(session);
            }
            break;
          default:
            console.log('ℹ️ Auth event:', event);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Set up automatic token refresh check
  useEffect(() => {
    if (!session) return;

    // Check token expiration every minute
    const checkTokenExpiration = setInterval(async () => {
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;

      // If token expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 300) {
        console.log('🔄 Token expiring soon, refreshing...');
        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('❌ Error refreshing session:', error);
          } else {
            console.log('✅ Session refreshed successfully');
          }
        } catch (error) {
          console.error('❌ Exception refreshing session:', error);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkTokenExpiration);
  }, [session]);

  /**
   * Verify calendar webhooks are active on user login
   * Called when user signs in or session is restored
   */
  const verifyWebhooksOnLogin = async (session) => {
    try {
      if (!session?.access_token) {
        console.log('⚠️ No session token available for webhook verification');
        return;
      }

      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

      console.log('🔍 Verifying calendar webhooks on login...');
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Webhook verification completed:', data.webhooks);

        // Log webhook status for debugging
        if (data.webhooks.google?.status === 'active') {
          console.log('✅ Google Calendar webhook is active');
        }
        if (data.webhooks.calendly?.webhook_active) {
          console.log('✅ Calendly webhook is active');
        } else if (data.webhooks.calendly?.status === 'not_connected') {
          console.log('ℹ️ Calendly not connected');
        } else {
          console.log('⚠️ Calendly using polling sync (webhook not active)');
        }
      } else {
        console.warn('⚠️ Failed to verify webhooks:', response.statusText);
      }
    } catch (error) {
      console.warn('⚠️ Error verifying webhooks on login:', error.message);
      // Don't fail auth if webhook verification fails
    }
  };

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      console.log('✅ Signed in with email:', email);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Email sign in error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      console.log('✅ Signed up with email:', email);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Email sign up error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign in with OAuth provider (Google, Microsoft)
   */
  const signInWithOAuth = async (provider, options = {}) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          ...options
        }
      });

      if (error) throw error;

      console.log('✅ OAuth sign in initiated:', provider);
      return { success: true, data };
    } catch (error) {
      console.error('❌ OAuth sign in error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      console.log('✅ Signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get current session
   */
  const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }

    return session;
  };

  /**
   * Get access token for API calls
   */
  const getAccessToken = async () => {
    const session = await getSession();
    return session?.access_token ?? null;
  };

  /**
   * Legacy login function for backward compatibility
   * @deprecated Use signInWithEmail or signInWithOAuth instead
   */
  const login = async (token) => {
    console.warn('⚠️ login() is deprecated. Use signInWithEmail() or signInWithOAuth() instead');
    // This is for backward compatibility during migration
    // In the new system, authentication is handled by Supabase
    return false;
  };

  /**
   * Legacy logout function for backward compatibility
   * @deprecated Use signOut instead
   */
  const logout = async () => {
    console.warn('⚠️ logout() is deprecated. Use signOut() instead');
    return await signOut();
  };

  const value = {
    // Auth state
    session,
    user,
    isLoading,
    isAuthenticated,

    // Auth methods
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
    getSession,
    getAccessToken,

    // Legacy methods (deprecated)
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};