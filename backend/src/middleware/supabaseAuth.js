// ============================================================================
// SUPABASE AUTH MIDDLEWARE
// ============================================================================
// This middleware replaces the custom JWT authentication with Supabase Auth
// It verifies Supabase Auth tokens and attaches user context to requests
// ============================================================================

const { createUserClient } = require('../lib/supabase');

/**
 * Middleware to authenticate requests using Supabase Auth
 * Verifies the JWT token and attaches user info to req.user
 * Creates a user-scoped Supabase client that enforces RLS
 */
const authenticateSupabaseUser = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No authorization header',
        message: 'Please provide an Authorization header with your access token'
      });
    }

    // Extract Bearer token
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        message: 'Authorization header must contain a Bearer token'
      });
    }

    // Create user-scoped Supabase client with the token
    const userSupabase = createUserClient(token);

    // Verify token and get user info
    const { data: { user }, error } = await userSupabase.auth.getUser();

    if (error || !user) {
      console.error('Token verification failed:', error?.message);
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id, // UUID from Supabase Auth
      email: user.email,
      name: user.user_metadata?.name || user.email,
      provider: user.app_metadata?.provider,
      metadata: user.user_metadata
    };

    // Attach user-scoped Supabase client to request
    // This client will automatically enforce RLS based on auth.uid()
    req.supabase = userSupabase;

    // Log successful authentication (for debugging)
    console.log(`✅ Authenticated user: ${user.email} (${user.id})`);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred while verifying your token'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 * Useful for endpoints that work for both authenticated and anonymous users
 */
const optionalSupabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No token provided, continue without user context
      req.user = null;
      req.supabase = null;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      req.user = null;
      req.supabase = null;
      return next();
    }

    // Create user-scoped Supabase client
    const userSupabase = createUserClient(token);

    // Try to get user info
    const { data: { user }, error } = await userSupabase.auth.getUser();

    if (error || !user) {
      // Invalid token, but don't fail the request
      req.user = null;
      req.supabase = null;
      return next();
    }

    // Attach user info
    req.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      provider: user.app_metadata?.provider,
      metadata: user.user_metadata
    };

    req.supabase = userSupabase;

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Don't fail the request, just continue without user context
    req.user = null;
    req.supabase = null;
    next();
  }
};

/**
 * Middleware to check if user has completed onboarding
 * Redirects to onboarding if not completed
 */
const requireOnboarding = async (req, res, next) => {
  try {
    if (!req.user || !req.supabase) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'Please log in first'
      });
    }

    // Check onboarding status
    const { data: userData, error } = await req.supabase
      .from('users')
      .select('onboarding_completed, onboarding_step')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Error checking onboarding status:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to check onboarding status'
      });
    }

    if (!userData.onboarding_completed) {
      return res.status(403).json({ 
        error: 'Onboarding not completed',
        message: 'Please complete onboarding first',
        onboarding_step: userData.onboarding_step || 0,
        redirect: '/onboarding'
      });
    }

    next();
  } catch (error) {
    console.error('Onboarding check error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to verify onboarding status'
    });
  }
};

/**
 * Middleware to extract user ID from Supabase Auth token
 * Lightweight version that only extracts user ID without full verification
 * Use this for performance-critical endpoints where you trust the token
 */
const extractUserId = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Decode JWT without verification (faster, but less secure)
    // Only use this if you're also using RLS policies for security
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    req.user = {
      id: payload.sub, // User UUID
      email: payload.email
    };

    // Create user-scoped client
    req.supabase = createUserClient(token);

    next();
  } catch (error) {
    console.error('Token extraction error:', error);
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Failed to extract user information from token'
    });
  }
};

module.exports = {
  authenticateSupabaseUser,
  optionalSupabaseAuth,
  requireOnboarding,
  extractUserId
};

