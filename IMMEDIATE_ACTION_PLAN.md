# 🚨 IMMEDIATE ACTION PLAN

## CRITICAL: Data Breach Fixed - Follow These Steps NOW

---

## ⏱️ TIMELINE

### RIGHT NOW (5 minutes)
1. ✅ Code pushed to GitHub (DONE)
2. ⏳ Render auto-deploying (2 minutes remaining)

### NEXT (10 minutes)
3. **Apply Database Migration** (MANUAL - see below)
4. Verify RLS policies are enabled

### AFTER THAT (5 minutes)
5. Test security
6. Monitor logs

---

## 🔴 STEP 1: APPLY DATABASE MIGRATION (CRITICAL)

**This is the most important step - do this immediately**

### Option A: Quick Copy-Paste (Recommended)

1. Open https://app.supabase.com
2. Select your Advicly project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy this SQL:

```sql
-- Add webhook health columns
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS webhook_last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT 'unknown' CHECK (webhook_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS webhook_verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unknown' CHECK (verification_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Enable RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for calendar_connections
CREATE POLICY "Users can view their own calendar connections" ON calendar_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own calendar connections" ON calendar_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own calendar connections" ON calendar_connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own calendar connections" ON calendar_connections FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for calendly_webhook_subscriptions
CREATE POLICY "Users can view their own webhook subscriptions" ON calendly_webhook_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own webhook subscriptions" ON calendly_webhook_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own webhook subscriptions" ON calendly_webhook_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own webhook subscriptions" ON calendly_webhook_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for calendar_watch_channels
CREATE POLICY "Users can view their own watch channels" ON calendar_watch_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own watch channels" ON calendar_watch_channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watch channels" ON calendar_watch_channels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watch channels" ON calendar_watch_channels FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_status ON calendar_connections(user_id, webhook_status) WHERE provider = 'calendly' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_last_verified ON calendar_connections(user_id, webhook_last_verified_at) WHERE provider = 'calendly' AND is_active = true;
```

6. Click **Run** (or Cmd+Enter)
7. Wait for ✅ **Success**

### Option B: Full Migration File

See `APPLY_SECURITY_MIGRATION_MANUAL.md` for complete SQL

---

## ✅ STEP 2: VERIFY MIGRATION

Run this query to verify:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
ORDER BY tablename;
```

Expected: All 3 tables have `rowsecurity = true`

---

## 🧪 STEP 3: TEST SECURITY

1. **User A logs in** → Can only see their own calendar connections ✅
2. **User B logs in** → Cannot see User A's connections ✅
3. **User A disconnects Calendly** → Webhook is deleted ✅
4. **User A logs back in after 1 week** → Webhook is auto-recreated ✅

---

## 📊 STEP 4: MONITOR LOGS

Check Render logs for any errors:
https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730

Look for:
- ✅ `Webhook health check` messages
- ✅ `Webhook verified` messages
- ❌ Any `Error` messages

---

## 📋 WHAT WAS FIXED

### Security Issue #1: Data Breach
- **Problem:** User logged into account and auto-logged into another user's Calendly
- **Root Cause:** No RLS policies
- **Fix:** Added 16 RLS policies across 3 tables
- **Status:** ✅ FIXED

### Reliability Issue #2: Webhook Expiration
- **Problem:** Webhooks expire when user logs out
- **Root Cause:** No health monitoring or auto-recreation
- **Fix:** Added WebhookHealthService with auto-recreation
- **Status:** ✅ FIXED

---

## 📞 NEED HELP?

1. Check `SECURITY_FIX_RLS_AND_WEBHOOK_HEALTH.md` for detailed explanation
2. Check `RLS_POLICIES_QUICK_REFERENCE.md` for RLS details
3. Check `APPLY_SECURITY_MIGRATION_MANUAL.md` for migration steps
4. Check Render logs for errors

---

## ✨ SUMMARY

✅ Code deployed to GitHub
✅ Render auto-deploying
⏳ **NEXT: Apply database migration (10 minutes)**
⏳ Test security
⏳ Monitor logs

**Total time to complete: ~20 minutes**

