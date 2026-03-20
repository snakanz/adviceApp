# Exact Code Changes Required

## Issue 1: Token Expiration - Frontend Changes

### Change 1: `src/pages/AuthCallback.js` (Line 47)

**REMOVE this line:**
```javascript
localStorage.setItem('jwt', session.access_token);
```

**Reason:** Supabase automatically manages token storage. We don't need to manually store it.

---

### Change 2: `src/pages/Meetings.js` (Line 425)

**REPLACE:**
```javascript
const token = localStorage.getItem('jwt');
console.log('🔑 Using JWT token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

if (!token) {
  console.error('❌ No JWT token found in localStorage');
  setShowSnackbar(true);
  setSnackbarMessage('Authentication required. Please log in again.');
  setSnackbarSeverity('error');
  return;
}
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
console.log('🔑 Using access token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

if (!token) {
  console.error('❌ No access token found in session');
  setShowSnackbar(true);
  setSnackbarMessage('Authentication required. Please log in again.');
  setSnackbarSeverity('error');
  return;
}
```

**Also add import at top:**
```javascript
import { supabase } from '../lib/supabase';
```

---

### Change 3: `src/pages/Meetings.js` (Line 1094)

**REPLACE:**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

### Change 4: `src/pages/Clients.js` (Line 125)

**REPLACE:**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

**Add import:**
```javascript
import { supabase } from '../lib/supabase';
```

---

### Change 5: `src/pages/ActionItems.js` (Lines 99, 163)

**REPLACE (both locations):**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

**Add import:**
```javascript
import { supabase } from '../lib/supabase';
```

---

### Change 6: `src/components/DataImport.js` (Lines 87, 125, 159)

**REPLACE (all 3 locations):**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

**Add import:**
```javascript
import { supabase } from '../../lib/supabase';
```

---

### Change 7: `src/components/DocumentsTab.js` (Line 53)

**REPLACE:**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

**Add import:**
```javascript
import { supabase } from '../../lib/supabase';
```

---

### Change 8: `src/components/ClientDocumentsSection.js` (Line 67)

**REPLACE:**
```javascript
const token = localStorage.getItem('jwt');
```

**WITH:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

**Add import:**
```javascript
import { supabase } from '../../lib/supabase';
```

---

## Issue 2: Calendar Switching - Backend Changes

### Change 9: `backend/src/routes/auth.js` (Lines 649-654)

**REPLACE:**
```javascript
if (!providerToken) {
  console.log('⚠️ No provider token found - user may not have signed in with Google');
  return res.json({
    success: false,
    message: 'No Google Calendar access - user did not sign in with Google OAuth'
  });
}
```

**WITH:**
```javascript
if (!providerToken) {
  console.log('⚠️ No provider token found in app_metadata');
  console.log('ℹ️ This may occur when switching calendars or if user did not sign in with Google');
  
  return res.json({
    success: false,
    message: 'Cannot auto-connect Google Calendar. Please use the manual connection flow in Settings.',
    reason: 'provider_token_not_available'
  });
}
```

---

### Change 10: `backend/src/routes/auth.js` (After line 709, before line 711)

**ADD this code block:**
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

    // Create new calendar connection
```

---

## Summary

**Total Changes:** 10
- **Frontend:** 8 changes (7 files)
- **Backend:** 2 changes (1 file)

**Estimated Time:** 30-45 minutes
**Testing Time:** 30 minutes
**Total:** ~1 hour

**Deployment:**
1. Deploy frontend changes first
2. Wait 5 minutes for Cloudflare Pages to update
3. Deploy backend changes
4. Wait 5 minutes for Render to update
5. Test both fixes

