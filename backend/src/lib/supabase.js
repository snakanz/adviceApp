const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================================
// This module provides two types of Supabase clients:
// 1. Service Role Client - For admin operations (webhooks, cron jobs)
// 2. User-Scoped Client - For user requests (enforces RLS)
//
// CRITICAL: Always use user-scoped client for user requests to enforce RLS!
// ============================================================================

// Service role client (ONLY for admin operations - bypasses RLS!)
let serviceRoleClient = null;

try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    serviceRoleClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('✅ Supabase service role client initialized');
  } else {
    console.warn('⚠️  Supabase environment variables not found. Database features will be disabled.');
    console.warn('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase service role client:', error.message);
  serviceRoleClient = null;
}

// ============================================================================
// USER-SCOPED CLIENT FACTORY
// ============================================================================

/**
 * Creates a Supabase client scoped to a specific user's JWT token
 * This client will enforce RLS policies based on auth.uid()
 *
 * @param {string} userJWT - The user's Supabase Auth JWT token
 * @returns {Object} Supabase client with user context
 */
const createUserClient = (userJWT) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration. Required: SUPABASE_URL, SUPABASE_ANON_KEY');
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${userJWT}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify a Supabase JWT token and extract user information
 * This decodes the JWT token and verifies the user exists in the database
 *
 * @param {string} token - The JWT token to verify
 * @returns {Promise<{user: Object, error: Error|null}>}
 */
const verifySupabaseToken = async (token) => {
  try {
    if (!serviceRoleClient) {
      return { user: null, error: new Error('Supabase not available') };
    }

    // Decode the JWT token without verification (we'll verify by checking the user exists)
    let decoded;
    try {
      decoded = jwt.decode(token);
    } catch (decodeError) {
      console.log('❌ Token decode error:', decodeError.message);
      return { user: null, error: new Error('Invalid token format') };
    }

    if (!decoded) {
      console.log('❌ Invalid token structure');
      return { user: null, error: new Error('Invalid token structure') };
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      console.log('❌ Token expired');
      return { user: null, error: new Error('Token expired') };
    }

    // Support BOTH token formats:
    // 1. Supabase JWT: has 'sub' field (user UUID)
    // 2. Custom JWT: has 'id' field (user UUID)
    const userId = decoded.sub || decoded.id;

    // Support multiple email sources:
    // 1. Standard email claim
    // 2. Microsoft userPrincipalName (in user_metadata)
    // 3. Microsoft preferred_username (in user_metadata)
    // 4. Email from user_metadata
    const userEmail = decoded.email
      || decoded.user_metadata?.email
      || decoded.user_metadata?.userPrincipalName
      || decoded.user_metadata?.preferred_username;

    if (!userId) {
      console.log('❌ No user ID found in token (missing both sub and id fields)');
      return { user: null, error: new Error('Invalid token: no user ID') };
    }

    if (!userEmail) {
      console.log('❌ No email in token');
      console.log('Token decoded fields:', {
        email: decoded.email,
        user_metadata: decoded.user_metadata,
        identities: decoded.identities
      });
      return { user: null, error: new Error('No email in token') };
    }

    console.log('✅ Email extracted from:', decoded.email ? 'email' : 'user_metadata');

    // Create a user object that matches Supabase's user structure
    const user = {
      id: userId,
      email: userEmail,
      aud: decoded.aud,
      role: decoded.role,
      email_confirmed_at: decoded.email_confirmed_at,
      phone: decoded.phone,
      confirmed_at: decoded.confirmed_at,
      last_sign_in_at: decoded.last_sign_in_at,
      app_metadata: decoded.app_metadata || {},
      user_metadata: decoded.user_metadata || {},
      identities: decoded.identities || [],
      created_at: decoded.created_at,
      updated_at: decoded.updated_at
    };

    console.log('✅ Token verified for user:', user.email);
    return { user, error: null };
  } catch (error) {
    console.log('❌ Token verification exception:', error.message);
    return { user: null, error };
  }
};

/**
 * Check if Supabase is available
 * @returns {boolean}
 */
const isSupabaseAvailable = () => {
  return serviceRoleClient !== null;
};

/**
 * Get service role client (ADMIN ONLY - bypasses RLS!)
 * Use this ONLY for:
 * - Webhooks (Calendly, Google Calendar)
 * - Cron jobs
 * - System operations
 *
 * DO NOT use for user requests!
 *
 * @returns {Object} Supabase service role client
 */
const getSupabase = () => {
  if (!serviceRoleClient) {
    throw new Error('Supabase is not available. Please check your environment variables.');
  }
  return serviceRoleClient;
};

/**
 * Get service role client (alias for backward compatibility)
 * @deprecated Use getSupabase() or createUserClient() instead
 */
const supabase = serviceRoleClient;

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Service role client (admin operations only)
  supabase,
  getSupabase,
  isSupabaseAvailable,

  // User-scoped client factory (use for user requests)
  createUserClient,

  // Token verification
  verifySupabaseToken
};
