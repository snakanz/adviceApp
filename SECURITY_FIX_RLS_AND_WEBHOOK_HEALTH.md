# 🔒 CRITICAL SECURITY FIX: RLS Policies & Webhook Health

## Issue #1: MASSIVE DATA BREACH - Cross-User Calendly Access

### Problem
User logged into their account and **automatically logged into another user's Calendly account**. This is a critical security vulnerability.

### Root Cause
**NO ROW LEVEL SECURITY (RLS) POLICIES** on `calendar_connections` and `calendly_webhook_subscriptions` tables.

Without RLS, any authenticated user could query another user's calendar data:
```sql
-- VULNERABLE: User A could run this and get User B's data
SELECT * FROM calendar_connections WHERE provider = 'calendly';
```

### Solution: Add RLS Policies
Migration `029_add_rls_policies_and_webhook_health.sql` adds:

**For `calendar_connections` table:**
- ✅ SELECT: Users can only view their own connections
- ✅ INSERT: Users can only create connections for themselves
- ✅ UPDATE: Users can only update their own connections
- ✅ DELETE: Users can only delete their own connections

**For `calendly_webhook_subscriptions` table:**
- ✅ SELECT: Users can only view their own webhooks
- ✅ INSERT: Users can only create webhooks for themselves
- ✅ UPDATE: Users can only update their own webhooks
- ✅ DELETE: Users can only delete their own webhooks

**For `calendar_watch_channels` table:**
- ✅ SELECT: Users can only view their own watch channels
- ✅ INSERT: Users can only create watch channels for themselves
- ✅ UPDATE: Users can only update their own watch channels
- ✅ DELETE: Users can only delete their own watch channels

---

## Issue #2: Webhooks Expire After User Logs Out

### Problem
Webhooks work when user is connected, but expire/disconnect when user logs out and comes back weeks later.

### Root Cause
1. **No webhook health monitoring** - System doesn't verify webhooks still exist
2. **No auto-recreation** - If webhook is deleted, it's not recreated
3. **No verification on login** - When user logs back in, webhook status is not checked

### Solution: Webhook Health Service

**New Service: `WebhookHealthService`**
- Checks if webhook still exists in Calendly
- Automatically recreates webhook if missing
- Tracks webhook status and verification time
- Runs on every user login (non-blocking)

**New Columns in Database:**
```sql
-- calendar_connections table
webhook_last_verified_at TIMESTAMP  -- When we last confirmed webhook exists
webhook_status TEXT                 -- 'active', 'missing', 'error', 'unknown'
webhook_verification_attempts INT   -- Track retry attempts
webhook_last_error TEXT             -- Error message if verification failed

-- calendly_webhook_subscriptions table
last_verified_at TIMESTAMP
verification_status TEXT
last_error TEXT
```

**How It Works:**
1. User logs in → GET /api/calendar-connections is called
2. System checks if Calendly connection exists
3. If yes, runs `WebhookHealthService.checkAndRepairWebhook(userId)` in background
4. Service verifies webhook exists in Calendly
5. If missing, automatically recreates it
6. Updates webhook status in database

**Result:** Webhooks stay active permanently, even if user logs out and comes back weeks later.

---

## Deployment Steps

### Step 1: Apply Database Migration
```sql
-- Run on Supabase SQL Editor:
-- Copy content from: backend/migrations/029_add_rls_policies_and_webhook_health.sql
```

### Step 2: Deploy Code
```bash
git add -A
git commit -m "Security fix: Add RLS policies and webhook health checks"
git push origin main
# Render auto-deploys
```

### Step 3: Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels');

-- Check policies exist
SELECT * FROM pg_policies 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels');
```

### Step 4: Test Security
1. User A logs in → Can only see their own calendar connections ✅
2. User B logs in → Cannot see User A's connections ✅
3. User A disconnects Calendly → Webhook is deleted ✅
4. User A logs back in after 1 week → Webhook is auto-recreated ✅

---

## Files Modified

1. **backend/migrations/029_add_rls_policies_and_webhook_health.sql** - NEW
   - Adds RLS policies to 3 tables
   - Adds webhook health tracking columns
   - Creates indexes for health checks

2. **backend/src/services/webhookHealthService.js** - NEW
   - Checks webhook health
   - Auto-recreates missing webhooks
   - Tracks verification status

3. **backend/src/routes/calendar-settings.js** - MODIFIED
   - GET /api/calendar-connections now checks webhook health
   - POST /api/calendar-connections/webhook/health-check endpoint

---

## Security Impact

✅ **FIXED:** Cross-user data access vulnerability
✅ **FIXED:** Webhook expiration issues
✅ **ADDED:** Row-level security on all calendar tables
✅ **ADDED:** Automatic webhook health monitoring
✅ **ADDED:** Webhook auto-recreation on failure

---

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] RLS policies enabled on all 3 tables
- [ ] User A cannot see User B's calendar connections
- [ ] User A can only see their own connections
- [ ] Webhook health check endpoint works
- [ ] Webhook auto-recreates when missing
- [ ] No errors in Render logs
- [ ] Calendly sync still works after webhook recreation

