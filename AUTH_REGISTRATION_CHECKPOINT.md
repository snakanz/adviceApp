# Auth Registration Checkpoint - Ready for Fresh Chat

**Date:** 2025-11-03  
**Status:** ✅ Schema Standardization Complete - Ready for Registration Testing

---

## ✅ Completed Work

### 1. Database Schema Standardized
All tables now use `user_id` (UUID) consistently:
- ✅ `client_todos.user_id` (UUID)
- ✅ `client_documents.user_id` (UUID)
- ✅ `pipeline_activities.user_id` (UUID)
- ✅ `ask_threads.user_id` (UUID)
- ✅ `transcript_action_items.user_id` (UUID)
- ✅ `pending_transcript_action_items.user_id` (UUID)

### 2. Backend Code Updated
Updated 11 instances across 4 files to use `user_id` instead of `advisor_id`:
- ✅ `backend/src/routes/pipeline.js` (5 changes)
- ✅ `backend/src/services/clientDocuments.js` (4 changes)
- ✅ `backend/src/routes/transcriptActionItems.js` (1 change)
- ✅ `backend/src/services/cascadeDeletionManager.js` (1 change)

**Commit:** `01a8d98` - Deployed to Render

### 3. RLS Policies Updated
All policies now use `user_id = auth.uid()` for proper multi-tenant filtering

---

## Current Database State

**nelson@greenwood.co.nz exists:**
```json
{
  "id": "5ec286fd-74fb-4cda-b0f7-cb4bb4a1a0a5",
  "name": "Nelson Greenwood's Business",
  "owner_id": "5ec286fd-74fb-4cda-b0f7-cb4bb4a1a0a5",
  "created_at": "2025-11-03 19:42:37.940789+00"
}
```

---

## Next Steps for Fresh Chat

### Option A: Test with Existing User
1. Check if `nelson@greenwood.co.nz` exists in Supabase Auth
2. If yes → User can log in directly
3. If no → Delete from database and test fresh registration

### Option B: Fresh Registration Test
1. Delete `nelson@greenwood.co.nz` from database (SQL provided below)
2. Delete from Supabase Auth (if exists)
3. Test fresh Google OAuth registration
4. Verify user created with correct UUID and tenant

---

## SQL to Delete User (if needed)

```sql
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'nelson@greenwood.co.nz';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found';
        RETURN;
    END IF;
    
    DELETE FROM ask_messages WHERE thread_id IN (SELECT id FROM ask_threads WHERE user_id = v_user_id);
    DELETE FROM ask_threads WHERE user_id = v_user_id;
    DELETE FROM client_todos WHERE user_id = v_user_id;
    DELETE FROM client_documents WHERE user_id = v_user_id;
    DELETE FROM client_business_types WHERE client_id IN (SELECT id FROM clients WHERE user_id = v_user_id);
    DELETE FROM transcript_action_items WHERE user_id = v_user_id;
    DELETE FROM pending_transcript_action_items WHERE user_id = v_user_id;
    DELETE FROM pipeline_activities WHERE user_id = v_user_id;
    DELETE FROM meetings WHERE user_id = v_user_id;
    DELETE FROM clients WHERE user_id = v_user_id;
    DELETE FROM calendar_connections WHERE user_id = v_user_id;
    DELETE FROM tenants WHERE owner_id = v_user_id;
    DELETE FROM users WHERE id = v_user_id;
    
    RAISE NOTICE 'User deleted successfully';
END $$;
```

---

## Key Components

### UserService (Consolidated User Creation)
**Location:** `backend/src/services/userService.js`

Two methods:
1. `getOrCreateUser(supabaseUser)` - Get or create user with Supabase Auth UUID
2. `ensureUserHasTenant(user)` - Ensure user has default tenant

Used by:
- `/api/users/profile` endpoint
- Google OAuth callback
- Calendar OAuth callback

### Registration Flow
1. User clicks "Sign up with Google"
2. Google OAuth callback triggered
3. UserService.getOrCreateUser() called
4. User created with Supabase Auth UUID (consistent)
5. Default tenant created automatically
6. Frontend redirected to onboarding

---

## Testing Checklist for Next Chat

- [ ] Verify nelson@greenwood.co.nz in Supabase Auth
- [ ] Delete user if needed
- [ ] Test fresh Google OAuth registration
- [ ] Verify user created with correct UUID
- [ ] Verify tenant created automatically
- [ ] Verify onboarding flow works
- [ ] Verify calendar connection works
- [ ] Check Render logs for any errors

---

## Important Files

- `backend/src/services/userService.js` - Consolidated user creation
- `backend/src/routes/auth.js` - Google OAuth endpoints
- `backend/src/routes/calendar.js` - Calendar OAuth endpoints
- `backend/src/index.js` - User profile endpoint
- `CONSOLIDATED_USER_SERVICE_DEPLOYMENT.md` - Detailed deployment notes
- `SCHEMA_STANDARDIZATION_COMPLETE.md` - Schema fix details

---

## Ready for Next Chat ✅

All schema and backend code is standardized and deployed. Next chat should focus on:
1. Verifying/deleting existing user
2. Testing fresh registration flow
3. Debugging any issues that arise

