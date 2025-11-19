/**
 * UserService - Consolidated user creation and management
 * 
 * This service handles all user creation logic in one place to ensure:
 * - Consistent UUID usage (always Supabase Auth UUID)
 * - Automatic tenant creation
 * - Proper error handling
 * - No duplicate user creation
 */

const { getSupabase } = require('../lib/supabase');

class UserService {
  /**
   * Get or create a user
   * 
   * @param {Object} supabaseUser - User object from Supabase Auth
   * @param {string} supabaseUser.id - Supabase Auth UUID
   * @param {string} supabaseUser.email - User email
   * @param {string} supabaseUser.user_metadata - User metadata (name, etc)
   * @returns {Promise<Object>} User object with id, email, name, etc
   */
  static async getOrCreateUser(supabaseUser) {
    if (!supabaseUser || !supabaseUser.id || !supabaseUser.email) {
      throw new Error('Invalid Supabase user object');
    }

    console.log(`🔍 UserService: Checking if user exists: ${supabaseUser.email}`);

    // Check if user already exists by email
    const { data: existingUser, error: findError } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', supabaseUser.email)
      .single();

    // User exists - return them
    if (existingUser) {
      console.log(`✅ UserService: Found existing user: ${existingUser.id}`);
      return existingUser;
    }

    // Check for other errors (not "no rows found")
    if (findError && findError.code !== 'PGRST116') {
      console.error('❌ UserService: Database error checking user:', findError);
      throw new Error(`Database error: ${findError.message}`);
    }

    // User doesn't exist - create them
    console.log(`📝 UserService: Creating new user: ${supabaseUser.email}`);

    const newUserData = {
      id: supabaseUser.id,  // ✅ Always use Supabase Auth UUID
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      provider: supabaseUser.app_metadata?.provider || 'email',  // ✅ Detect actual provider (google, email, microsoft, etc.)
      providerid: supabaseUser.id,
      onboarding_completed: false,
      timezone: 'UTC'
    };

    const { data: newUser, error: createError } = await getSupabase()
      .from('users')
      .insert(newUserData)
      .select()
      .single();

    if (createError) {
      console.error('❌ UserService: Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log(`✅ UserService: New user created: ${newUser.id}`);

    // Ensure user has a tenant
    await this.ensureUserHasTenant(newUser);

    return newUser;
  }

  /**
   * Ensure user has a tenant (create default if needed)
   * 
   * @param {Object} user - User object
   * @returns {Promise<string>} Tenant ID
   */
  static async ensureUserHasTenant(user) {
    if (!user || !user.id) {
      throw new Error('Invalid user object');
    }

    // User already has a tenant
    if (user.tenant_id) {
      console.log(`✅ UserService: User already has tenant: ${user.tenant_id}`);
      return user.tenant_id;
    }

    console.log(`📝 UserService: Creating default tenant for user: ${user.id}`);

    // Create default tenant
    const { data: newTenant, error: tenantError } = await getSupabase()
      .from('tenants')
      .insert({
        name: `${user.name || user.email}'s Business`,
        owner_id: user.id,
        timezone: user.timezone || 'UTC',
        currency: 'USD'
      })
      .select()
      .single();

    if (tenantError) {
      console.error('❌ UserService: Error creating tenant:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    console.log(`✅ UserService: Tenant created: ${newTenant.id}`);

    // Update user with tenant_id
    const { error: updateError } = await getSupabase()
      .from('users')
      .update({ tenant_id: newTenant.id })
      .eq('id', user.id);

    if (updateError) {
      console.warn('⚠️ UserService: Warning updating user tenant_id:', updateError);
      // Don't throw - tenant was created successfully
    }

    return newTenant.id;
  }
}

module.exports = UserService;

