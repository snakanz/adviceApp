# 🔐 RLS Policies Quick Reference

## What is RLS?

Row Level Security (RLS) is a database feature that restricts which rows a user can access based on policies.

**Without RLS:** Any authenticated user can query any row
```sql
-- VULNERABLE: User A can see User B's data
SELECT * FROM calendar_connections;
```

**With RLS:** Users can only access their own rows
```sql
-- SECURE: User A can only see their own connections
SELECT * FROM calendar_connections;
-- Returns only rows where user_id = auth.uid()
```

---

## RLS Policies Applied

### 1. calendar_connections Table

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Users can view their own calendar connections | SELECT | `auth.uid() = user_id` |
| Users can create their own calendar connections | INSERT | `auth.uid() = user_id` |
| Users can update their own calendar connections | UPDATE | `auth.uid() = user_id` |
| Users can delete their own calendar connections | DELETE | `auth.uid() = user_id` |

### 2. calendly_webhook_subscriptions Table

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Users can view their own webhook subscriptions | SELECT | `auth.uid() = user_id` |
| Users can create their own webhook subscriptions | INSERT | `auth.uid() = user_id` |
| Users can update their own webhook subscriptions | UPDATE | `auth.uid() = user_id` |
| Users can delete their own webhook subscriptions | DELETE | `auth.uid() = user_id` |

### 3. calendar_watch_channels Table

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Users can view their own watch channels | SELECT | `auth.uid() = user_id` |
| Users can create their own watch channels | INSERT | `auth.uid() = user_id` |
| Users can update their own watch channels | UPDATE | `auth.uid() = user_id` |
| Users can delete their own watch channels | DELETE | `auth.uid() = user_id` |

---

## How It Works

### Example: User A tries to access User B's calendar connection

```sql
-- User A (auth.uid() = 'user-a-uuid') runs:
SELECT * FROM calendar_connections WHERE provider = 'calendly';

-- RLS Policy checks:
-- "Users can view their own calendar connections"
-- USING (auth.uid() = user_id)

-- Result: Only rows where user_id = 'user-a-uuid' are returned
-- User B's rows are HIDDEN (not returned)
```

### Example: User A tries to INSERT a connection for User B

```sql
-- User A tries to create connection for User B:
INSERT INTO calendar_connections (user_id, provider, access_token)
VALUES ('user-b-uuid', 'calendly', 'token');

-- RLS Policy checks:
-- "Users can create their own calendar connections"
-- WITH CHECK (auth.uid() = user_id)

-- Result: INSERT REJECTED
-- Error: "new row violates row-level security policy"
```

---

## Verification Queries

### Check if RLS is enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
ORDER BY tablename;
```

Expected output:
```
tablename                          | rowsecurity
-----------------------------------+------------
calendar_connections               | t
calendar_watch_channels            | t
calendly_webhook_subscriptions     | t
```

### Check all RLS policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
ORDER BY tablename, policyname;
```

### Check specific table policies

```sql
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'calendar_connections'
ORDER BY policyname;
```

---

## Security Impact

### Before RLS
- ❌ User A could query User B's calendar connections
- ❌ User A could see User B's Calendly tokens
- ❌ User A could see User B's webhook subscriptions
- ❌ User A could delete User B's calendar connections

### After RLS
- ✅ User A can only see their own calendar connections
- ✅ User A cannot access User B's Calendly tokens
- ✅ User A cannot see User B's webhook subscriptions
- ✅ User A cannot delete User B's calendar connections
- ✅ Database enforces security at the row level (not just application level)

---

## Important Notes

1. **RLS is enforced at database level** - No way to bypass it from application code
2. **Service role bypasses RLS** - Backend uses service role for admin operations
3. **User role respects RLS** - Frontend uses user role (respects RLS)
4. **Performance impact is minimal** - RLS adds negligible overhead
5. **Policies are checked on every query** - Automatic and transparent

---

## Troubleshooting

### "Permission denied for schema public"
- RLS is enabled but no policies exist
- Solution: Create policies (already done in migration)

### "new row violates row-level security policy"
- Trying to INSERT/UPDATE with wrong user_id
- Solution: Ensure user_id matches auth.uid()

### "SELECT returns no rows"
- RLS policy is working correctly
- User can only see their own rows
- This is expected behavior

### "Cannot enable RLS on table"
- Table might not exist
- Solution: Check table name spelling

