# How to Delete Test Users - Complete Guide

This guide provides multiple methods to delete test users from Supabase so you can test the login/signup/onboarding flow from scratch.

## Method 1: SQL Script in Supabase Dashboard (Recommended)

This is the **safest and most reliable** method.

### Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy one of the options from [DELETE_TEST_USERS.sql](DELETE_TEST_USERS.sql)
6. Run the query

### Quick Delete a Specific User:

```sql
-- Replace 'holly@advicly.co.uk' with your test user email
DO $$
DECLARE
  test_email TEXT := 'holly@advicly.co.uk';
  test_user_id UUID;
BEGIN
  SELECT id INTO test_user_id FROM users WHERE email = test_email;

  IF test_user_id IS NOT NULL THEN
    DELETE FROM calendar_connections WHERE user_id = test_user_id;
    DELETE FROM meetings WHERE user_id = test_user_id;
    DELETE FROM clients WHERE user_id = test_user_id;
    DELETE FROM action_items WHERE user_id = test_user_id;
    DELETE FROM auth.users WHERE email = test_email;
    DELETE FROM users WHERE id = test_user_id;

    RAISE NOTICE 'Successfully deleted user: %', test_email;
  ELSE
    RAISE NOTICE 'User not found: %', test_email;
  END IF;
END $$;
```

### View Users Before Deleting:

```sql
SELECT
  u.id,
  u.email,
  u.name,
  u.onboarding_completed,
  u.onboarding_step,
  u.created_at,
  COUNT(DISTINCT cc.id) as calendar_connections,
  COUNT(DISTINCT m.id) as meetings,
  COUNT(DISTINCT c.id) as clients
FROM users u
LEFT JOIN calendar_connections cc ON cc.user_id = u.id
LEFT JOIN meetings m ON m.user_id = u.id
LEFT JOIN clients c ON c.user_id = u.id
WHERE u.email = 'holly@advicly.co.uk'
GROUP BY u.id
ORDER BY u.created_at DESC;
```

---

## Method 2: Browser Console (Quick & Easy)

If you're logged in to the app and want to quickly delete your test account:

### Steps:

1. Open your app: https://adviceapp.pages.dev
2. Log in as the test user you want to delete
3. Open browser console (F12 or Cmd+Option+I)
4. Copy and paste the entire [delete-test-user.js](delete-test-user.js) file
5. Run one of these commands:

```javascript
// Delete current logged-in user (yourself)
deleteMyAccount()

// Delete a specific user by email
deleteTestUser('holly@advicly.co.uk')

// See available commands
listTestUsers()
```

**Note**: This method requires the backend to have a delete endpoint. If it doesn't work, use Method 1 (SQL) instead.

---

## Method 3: Gmail Aliases for Unlimited Testing

Instead of deleting users, use Gmail aliases to create unlimited test accounts:

```
your.email@gmail.com          → Original
your.email+test1@gmail.com    → Test account 1
your.email+test2@gmail.com    → Test account 2
your.email+mobile1@gmail.com  → Mobile test
your.email+holly@gmail.com    → Holly test
```

**All emails go to your single Gmail inbox!**

### Benefits:
- No need to delete users
- Each variation is treated as unique by Supabase
- All confirmation emails go to same inbox
- Perfect for testing multiple scenarios

### Usage:
1. Sign up with: `your.email+test1@gmail.com`
2. Check your Gmail inbox for confirmation
3. Complete onboarding
4. Test with: `your.email+test2@gmail.com` for another test
5. Repeat infinitely with different aliases

---

## Method 4: Supabase Auth Admin API

If you have admin access, you can delete users via the Supabase Admin API:

```javascript
// In your backend or admin panel
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key, not anon key
);

async function deleteUser(userId) {
  // Delete from auth.users
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    console.error('Error deleting from auth:', authError);
    return;
  }

  // Delete from users table (will cascade to related tables if set up)
  const { error: dbError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (dbError) {
    console.error('Error deleting from users table:', dbError);
    return;
  }

  console.log('✅ User deleted successfully');
}

// Usage
deleteUser('user-uuid-here');
```

---

## Quick Testing Workflow

### Option A: Using Gmail Aliases (No Deletion Needed)

1. Sign up with: `your.email+test1@gmail.com`
2. Complete onboarding flow
3. Test features
4. Want to test again? Use: `your.email+test2@gmail.com`
5. Repeat infinitely

### Option B: Using Same Test Account

1. Create test account: `holly@advicly.co.uk`
2. Test onboarding flow
3. When done, delete using Method 1 (SQL)
4. Test again with same email

---

## Common Test Scenarios

### Test Onboarding from Scratch

```sql
-- Delete holly@advicly.co.uk completely
DELETE FROM calendar_connections WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM meetings WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM clients WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM action_items WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM auth.users WHERE email = 'holly@advicly.co.uk';
DELETE FROM users WHERE email = 'holly@advicly.co.uk';
```

### Reset Onboarding Progress (Keep User, Delete Data)

```sql
-- Reset holly@advicly.co.uk to fresh state
UPDATE users
SET
  onboarding_completed = false,
  onboarding_step = 1,
  business_name = NULL,
  business_type = NULL,
  team_size = NULL,
  timezone = NULL
WHERE email = 'holly@advicly.co.uk';

-- Optionally clear their data
DELETE FROM calendar_connections WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM meetings WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
DELETE FROM clients WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
```

### Delete All Test Users at Once

```sql
-- Delete all users with test emails
DELETE FROM calendar_connections WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%+test%' OR email LIKE '%@example.com'
);
DELETE FROM meetings WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%+test%' OR email LIKE '%@example.com'
);
DELETE FROM clients WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%+test%' OR email LIKE '%@example.com'
);
DELETE FROM auth.users WHERE email LIKE '%+test%' OR email LIKE '%@example.com';
DELETE FROM users WHERE email LIKE '%+test%' OR email LIKE '%@example.com';
```

---

## Safety Tips

✅ **Always view users before deleting** - Run the SELECT query first
✅ **Use Gmail aliases for testing** - Less deletion, more testing
✅ **Test in development first** - Use local Supabase for testing
✅ **Backup important data** - Never run delete queries on production without backup
✅ **Double-check email addresses** - One wrong character deletes the wrong user

❌ **Never delete production users** - Only use for development/testing
❌ **Don't delete users created in last 1 hour** - They might be real signups
❌ **Don't run mass deletions blindly** - Always check the WHERE clause

---

## Troubleshooting

### "User not found" after deletion
- Clear browser cache and cookies
- Close all browser tabs
- Restart browser
- Try signing up again

### "Email already exists" after deletion
- User might still exist in `auth.users` table
- Run: `DELETE FROM auth.users WHERE email = 'your@email.com';`
- Wait 1-2 minutes for cache to clear

### Cannot delete user (foreign key constraint)
- Delete related records first (meetings, clients, calendar_connections)
- Or use the DO block script which handles order correctly

---

## Files Reference

- [DELETE_TEST_USERS.sql](DELETE_TEST_USERS.sql) - SQL scripts for Supabase Dashboard
- [delete-test-user.js](delete-test-user.js) - Browser console helper functions
- [QUICK-MOBILE-TEST-SETUP.md](QUICK-MOBILE-TEST-SETUP.md) - Gmail aliases and testing methods

---

**Remember**: Using Gmail aliases (`your.email+test1@gmail.com`) is the easiest way to test without needing to delete users!
