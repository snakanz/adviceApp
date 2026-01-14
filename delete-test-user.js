// ============================================================================
// DELETE TEST USER - Browser Console Helper
// ============================================================================
// Copy and paste this entire script into your browser console
// Then call: deleteTestUser('test@example.com')
// ============================================================================

/**
 * Deletes a test user and all their data via the API
 * Run this in browser console while logged in as admin or the user themselves
 *
 * @param {string} email - Email of the user to delete
 * @returns {Promise<void>}
 */
async function deleteTestUser(email) {
  console.log(`🗑️  Starting deletion of user: ${email}`);

  const API_BASE_URL = 'https://adviceapp-9rgw.onrender.com';

  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('❌ No active session. Please log in first.');
      return;
    }

    const token = session.access_token;
    console.log('✅ Session token obtained');

    // Call backend to delete user
    const response = await fetch(`${API_BASE_URL}/api/users/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ User deleted successfully:', result);
      console.log('You can now test signup/login flow again!');
    } else {
      const error = await response.json();
      console.error('❌ Failed to delete user:', error);
      console.log('💡 Alternative: Run SQL script in Supabase Dashboard');
    }
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    console.log('💡 Alternative: Run SQL script in Supabase Dashboard');
  }
}

/**
 * Quick delete for current logged-in user
 * WARNING: This will delete YOUR account!
 */
async function deleteMyAccount() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('❌ No active session');
    return;
  }

  const email = session.user.email;
  const confirmed = confirm(`⚠️ Are you sure you want to delete your account (${email})? This cannot be undone!`);

  if (confirmed) {
    await deleteTestUser(email);

    // Sign out after deletion
    setTimeout(async () => {
      await supabase.auth.signOut();
      console.log('✅ Signed out. Refresh page to test login flow.');
      window.location.href = '/login';
    }, 2000);
  } else {
    console.log('❌ Deletion cancelled');
  }
}

/**
 * List all test users (emails with +test, +mobile, etc.)
 */
async function listTestUsers() {
  console.log('🔍 Fetching test users...');

  // This would require a backend endpoint
  console.log('💡 Run this SQL query in Supabase Dashboard instead:');
  console.log(`
    SELECT id, email, name, onboarding_completed, created_at
    FROM users
    WHERE email LIKE '%+test%'
       OR email LIKE '%+mobile%'
       OR email LIKE '%@example.com'
    ORDER BY created_at DESC;
  `);
}

// ============================================================================
// USAGE EXAMPLES:
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Delete Test User Helper - Available Functions                 ║
╚═══════════════════════════════════════════════════════════════╝

1. Delete a specific user:
   deleteTestUser('holly@advicly.co.uk')

2. Delete your own account (current logged-in user):
   deleteMyAccount()

3. List test users (shows SQL query to run):
   listTestUsers()

4. Quick delete common test emails:
   deleteTestUser('test@example.com')
   deleteTestUser('your.email+test1@gmail.com')

⚠️  Note: If these functions don't work, use the SQL script instead:
   → Open Supabase Dashboard → SQL Editor
   → Run queries from DELETE_TEST_USERS.sql

📝 After deleting, you can test the onboarding flow from scratch!
`);

// ============================================================================
// Export functions to global scope
// ============================================================================
window.deleteTestUser = deleteTestUser;
window.deleteMyAccount = deleteMyAccount;
window.listTestUsers = listTestUsers;
