const { createClient } = require('@supabase/supabase-js');

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
  createUserClient
};
