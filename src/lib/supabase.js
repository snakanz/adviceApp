import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for frontend operations
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // PKCE flow is required for Google OAuth
      storage: window.localStorage,
      storageKey: 'supabase.auth.token',
      debug: true // Enable debug logging
    }
  }
);

export { supabase };
