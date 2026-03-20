# 🚨 CRITICAL: Next Steps to Fix Calendar Integration

## Current Situation

**User**: snaka1003@gmail.com (ID: `4c903cdf-85ba-4608-8be9-23ec8bbbaa7d`)

### Database Audit Results
- ✅ User exists in database
- ❌ **CRITICAL**: `users.tenant_id` column is MISSING
- ❌ **CRITICAL**: `tenants` table is MISSING
- ✅ `calendar_connections` table exists (but is empty)
- ⚠️ 403 stale Calendly meetings from 2025-10-23
- ⚠️ 40 Google Calendar meetings
- ⚠️ 237 clients (mostly from Calendly)

### Root Cause
**Migration 020 was never applied to the production database.**

The backend code expects:
- `users.tenant_id` column (UUID, FK to tenants.id)
- `tenants` table (for multi-tenant architecture)
- `calendar_connections.tenant_id` column (already exists)

Without these, calendar connections cannot be saved.

---

## 🔧 STEP 1: Apply Migration 020 (REQUIRED)

### Option A: Manual SQL Editor (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `xjqjzievgepqpgtggcjx`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `MIGRATION_020_MINIMAL.sql`
6. Paste into the SQL editor
7. Click **Run**
8. Verify no errors appear

### Option B: Using psql (if you have direct database access)

```bash
psql postgresql://postgres:[password]@db.xjqjzievgepqpgtggcjx.supabase.co:5432/postgres < MIGRATION_020_MINIMAL.sql
```

### What This Migration Does

```sql
-- Creates tenants table
-- Creates tenant_members table
-- Adds tenant_id column to users table
-- Adds tenant_id column to meetings table
-- Adds tenant_id column to clients table
-- Creates necessary indexes
```

### Verify Migration Succeeded

After running the migration, run this in SQL Editor:

```sql
-- Check tenants table exists
SELECT COUNT(*) as tenants_count FROM tenants;

-- Check users.tenant_id column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'tenant_id';

-- Check calendar_connections has tenant_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'calendar_connections' AND column_name = 'tenant_id';
```

---

## 📋 STEP 2: Create Default Tenant for User

After migration succeeds, run this SQL to create a default tenant:

```sql
-- Create default tenant for the user
INSERT INTO tenants (name, owner_id, timezone, currency)
VALUES (
  'snaka1003@gmail.com''s Business',
  '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d',
  'UTC',
  'USD'
) RETURNING id;

-- Copy the returned ID and use it in the next query

-- Update user with tenant_id (replace UUID with the ID from above)
UPDATE users 
SET tenant_id = '[PASTE_TENANT_ID_HERE]'
WHERE id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';

-- Verify
SELECT id, email, tenant_id FROM users 
WHERE id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```

---

## 🧹 STEP 3: Clean Stale Data (Optional but Recommended)

After migration, you can clean up the 403 stale Calendly meetings:

```sql
-- Delete stale Calendly meetings
DELETE FROM meetings 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d' 
  AND meeting_source = 'calendly';

-- Verify deletion
SELECT COUNT(*) as remaining_meetings FROM meetings 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';
```

---

## ✅ STEP 4: Verify Backend Code is Ready

The backend code is already prepared to:
- ✅ Auto-create default tenant on Google OAuth login (if missing)
- ✅ Include `tenant_id` in all calendar_connections inserts
- ✅ Validate `tenant_id` exists before creating connections

No backend code changes needed!

---

## 🎯 STEP 5: Test Fresh Connection

After migration:

1. **Clear browser cache** (or use incognito window)
2. **Navigate to**: https://adviceapp.pages.dev
3. **Click "Sign in with Google"**
4. **Sign in as**: snaka1003@gmail.com
5. **Go to Calendar Settings**
6. **Click "Connect Calendly"**
7. **Complete Calendly OAuth**
8. **Verify**:
   - ✅ Connection shows as "Connected" (green checkmark)
   - ✅ No error messages
   - ✅ Meetings start syncing

---

## 📊 Files Ready for You

- **MIGRATION_020_MINIMAL.sql** - Minimal migration (only missing pieces)
- **MIGRATION_020_READY_TO_APPLY.sql** - Full migration (all tables)
- **ONBOARDING_IMPLEMENTATION_PLAN.md** - Complete implementation plan
- **CRITICAL_NEXT_STEPS.md** - This file

---

## ⏱️ Timeline

1. Apply migration: **5 minutes**
2. Create default tenant: **2 minutes**
3. Clean stale data: **2 minutes**
4. Test connection: **10 minutes**

**Total: ~20 minutes**

---

## 🆘 Troubleshooting

### Error: "relation 'tenants' does not exist"
- Migration didn't run successfully
- Check SQL Editor for error messages
- Try running MIGRATION_020_MINIMAL.sql again

### Error: "column 'tenant_id' does not exist"
- Migration partially applied
- Run the full MIGRATION_020_MINIMAL.sql again

### Calendar connection still not saving
- Verify user has `tenant_id` set
- Check backend logs for errors
- Verify `calendar_connections` insert includes `tenant_id`

---

## 🚀 Next Phase: Sync Progress Visibility

After migration is applied and connection works, we'll implement:
- Loading indicator during sync
- Real-time progress display (X/Y meetings synced)
- Estimated time remaining
- Success/error messages

This will complete the clean onboarding flow!

