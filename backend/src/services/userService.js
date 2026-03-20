/**
 * UserService - Consolidated user creation and management
 *
 * This service handles all user creation logic in one place to ensure:
 * - Consistent UUID usage (always Supabase Auth UUID)
 * - Automatic tenant creation
 * - Proper error handling
 * - No duplicate user creation
 *
 * IMPORTANT: This service ALWAYS uses the service role client (bypasses RLS)
 * to ensure it can find existing users by email during OAuth flows.
 */

const { getSupabase } = require('../lib/supabase');
const logger = require('../utils/logger');

class UserService {
  /**
   * Get or create a user
   *
   * @param {Object} supabaseUser - User object from Supabase Auth
   * @param {string} supabaseUser.id - Supabase Auth UUID (or provider ID for new users)
   * @param {string} supabaseUser.email - User email
   * @param {string} supabaseUser.user_metadata - User metadata (name, etc)
   * @param {string} supabaseUser.app_metadata - App metadata (provider, etc)
   * @returns {Promise<Object>} User object with id, email, name, etc
   */
  static async getOrCreateUser(supabaseUser) {
    if (!supabaseUser || !supabaseUser.id || !supabaseUser.email) {
      throw new Error('Invalid Supabase user object');
    }

    logger.log(`🔍 UserService: Checking if user exists: ${supabaseUser.email}`);

    // CRITICAL: Use service role client to bypass RLS
    // This allows us to find existing users by email during OAuth flows
    const supabase = getSupabase();

    // Check if user already exists by email (using service role to bypass RLS)
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', supabaseUser.email)
      .single();

    // User exists - return them
    if (existingUser) {
      logger.log(`✅ UserService: Found existing user: ${existingUser.id}`);
      return existingUser;
    }

    // Check for other errors (not "no rows found")
    if (findError && findError.code !== 'PGRST116') {
      logger.error('❌ UserService: Database error checking user:', findError);
      throw new Error(`Database error: ${findError.message}`);
    }

    // User doesn't exist - create them
    logger.log(`📝 UserService: Creating new user: ${supabaseUser.email}`);

    // For new users from OAuth, we need to get their Supabase Auth UUID
    // Check if this is a Google/Microsoft provider ID (numeric string) vs Supabase UUID
    const isProviderID = /^\d+$/.test(supabaseUser.id);

    let actualUserId = supabaseUser.id;

    if (isProviderID) {
      // This is a provider ID (e.g., Google: "114999123539570830796")
      // We need to get the actual Supabase Auth UUID for this user
      logger.log(`🔍 UserService: Provider ID detected, fetching Supabase Auth UUID for: ${supabaseUser.email}`);

      // Query Supabase Auth to get the actual user UUID
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        logger.error('❌ UserService: Error fetching auth users:', authError);
        throw new Error(`Failed to fetch auth user: ${authError.message}`);
      }

      // Find the user by email in Supabase Auth
      const authUser = authUsers.users.find(u => u.email === supabaseUser.email);

      if (authUser) {
        actualUserId = authUser.id;
        logger.log(`✅ UserService: Found Supabase Auth UUID: ${actualUserId}`);
      } else {
        logger.error(`❌ UserService: No Supabase Auth user found for email: ${supabaseUser.email}`);
        throw new Error(`No Supabase Auth user found for email: ${supabaseUser.email}`);
      }
    }

    const newUserData = {
      id: actualUserId,  // ✅ Always use Supabase Auth UUID
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      provider: supabaseUser.app_metadata?.provider || 'email',  // ✅ Detect actual provider (google, email, microsoft, etc.)
      providerid: actualUserId,
      onboarding_completed: false,
      timezone: 'UTC'
    };

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert(newUserData)
      .select()
      .single();

    if (createError) {
      logger.error('❌ UserService: Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    logger.log(`✅ UserService: New user created: ${newUser.id}`);

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
      logger.log(`✅ UserService: User already has tenant: ${user.tenant_id}`);
      return user.tenant_id;
    }

    logger.log(`📝 UserService: Creating default tenant for user: ${user.id}`);

    // CRITICAL: Use service role client to bypass RLS
    const supabase = getSupabase();

    // Create default tenant
    const { data: newTenant, error: tenantError } = await supabase
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
      logger.error('❌ UserService: Error creating tenant:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    logger.log(`✅ UserService: Tenant created: ${newTenant.id}`);

    // Update user with tenant_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ tenant_id: newTenant.id })
      .eq('id', user.id);

    if (updateError) {
      logger.warn('⚠️ UserService: Warning updating user tenant_id:', updateError);
      // Don't throw - tenant was created successfully
    }

    return newTenant.id;
  }
}

module.exports = UserService;

