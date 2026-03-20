# Detailed Fix Guide - Two Critical Issues

## Fix 1: Token Expiration Issue

### Pattern to Replace Everywhere

**OLD (Breaks after token refresh):**
```javascript
const token = localStorage.getItem('jwt');
if (!token) {
  // Handle error
}
```

**NEW (Always gets current token):**
```javascript
import { supabase } from '../lib/supabase';

const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

if (!token) {
  // Handle error
}
```

### Files to Update (7 total)

#### 1. `src/pages/AuthCallback.js` (Line 47)
**Current:**
```javascript
localStorage.setItem('jwt', session.access_token);
```

**Change to:**
```javascript
// Remove this line - Supabase handles token storage automatically
// localStorage.setItem('jwt', session.access_token);
```

#### 2. `src/pages/Meetings.js` (Lines 425, 1094)
**Current (Line 425):**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

#### 3. `src/pages/Clients.js` (Line 125)
**Current:**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

#### 4. `src/pages/ActionItems.js` (Lines 99, 163)
**Current:**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

#### 5. `src/components/DataImport.js` (Lines 87, 125, 159)
**Current:**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

#### 6. `src/components/DocumentsTab.js` (Line 53)
**Current:**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

#### 7. `src/components/ClientDocumentsSection.js` (Line 67)
**Current:**
```javascript
const token = localStorage.getItem('jwt');
```

**Change to:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## Fix 2: Calendar Switching Issue

### File: `backend/src/routes/auth.js`

#### Location: `/api/auth/auto-connect-calendar` endpoint (Lines 617-748)

**Current Problem:**
1. Tries to extract Google tokens from `app_metadata.provider_token`
2. Doesn't deactivate existing Calendly connection
3. Fails when switching calendars

**Required Changes:**

1. **Add deactivation logic before creating connection (after line 709):**
```javascript
// Deactivate all other active connections (single active per user)
console.log('🔄 Deactivating other active calendar connections...');
const { error: deactivateError } = await req.supabase
  .from('calendar_connections')
  .update({
    is_active: false,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('is_active', true);

if (deactivateError) {
  console.warn('Warning: Could not deactivate other connections:', deactivateError);
} else {
  console.log('✅ Other connections deactivated');
}
```

2. **Improve error handling for missing provider tokens (lines 649-654):**
```javascript
if (!providerToken) {
  console.log('⚠️ No provider token found in app_metadata');
  console.log('ℹ️ This may occur when switching calendars or if user did not sign in with Google');
  
  // Return a more helpful error message
  return res.json({
    success: false,
    message: 'Cannot auto-connect Google Calendar. Please use the manual connection flow in Settings.',
    reason: 'provider_token_not_available'
  });
}
```

---

## Testing Checklist

### After Fix 1 (Token Expiration):
- [ ] Leave Meetings page open for 2+ hours
- [ ] Meetings should still display
- [ ] No "Authentication required" message
- [ ] Token refresh happens silently in background

### After Fix 2 (Calendar Switching):
- [ ] Connect Calendly calendar
- [ ] Try to connect Google calendar
- [ ] Should succeed and deactivate Calendly
- [ ] Check backend logs for deactivation message
- [ ] Verify only Google calendar is active in database

---

## Deployment Order

1. **Deploy Fix 1 first** (Frontend token changes)
   - Fixes immediate user experience issue
   - No backend changes needed
   - Can be deployed independently

2. **Deploy Fix 2 second** (Backend calendar switching)
   - Fixes calendar switching workflow
   - Requires backend redeployment
   - Depends on Fix 1 being deployed

---

## Verification

After both fixes deployed:
```sql
-- Check calendar connections
SELECT user_id, provider, is_active, created_at 
FROM calendar_connections 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
ORDER BY created_at DESC;

-- Should show:
-- - Only ONE is_active = true
-- - Most recent connection is active
-- - Previous connection is_active = false
```

