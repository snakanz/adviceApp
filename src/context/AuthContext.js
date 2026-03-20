import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

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
    logger.log('🔄 Initializing Supabase Auth...');
    logger.log('🔍 Current URL:', window.location.href);
    logger.log('🔍 URL Hash:', window.location.hash);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('❌ Error getting session:', error);
      }

      logger.log('📋 Initial session:', session ? 'Found' : 'None');
      if (session) {
        logger.log('✅ Session user:', session.user.email);
        logger.log('✅ Session expires at:', new Date(session.expires_at * 1000).toLocaleString());
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('🔔 Auth state changed:', event);
        logger.log('📋 Session:', session ? 'Present' : 'None');
        logger.log('📋 User:', session?.user?.email || 'None');

        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            logger.log('✅ User signed in:', session?.user?.email);
            // Ensure user exists in public.users (fallback for email/password signups)
            await ensureUserExists(session);
            // Verify webhooks are active on login
            verifyWebhooksOnLogin(session);
            break;
          case 'SIGNED_OUT':
            logger.log('👋 User signed out');
            break;
          case 'TOKEN_REFRESHED':
            logger.log('🔄 Token refreshed successfully');
            break;
          case 'USER_UPDATED':
            logger.log('📝 User updated');
            break;
          case 'INITIAL_SESSION':
            logger.log('🎯 Initial session loaded:', session?.user?.email);
            // Verify webhooks and ensure user exists on initial session load
            if (session) {
              await ensureUserExists(session);
              verifyWebhooksOnLogin(session);
            }
            break;
          default:
            logger.log('ℹ️ Auth event:', event);
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
        logger.log('🔄 Token expiring soon, refreshing...');
        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            logger.error('❌ Error refreshing session:', error);
          } else {
            logger.log('✅ Session refreshed successfully');
          }
        } catch (error) {
          logger.error('❌ Exception refreshing session:', error);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkTokenExpiration);
  }, [session]);

  /**
   * Ensure user exists in public.users table
   * This is a fallback mechanism for email/password signups that bypass backend callbacks
   * The database trigger should handle this automatically, but this ensures it works
   * even if the trigger hasn't been deployed yet
   */
  const ensureUserExists = async (session) => {
    try {
      if (!session?.user?.id || !session?.access_token) {
        logger.log('⚠️ No session available for user check');
        return;
      }

      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

      logger.log('🔍 Ensuring user exists in database...');

      // Call the /api/users/profile endpoint which will create the user if they don't exist
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.log('✅ User exists in database:', data.email);
      } else if (response.status === 404) {
        // User doesn't exist - this shouldn't happen if trigger is in place
        // But we can handle it by calling POST to create
        logger.log('⚠️ User not found, attempting to create...');

        const createResponse = await fetch(`${API_BASE_URL}/api/users/profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: session.user.email,
            name: session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.name ||
                  session.user.email?.split('@')[0]
          })
        });

        if (createResponse.ok) {
          logger.log('✅ User created successfully');
        } else {
          logger.warn('⚠️ Failed to create user:', createResponse.statusText);
        }
      } else {
        logger.warn('⚠️ Unexpected response checking user:', response.status);
      }
    } catch (error) {
      logger.warn('⚠️ Error ensuring user exists:', error.message);
      // Don't fail auth if this fails - user might still be able to proceed
    }
  };

  /**
   * Verify calendar webhooks are active on user login
   * Called when user signs in or session is restored
   */
  const verifyWebhooksOnLogin = async (session) => {
    try {
      if (!session?.access_token) {
        logger.log('⚠️ No session token available for webhook verification');
        return;
      }

      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

      logger.log('🔍 Verifying calendar webhooks on login...');
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.log('✅ Webhook verification completed:', data.webhooks);

        // Log webhook status for debugging
        if (data.webhooks.google?.status === 'active') {
          logger.log('✅ Google Calendar webhook is active');
        }
        if (data.webhooks.calendly?.webhook_active) {
          logger.log('✅ Calendly webhook is active');
        } else if (data.webhooks.calendly?.status === 'not_connected') {
          logger.log('ℹ️ Calendly not connected');
        } else {
          logger.log('⚠️ Calendly using polling sync (webhook not active)');
        }
      } else {
        logger.warn('⚠️ Failed to verify webhooks:', response.statusText);
      }
    } catch (error) {
      logger.warn('⚠️ Error verifying webhooks on login:', error.message);
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

      logger.log('✅ Signed in with email:', email);
      return { success: true, data };
    } catch (error) {
      logger.error('❌ Email sign in error:', error);
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

      logger.log('✅ Signed up with email:', email);
      return { success: true, data };
    } catch (error) {
      logger.error('❌ Email sign up error:', error);
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

      logger.log('✅ OAuth sign in initiated:', provider);
      return { success: true, data };
    } catch (error) {
      logger.error('❌ OAuth sign in error:', error);
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

      logger.log('✅ Signed out successfully');
      return { success: true };
    } catch (error) {
      logger.error('❌ Sign out error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get current session
   */
  const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      logger.error('❌ Error getting session:', error);
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
    logger.warn('⚠️ login() is deprecated. Use signInWithEmail() or signInWithOAuth() instead');
    // This is for backward compatibility during migration
    // In the new system, authentication is handled by Supabase
    return false;
  };

  /**
   * Legacy logout function for backward compatibility
   * @deprecated Use signOut instead
   */
  const logout = async () => {
    logger.warn('⚠️ logout() is deprecated. Use signOut() instead');
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