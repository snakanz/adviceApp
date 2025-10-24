# 🚨 URGENT: Migration 020 Must Be Applied

## The Situation

Your database is **missing critical schema** that the backend code expects:

```
❌ tenants table - MISSING
❌ users.tenant_id column - MISSING
✅ calendar_connections table - EXISTS
✅ Backend code - READY
```

**This is why calendar connections are failing.**

---

## What You Need to Do (3 Steps, 10 Minutes)

### Step 1: Apply Migration (5 min)

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** → **New Query**
4. Copy **entire contents** of `MIGRATION_020_MINIMAL.sql`
5. Paste into editor
6. Click **Run**
7. ✅ Done!

### Step 2: Create Default Tenant (2 min)

Run this SQL:

```sql
INSERT INTO tenants (name, owner_id, timezone, currency)
VALUES (
  'snaka1003@gmail.com''s Business',
  '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d',
  'UTC',
  'USD'
) RETURNING id;
```

Copy the returned ID, then run:

```sql
UPDATE users 
SET tenant_id = '[PASTE_ID_HERE]'
WHERE id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```

### Step 3: Test (3 min)

1. Clear browser cache
2. Go to https://adviceapp.pages.dev
3. Sign in as snaka1003@gmail.com
4. Go to Calendar Settings
5. Click "Connect Calendly"
6. ✅ Should work now!

---

## Files Ready for You

- **MIGRATION_020_MINIMAL.sql** ← Copy & paste this
- **CRITICAL_NEXT_STEPS.md** ← Detailed instructions
- **INVESTIGATION_SUMMARY.md** ← Root cause analysis

---

## Why This Matters

Without this migration:
- ❌ Calendar connections cannot be saved
- ❌ Multi-tenant architecture is broken
- ❌ User data cannot be properly isolated
- ❌ Onboarding flow cannot work

With this migration:
- ✅ Calendar connections save properly
- ✅ Multi-tenant isolation works
- ✅ User data is secure
- ✅ Onboarding flow works

---

## After Migration

Once migration is applied and tested:
1. Clean up 403 stale Calendly meetings
2. Implement sync progress UI
3. Complete onboarding flow

---

## 👉 Next Action

**Apply MIGRATION_020_MINIMAL.sql now!**

This is the critical blocker. Everything else depends on it.

