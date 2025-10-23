# Calendly Integration Issues - Root Cause Analysis

## 🔴 Critical Issues Found

### **Issue #1: No Initial Sync After OAuth Connection**

**Location**: `backend/src/routes/calendar.js` lines 1700-1816 (Calendly OAuth callback)

**Problem**: 
The OAuth callback stores the connection but **does NOT trigger an initial sync** to fetch existing Calendly meetings.

**Current Flow**:
```
1. User authorizes OAuth
2. Backend stores tokens in calendar_connections
3. Backend deactivates other connections
4. Backend redirects to Settings page
5. ❌ NO SYNC HAPPENS - Meetings table remains empty
```

**Expected Flow**:
```
1. User authorizes OAuth
2. Backend stores tokens in calendar_connections
3. Backend deactivates other connections
4. ✅ Backend triggers initial sync to fetch all meetings
5. Backend redirects to Settings page
```

**Why Meetings Don't Show**:
- Calendly meetings are never fetched from the Calendly API
- The `meetings` table stays empty
- Meetings page shows nothing

---

### **Issue #2: Calendar Connection Status Not Updating in Frontend**

**Location**: `src/components/CalendarSettings.js` lines 39-64

**Problem**:
The component loads connections on mount but **doesn't refresh after OAuth callback**. When you're redirected back from Calendly OAuth, the component still shows the old connection status.

**Current Flow**:
```
1. User clicks "Connect Calendly"
2. Redirected to Calendly OAuth
3. Authorized and redirected back to /settings/calendar?success=CalendlyConnected
4. ❌ Component doesn't reload connections
5. Still shows "Google Calendar" as active
```

**Why Status Doesn't Update**:
- `loadConnections()` only runs on component mount (useEffect with empty deps)
- When redirected back with `?success=CalendlyConnected`, component doesn't reload
- Need to check URL params and reload connections

---

### **Issue #3: Deactivation Logic May Have Race Condition**

**Location**: `backend/src/routes/calendar.js` lines 1768-1772

**Problem**:
```javascript
// Deactivate other active calendar connections for this user
await getSupabase()
  .from('calendar_connections')
  .update({ is_active: false })
  .eq('user_id', user.id);
```

This deactivates ALL connections, then creates/updates Calendly. If there's a timing issue, Calendly might also be deactivated.

---

## ✅ Solutions Required

### **Fix #1: Add Initial Sync After OAuth**

In `backend/src/routes/calendar.js` after line 1808, add:

```javascript
// Trigger initial sync to fetch existing Calendly meetings
try {
  console.log('🔄 Triggering initial Calendly sync...');
  const CalendlyService = require('../services/calendlyService');
  const calendlyService = new CalendlyService();
  const syncResult = await calendlyService.syncMeetingsToDatabase(user.id);
  console.log('✅ Initial Calendly sync completed:', syncResult);
} catch (syncError) {
  console.warn('⚠️  Initial sync failed (non-fatal):', syncError.message);
  // Don't fail the connection if sync fails
}
```

### **Fix #2: Reload Connections After OAuth Redirect**

In `src/components/CalendarSettings.js`, update useEffect:

```javascript
useEffect(() => {
  loadConnections();
  
  // Check if redirected from OAuth callback
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'CalendlyConnected') {
    setSuccess('Calendly connected successfully!');
    // Reload connections to show updated status
    setTimeout(() => loadConnections(), 500);
  }
}, []);
```

### **Fix #3: Fix Deactivation Logic**

In `backend/src/routes/calendar.js` lines 1768-1808, reorder:

```javascript
// 1. First deactivate other connections
await getSupabase()
  .from('calendar_connections')
  .update({ is_active: false })
  .eq('user_id', user.id)
  .neq('provider', 'calendly'); // Don't deactivate Calendly!

// 2. Then create/update Calendly connection with is_active: true
```

---

## 📋 Testing Checklist

After fixes:

- [ ] Connect Calendly via OAuth
- [ ] Check database: `calendar_connections` shows Calendly as `is_active: true`
- [ ] Check database: Google Calendar shows `is_active: false`
- [ ] Check database: `meetings` table has Calendly meetings
- [ ] Refresh Meetings page - should show Calendly meetings
- [ ] Settings page shows "Calendly" as active connection
- [ ] Create new meeting in Calendly - should sync via webhook within 5 seconds

---

## 🔍 How to Verify Issues

### Check Database State

```sql
-- Check calendar connections
SELECT user_id, provider, is_active, created_at 
FROM calendar_connections 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
ORDER BY created_at DESC;

-- Check meetings
SELECT COUNT(*), meeting_source 
FROM meetings 
WHERE user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
GROUP BY meeting_source;
```

### Check Backend Logs

Look for:
- ✅ "Calendly OAuth successful for user"
- ✅ "Created new Calendly connection" or "Updated Calendly connection"
- ❌ "Triggering initial Calendly sync" (should be there but isn't)
- ❌ "Initial Calendly sync completed" (should be there but isn't)

---

## 🚀 Implementation Priority

1. **HIGH**: Add initial sync after OAuth (Fix #1)
2. **HIGH**: Fix deactivation logic (Fix #3)
3. **MEDIUM**: Reload connections in frontend (Fix #2)

All three fixes are needed for full functionality.

