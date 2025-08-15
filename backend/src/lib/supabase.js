const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for backend operations
// Handle missing environment variables gracefully
let supabase = null;

try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('✅ Supabase client initialized successfully');
  } else {
    console.warn('⚠️  Supabase environment variables not found. Database features will be disabled.');
    console.warn('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
  supabase = null;
}

// Helper function to check if Supabase is available
const isSupabaseAvailable = () => {
  return supabase !== null;
};

// Helper function to get Supabase client with error handling
const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not available. Please check your environment variables.');
  }
  return supabase;
};

module.exports = {
  supabase,
  isSupabaseAvailable,
  getSupabase
};
