# 🔴 CRITICAL BUG: OAuth Callback Creating Wrong User

## 🚨 The Problem

**Multi-tenant data isolation violation!** Calendly meetings are being synced to the WRONG user account.

### What's Happening

**User**: snaka1003@gmail.com
- **Supabase Auth ID**: `4c903cdf-85ba-4608-8be9-23ec8bbbaa7d` ✅ Correct
- **Logged in as**: Nelson Greenwood

**When connecting Calendly:**
1. User clicks "Connect Calendly"
2. Redirected to Calendly OAuth
3. OAuth callback receives authorization code
4. **BUG**: Code searches for user by **Calendly email** (not authenticated user!)
5. Doesn't find match → **Creates NEW user** with ID `87b22d98-9347-48bc-b34a-b194ca0fd55f`
6. **All 403 Calendly meetings synced to WRONG user!**

### Evidence

**Database shows:**
```
User 1: 4c903cdf-85ba-4608-8be9-23ec8bbbaa7d (snaka1003@gmail.com) - Logged in
User 2: 87b22d98-9347-48bc-b34a-b194ca0fd55f (Different email) - Created by OAuth bug
         └─ Has 403 Calendly meetings (WRONG!)
```

**Meeting data:**
```json
{
  "user_id": "87b22d98-9347-48bc-b34a-b194ca0fd55f",  // ❌ WRONG USER!
  "title": "Financial Review with Nelson Greenwood",
  "meeting_source": "calendly",
  "created_at": "2025-10-23 15:50:50"
}
```

---

## 🔍 Root Cause

**File**: `backend/src/routes/calendar.js` (Lines 1733-1766)

```javascript
// ❌ WRONG: Searching by Calendly email instead of authenticated user
const { data: existingUser, error: findError } = await getSupabase()
  .from('users')
  .eq('email', calendlyUser.email)  // ❌ Calendly email, not auth user!
  .single();

if (!user) {
  // ❌ WRONG: Creates NEW user instead of linking to authenticated user
  const { data: newUser, error: createError } = await getSupabase()
    .from('users')
    .insert({
      email: calendlyUser.email,  // ❌ Calendly email
      name: calendlyUser.name,
      provider: 'calendly',
      providerid: calendlyUser.uri
    })
    .select()
    .single();
  
  user = newUser;  // ❌ Now syncing to wrong user!
}
```

---

## ✅ The Fix

**The OAuth callback should NOT create users!**

The callback should:
1. ✅ Get the **authenticated user** from the request (not from Calendly email)
2. ✅ Store Calendly connection for that user
3. ✅ Sync meetings to that user

**Correct approach:**
```javascript
// ✅ CORRECT: Get authenticated user from request
const userId = req.user.id;  // From Supabase JWT token

// ✅ CORRECT: Store connection for authenticated user
await getSupabase()
  .from('calendar_connections')
  .insert({
    user_id: userId,  // ✅ Authenticated user
    provider: 'calendly',
    access_token: accessToken,
    refresh_token: refreshToken,
    is_active: true
  });

// ✅ CORRECT: Sync to authenticated user
const syncResult = await calendlyService.syncMeetingsToDatabase(userId);
```

---

## 🎯 Impact

| Issue | Impact | Severity |
|-------|--------|----------|
| Wrong user ID | Meetings in wrong account | 🔴 CRITICAL |
| Data isolation | Multi-tenant violation | 🔴 CRITICAL |
| User confusion | User can't see their meetings | 🔴 CRITICAL |
| Data cleanup | Need to migrate 403 meetings | 🟠 HIGH |

---

## 📋 Required Actions

1. **Fix OAuth callback** - Use authenticated user, not Calendly email
2. **Migrate existing meetings** - Move 403 meetings from wrong user to correct user
3. **Delete duplicate user** - Remove the incorrectly created user
4. **Verify data integrity** - Ensure all meetings are with correct user

---

## 🔐 Why This Matters for Multi-Tenant

In a multi-tenant system:
- ❌ **WRONG**: Creating users based on external data (Calendly email)
- ✅ **CORRECT**: Using authenticated user from JWT token
- ❌ **WRONG**: Syncing data to wrong user account
- ✅ **CORRECT**: Syncing data to authenticated user only

This is a **fundamental security issue** that could leak data between users!

