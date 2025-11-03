# Testing SQL Queries

Use these queries in Supabase SQL Editor to verify the fix is working.

---

## 🗑️ Delete Test User (Run Before Each Test)

**Replace `test@example.com` with your actual test email**

```sql
-- =====================================================
-- DELETE TEST USER AND ALL RELATED DATA
-- =====================================================

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'test@example.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found: test@example.com';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user: % with ID: %', 'test@example.com', v_user_id;
    
    -- Delete all related data
    DELETE FROM ask_messages 
    WHERE thread_id IN (SELECT id FROM ask_threads WHERE user_id = v_user_id);
    
    DELETE FROM ask_threads WHERE user_id = v_user_id;
    DELETE FROM client_todos WHERE user_id = v_user_id;
    DELETE FROM client_documents WHERE user_id = v_user_id;
    DELETE FROM client_business_types 
    WHERE client_id IN (SELECT id FROM clients WHERE user_id = v_user_id);
    DELETE FROM transcript_action_items WHERE user_id = v_user_id;
    DELETE FROM pipeline_activities WHERE user_id = v_user_id;
    DELETE FROM meetings WHERE user_id = v_user_id;
    DELETE FROM clients WHERE user_id = v_user_id;
    DELETE FROM calendar_connections WHERE user_id = v_user_id;
    DELETE FROM tenants WHERE owner_id = v_user_id;
    DELETE FROM users WHERE id = v_user_id;
    
    RAISE NOTICE 'User and all related data successfully deleted!';
END $$;

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM users WHERE email = 'test@example.com';
```

---

## ✅ Verify User Created

```sql
SELECT 
    id,
    email,
    name,
    provider,
    providerid,
    tenant_id,
    onboarding_completed,
    created_at
FROM users 
WHERE email = 'test@example.com';
```

**Expected Result:**
- `id`: UUID (not integer)
- `email`: test@example.com
- `name`: Your name from Google
- `provider`: 'google'
- `providerid`: Google user ID
- `tenant_id`: UUID (should be set)
- `onboarding_completed`: false
- `created_at`: Recent timestamp

---

## ✅ Verify Tenant Created

```sql
SELECT 
    id,
    name,
    owner_id,
    timezone,
    currency,
    created_at
FROM tenants 
WHERE owner_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

**Expected Result:**
- `id`: UUID
- `name`: "test@example.com's Business" (or similar)
- `owner_id`: User's UUID
- `timezone`: 'UTC'
- `currency`: 'USD'
- `created_at`: Recent timestamp

---

## ✅ Verify Calendar Connection

```sql
SELECT 
    id,
    user_id,
    tenant_id,
    provider,
    provider_account_email,
    is_active,
    is_primary,
    sync_enabled,
    transcription_enabled,
    token_expires_at,
    last_sync_at,
    created_at
FROM calendar_connections 
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

**Expected Result:**
- `id`: UUID
- `user_id`: User's UUID
- `tenant_id`: Tenant's UUID
- `provider`: 'google'
- `provider_account_email`: test@example.com
- `is_active`: true
- `is_primary`: true
- `sync_enabled`: true ✅ **CRITICAL**
- `transcription_enabled`: true ✅ **CRITICAL**
- `token_expires_at`: Future timestamp
- `last_sync_at`: Recent timestamp (if sync completed)
- `created_at`: Recent timestamp

---

## ✅ Verify Meetings Synced

```sql
SELECT 
    id,
    user_id,
    title,
    starttime,
    endtime,
    meeting_source,
    created_at
FROM meetings 
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
ORDER BY starttime DESC
LIMIT 10;
```

**Expected Result:**
- Multiple rows if user has meetings in Google Calendar
- `meeting_source`: 'google'
- `starttime` and `endtime`: Valid timestamps
- `created_at`: Recent timestamp

---

## 📊 Summary Query (All Data for User)

```sql
WITH user_data AS (
  SELECT id, email FROM users WHERE email = 'test@example.com'
)
SELECT 
  'users' as table_name, 
  COUNT(*) as count 
FROM users 
WHERE id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'tenants', COUNT(*) 
FROM tenants 
WHERE owner_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'calendar_connections', COUNT(*) 
FROM calendar_connections 
WHERE user_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'meetings', COUNT(*) 
FROM meetings 
WHERE user_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'clients', COUNT(*) 
FROM clients 
WHERE user_id IN (SELECT id FROM user_data)
UNION ALL
SELECT 'ask_threads', COUNT(*) 
FROM ask_threads 
WHERE user_id IN (SELECT id FROM user_data);
```

**Expected Result:**
- users: 1
- tenants: 1
- calendar_connections: 1
- meetings: 1+ (depends on Google Calendar)
- clients: 0+ (depends on meeting attendees)
- ask_threads: 0

---

## 🔍 Check for Errors

```sql
-- Check if any users have NULL tenant_id
SELECT id, email, tenant_id 
FROM users 
WHERE tenant_id IS NULL;

-- Check if any calendar connections are missing required fields
SELECT id, user_id, sync_enabled, transcription_enabled 
FROM calendar_connections 
WHERE sync_enabled = false OR transcription_enabled = false;

-- Check if any meetings have NULL user_id
SELECT id, title, user_id 
FROM meetings 
WHERE user_id IS NULL;
```

**Expected Result:**
- All queries should return 0 rows (no errors)

---

## 🧹 Cleanup (Delete All Test Users)

```sql
-- Delete all test users and their data
DO $$
DECLARE
    v_user_id UUID;
    v_cursor CURSOR FOR SELECT id FROM users WHERE email LIKE '%test%';
BEGIN
    OPEN v_cursor;
    LOOP
        FETCH v_cursor INTO v_user_id;
        EXIT WHEN NOT FOUND;
        
        DELETE FROM ask_messages 
        WHERE thread_id IN (SELECT id FROM ask_threads WHERE user_id = v_user_id);
        DELETE FROM ask_threads WHERE user_id = v_user_id;
        DELETE FROM client_todos WHERE user_id = v_user_id;
        DELETE FROM client_documents WHERE user_id = v_user_id;
        DELETE FROM client_business_types 
        WHERE client_id IN (SELECT id FROM clients WHERE user_id = v_user_id);
        DELETE FROM transcript_action_items WHERE user_id = v_user_id;
        DELETE FROM pipeline_activities WHERE user_id = v_user_id;
        DELETE FROM meetings WHERE user_id = v_user_id;
        DELETE FROM clients WHERE user_id = v_user_id;
        DELETE FROM calendar_connections WHERE user_id = v_user_id;
        DELETE FROM tenants WHERE owner_id = v_user_id;
        DELETE FROM users WHERE id = v_user_id;
        
        RAISE NOTICE 'Deleted user: %', v_user_id;
    END LOOP;
    CLOSE v_cursor;
    RAISE NOTICE 'All test users deleted!';
END $$;
```

---

## 📝 Notes

- Replace `'test@example.com'` with your actual test email in all queries
- Run delete query before each test to start fresh
- Run verification queries after signup to confirm data was created
- All UUIDs should be valid UUID format (not integers)
- All timestamps should be recent (within last few minutes)

