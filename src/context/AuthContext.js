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
        console.log('📋 Stack trace:', new Error().stack);

        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ User signed in:', session?.user?.email);
            break;
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            console.log('⚠️ Sign out reason: Check if this is intentional');
            console.log('⚠️ Stack trace for SIGNED_OUT:', new Error().stack);
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed');
            break;
          case 'USER_UPDATED':
            console.log('📝 User updated');
            break;
          case 'INITIAL_SESSION':
            console.log('🎯 Initial session loaded:', session?.user?.email);
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