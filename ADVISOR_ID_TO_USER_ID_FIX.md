# 🔧 Fixed: advisor_id → user_id Schema Mismatch

## 🔴 Problem

The Calendly sync was failing when trying to create clients with this error:

```
Could not find the 'advisor_id' column of 'clients' in the schema cache
```

**Root Cause**: Code was using `advisor_id` column name, but the actual database schema uses `user_id`.

---

## 📊 Schema Mismatch

| What Code Expected | What Database Has | Status |
|---|---|---|
| `advisor_id` | `user_id` | ❌ MISMATCH |

**Actual Database Schema** (from `DATABASE_COMPLETE_WIPE.sql`):
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- ✅ Column is 'user_id'
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    pipeline_stage TEXT DEFAULT 'prospect',
    priority_level INTEGER DEFAULT 3,
    ...
);
```

---

## ✅ All Fixes Applied

### **File 1**: `backend/src/services/clientExtraction.js`

**Lines 212, 222**: Changed `advisor_id` → `user_id`

```javascript
// Before:
.eq('advisor_id', userId)
const newClientData = {
  advisor_id: userId,

// After:
.eq('user_id', userId)
const newClientData = {
  user_id: userId,
```

---

### **File 2**: `backend/src/routes/clients.js`

**Line 204**: Query for existing client
```javascript
// Before: .eq('advisor_id', advisorId)
// After:  .eq('user_id', advisorId)
```

**Line 250**: Create new client
```javascript
// Before: advisor_id: advisorId,
// After:  user_id: advisorId,
```

**Line 327**: Find client by email
```javascript
// Before: .eq('advisor_id', advisorId)
// After:  .eq('user_id', advisorId)
```

**Line 1399**: Create client with full data
```javascript
// Before: advisor_id: advisorId,
// After:  user_id: advisorId,
```

---

### **File 3**: `backend/src/services/dataImport.js`

**Line 488**: Create client from meeting import
```javascript
// Before: advisor_id: userId,
// After:  user_id: userId,
```

---

## 🚀 Deployment Status

✅ **Commit**: `d622685`
✅ **Pushed to main**: GitHub
✅ **Render deploying**: Auto-triggered (2-3 minutes)

---

## 🧪 What to Test

After Render deployment completes:

1. **Connect Calendly** via OAuth
2. **Sync should complete** without "advisor_id" errors
3. **Check Meetings page** - should show 403 Calendly meetings
4. **Check Clients page** - should show extracted clients from meetings
5. **Check backend logs** - should see:
   ```
   ✅ Client extraction completed for Calendly meetings: { processed: 403, linked: X, clientsCreated: Y }
   ```

---

## 📋 Summary

All 5 instances of `advisor_id` have been replaced with `user_id` to match the actual database schema. This fixes the client creation failures during Calendly sync.

**Files Modified**:
- ✅ `backend/src/services/clientExtraction.js` (2 changes)
- ✅ `backend/src/routes/clients.js` (4 changes)
- ✅ `backend/src/services/dataImport.js` (1 change)

**Total Changes**: 7 instances of `advisor_id` → `user_id`

---

## 🔍 Verification

To verify the fix worked, check the database:

```sql
-- Should show clients with user_id (not advisor_id)
SELECT id, user_id, email, name, created_at 
FROM clients 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
LIMIT 10;
```

Expected result: Clients created with proper `user_id` values.

