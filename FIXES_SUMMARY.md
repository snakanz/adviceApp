# Two Critical Issues - Executive Summary

## Issue 1: Meetings Disappear After ~1 Hour ⚠️ CRITICAL

### What Happens
- User leaves Meetings page open
- After ~1 hour, meetings disappear
- Error: "Authentication required. Please log in again."
- Logging out and back in fixes it temporarily

### Why It Happens
**Token Storage Mismatch:**
- Supabase stores token as `'supabase.auth.token'`
- Frontend stores token as `'jwt'` (old key)
- AuthContext refreshes `'supabase.auth.token'` automatically
- But Meetings.js reads from `'jwt'` (old, expired token)
- After expiration, Meetings.js gets `null` → meetings disappear

### The Fix
Replace all `localStorage.getItem('jwt')` with Supabase session retrieval:
```javascript
// Get current token from Supabase (always fresh)
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Files to Change (7)
1. `src/pages/AuthCallback.js` - Remove JWT storage
2. `src/pages/Meetings.js` - 2 locations
3. `src/pages/Clients.js` - 1 location
4. `src/pages/ActionItems.js` - 2 locations
5. `src/components/DataImport.js` - 3 locations
6. `src/components/DocumentsTab.js` - 1 location
7. `src/components/ClientDocumentsSection.js` - 1 location

### Impact
- ✅ Users can leave app open indefinitely
- ✅ Token refreshes automatically
- ✅ No more "Authentication required" errors
- ✅ Seamless user experience

---

## Issue 2: Can't Switch from Calendly to Google ⚠️ CRITICAL

### What Happens
- User connects Calendly calendar
- User tries to connect Google calendar
- Connection fails with: "No provider token found"
- User cannot switch calendars

### Why It Happens
**Two Problems:**

1. **Missing Provider Token:**
   - Endpoint looks for Google tokens in `app_metadata.provider_token`
   - These tokens may not be accessible when switching calendars
   - Endpoint fails without proper fallback

2. **Missing Deactivation Logic:**
   - Endpoint doesn't deactivate Calendly before creating Google connection
   - Violates "only one active calendar" constraint
   - Database ends up with multiple active connections

### The Fix
Update `/api/auth/auto-connect-calendar` endpoint:

1. **Add deactivation before creating new connection:**
```javascript
// Deactivate all other active connections
await req.supabase
  .from('calendar_connections')
  .update({ is_active: false })
  .eq('user_id', userId)
  .eq('is_active', true);
```

2. **Improve error handling for missing tokens:**
```javascript
if (!providerToken) {
  return res.json({
    success: false,
    message: 'Cannot auto-connect. Use manual connection in Settings.',
    reason: 'provider_token_not_available'
  });
}
```

### File to Change (1)
- `backend/src/routes/auth.js` - `/api/auth/auto-connect-calendar` endpoint

### Impact
- ✅ Users can switch between calendars
- ✅ Only one calendar active at a time
- ✅ Proper error messages for debugging
- ✅ Consistent with Calendly connection logic

---

## Implementation Plan

### Phase 1: Frontend Fix (Issue 1)
- **Files:** 7 frontend files
- **Changes:** Replace token retrieval pattern
- **Testing:** Leave app open for 2+ hours
- **Risk:** Low - no backend changes
- **Deployment:** Can deploy independently

### Phase 2: Backend Fix (Issue 2)
- **Files:** 1 backend file
- **Changes:** Add deactivation + error handling
- **Testing:** Connect Calendly, then Google
- **Risk:** Low - follows existing patterns
- **Deployment:** Requires backend redeployment

---

## Quick Reference

### Token Retrieval Pattern
```javascript
// ❌ OLD (breaks after refresh)
const token = localStorage.getItem('jwt');

// ✅ NEW (always current)
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Calendar Deactivation Pattern
```javascript
// Deactivate all other active connections
await req.supabase
  .from('calendar_connections')
  .update({ is_active: false })
  .eq('user_id', userId)
  .eq('is_active', true);
```

---

## Verification

### After Fix 1:
```
✅ Meetings page stays open indefinitely
✅ No "Authentication required" errors
✅ Token refreshes silently
```

### After Fix 2:
```
✅ Can connect Google after Calendly
✅ Only one calendar is active
✅ Switching calendars works smoothly
```

---

## Documentation Files

1. **ISSUES_AND_FIXES_ANALYSIS.md** - Detailed root cause analysis
2. **DETAILED_FIX_GUIDE.md** - Line-by-line fix instructions
3. **FIXES_SUMMARY.md** - This file (executive summary)

---

**Status:** Ready for implementation
**Complexity:** Low-Medium
**Estimated Time:** 1-2 hours
**Risk Level:** Low

