const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { getSupabase } = require('../lib/supabase');

// ============================================================================
// TENANT MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/tenants/my-tenant
 * Get the current user's tenant information
 */
router.get('/my-tenant', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's tenant
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    if (!user.tenant_id) {
      return res.json({ tenant: null, message: 'User has no tenant' });
    }

    // Get tenant details
    const { data: tenant, error: tenantError } = await req.supabase
      .from('tenants')
      .select('*')
      .eq('id', user.tenant_id)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return res.status(500).json({ error: 'Failed to fetch tenant data' });
    }

    // Get tenant members
    const { data: members, error: membersError } = await req.supabase
      .from('tenant_members')
      .select(`
        id,
        role,
        created_at,
        user:users(id, email, name, profilepicture)
      `)
      .eq('tenant_id', user.tenant_id);

    if (membersError) {
      console.error('Error fetching members:', membersError);
    }

    res.json({
      tenant: {
        ...tenant,
        members: members || []
      }
    });
  } catch (error) {
    console.error('Error in GET /my-tenant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tenants
 * Create a new tenant for the current user
 */
router.post('/', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, business_type, team_size, timezone, currency } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Check if user already has a tenant
    const { data: existingUser, error: userCheckError } = await req.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userCheckError) {
      console.error('Error checking user:', userCheckError);
      return res.status(500).json({ error: 'Failed to check user data' });
    }

    if (existingUser.tenant_id) {
      return res.status(400).json({ 
        error: 'User already has a tenant',
        tenant_id: existingUser.tenant_id
      });
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await req.supabase
      .from('tenants')
      .insert({
        name,
        business_type,
        team_size,
        timezone: timezone || 'UTC',
        currency: currency || 'USD',
        owner_id: userId
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      return res.status(500).json({ error: 'Failed to create tenant' });
    }

    // Add user as tenant owner in tenant_members
    const { error: memberError } = await req.supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenant.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) {
      console.error('Error adding tenant member:', memberError);
      // Don't fail the request, but log the error
    }

    // Update user with tenant_id
    const { error: updateError } = await req.supabase
      .from('users')
      .update({ tenant_id: tenant.id })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user tenant_id:', updateError);
      // Don't fail the request, but log the error
    }

    console.log(`✅ Created tenant ${tenant.id} for user ${userId}`);

    res.status(201).json({ tenant });
  } catch (error) {
    console.error('Error in POST /tenants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tenants/:id
 * Update tenant information (owner only)
 */
router.put('/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.params.id;
    const { name, business_type, team_size, timezone, currency } = req.body;

    // Check if user is the tenant owner
    const { data: tenant, error: tenantError } = await req.supabase
      .from('tenants')
      .select('owner_id')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.owner_id !== userId) {
      return res.status(403).json({ error: 'Only tenant owner can update tenant' });
    }

    // Update tenant
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (business_type !== undefined) updateData.business_type = business_type;
    if (team_size !== undefined) updateData.team_size = team_size;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (currency !== undefined) updateData.currency = currency;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedTenant, error: updateError } = await req.supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating tenant:', updateError);
      return res.status(500).json({ error: 'Failed to update tenant' });
    }

    res.json({ tenant: updatedTenant });
  } catch (error) {
    console.error('Error in PUT /tenants/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tenants/:id/members
 * Get all members of a tenant
 */
router.get('/:id/members', authenticateSupabaseUser, async (req, res) => {
  try {
    const tenantId = req.params.id;

    // Get tenant members with user details
    const { data: members, error } = await req.supabase
      .from('tenant_members')
      .select(`
        id,
        role,
        created_at,
        user:users(id, email, name, profilepicture)
      `)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching members:', error);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    res.json({ members: members || [] });
  } catch (error) {
    console.error('Error in GET /tenants/:id/members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tenants/:id/members
 * Add a member to a tenant (owner/admin only)
 */
router.post('/:id/members', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.params.id;
    const { user_email, role } = req.body;

    if (!user_email || !role) {
      return res.status(400).json({ error: 'user_email and role are required' });
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if current user is owner or admin
    const { data: currentMember, error: memberCheckError } = await req.supabase
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (memberCheckError || !currentMember) {
      return res.status(403).json({ error: 'You are not a member of this tenant' });
    }

    if (!['owner', 'admin'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Only owners and admins can add members' });
    }

    // Find user by email
    const { data: newUser, error: userError } = await getSupabase()
      .from('users')
      .select('id')
      .eq('email', user_email)
      .single();

    if (userError || !newUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add member
    const { data: member, error: addError } = await req.supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: newUser.id,
        role
      })
      .select()
      .single();

    if (addError) {
      if (addError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'User is already a member of this tenant' });
      }
      console.error('Error adding member:', addError);
      return res.status(500).json({ error: 'Failed to add member' });
    }

    res.status(201).json({ member });
  } catch (error) {
    console.error('Error in POST /tenants/:id/members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

