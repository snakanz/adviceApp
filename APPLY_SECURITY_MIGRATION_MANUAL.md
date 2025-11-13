# 🔒 MANUAL MIGRATION: Apply RLS Policies & Webhook Health

## CRITICAL: This fixes a massive data breach vulnerability

**Issue:** User logged into their account and automatically logged into another user's Calendly account.

---

## Step 1: Go to Supabase Dashboard

1. Open https://app.supabase.com
2. Select your Advicly project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**

---

## Step 2: Copy & Paste the Migration SQL

Copy the entire SQL from `backend/migrations/029_add_rls_policies_and_webhook_health.sql`

Or use this complete SQL:

```sql
-- =====================================================
-- MIGRATION 029: Add RLS Policies & Webhook Health Tracking
-- =====================================================

-- PART 1: ADD WEBHOOK HEALTH TRACKING COLUMNS
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS webhook_last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT 'unknown' CHECK (webhook_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS webhook_verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unknown' CHECK (verification_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- PART 2: ENABLE RLS ON CRITICAL TABLES
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- PART 3: CREATE RLS POLICIES FOR calendar_connections
CREATE POLICY "Users can view their own calendar connections"
ON calendar_connections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections"
ON calendar_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON calendar_connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
ON calendar_connections FOR DELETE USING (auth.uid() = user_id);

-- PART 4: CREATE RLS POLICIES FOR calendly_webhook_subscriptions
CREATE POLICY "Users can view their own webhook subscriptions"
ON calendly_webhook_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook subscriptions"
ON calendly_webhook_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook subscriptions"
ON calendly_webhook_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook subscriptions"
ON calendly_webhook_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- PART 5: CREATE RLS POLICIES FOR calendar_watch_channels
CREATE POLICY "Users can view their own watch channels"
ON calendar_watch_channels FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own watch channels"
ON calendar_watch_channels FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch channels"
ON calendar_watch_channels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch channels"
ON calendar_watch_channels FOR DELETE USING (auth.uid() = user_id);

-- PART 6: CREATE INDEXES FOR WEBHOOK HEALTH CHECKS
CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_status
ON calendar_connections(user_id, webhook_status)
WHERE provider = 'calendly' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_last_verified
ON calendar_connections(user_id, webhook_last_verified_at)
WHERE provider = 'calendly' AND is_active = true;
```

---

## Step 3: Run the Query

1. Paste the SQL into the query editor
2. Click **Run** button (or Cmd+Enter)
3. Wait for completion (should take ~5 seconds)
4. You should see: ✅ **Success**

---

## Step 4: Verify Migration Applied

Run this verification query:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
ORDER BY tablename;

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
ORDER BY tablename, policyname;
```

Expected output:
- ✅ All 3 tables have `rowsecurity = true`
- ✅ 16 policies total (4 per table × 4 tables)

---

## Step 5: Deploy Code

```bash
cd /Users/Nelson/adviceApp
git add -A
git commit -m "Security fix: Add RLS policies and webhook health checks

- Add RLS policies to prevent cross-user data access
- Add webhook health tracking and auto-recreation
- Fixes data breach where users could access other users' Calendly accounts"
git push origin main
```

Render will auto-deploy in ~2 minutes.

---

## Step 6: Test Security

1. **User A logs in** → Can only see their own calendar connections ✅
2. **User B logs in** → Cannot see User A's connections ✅
3. **User A disconnects Calendly** → Webhook is deleted ✅
4. **User A logs back in after 1 week** → Webhook is auto-recreated ✅

---

## What This Fixes

✅ **CRITICAL:** Users can no longer access other users' Calendly accounts
✅ **CRITICAL:** Webhooks stay active permanently
✅ **SECURITY:** Row-level security on all calendar tables
✅ **RELIABILITY:** Automatic webhook health monitoring
✅ **RELIABILITY:** Webhook auto-recreation on failure

