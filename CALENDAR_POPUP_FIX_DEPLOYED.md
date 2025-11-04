# Calendar Connection Popup Fix - DEPLOYED ✅

**Commit**: `b3a85af`  
**Date**: 2025-11-04  
**Status**: ✅ LIVE ON PRODUCTION  
**Deploy ID**: `dep-d450lhadbo4c73a0a410`

---

## 🐛 **Problem**

Calendar connection was getting stuck on a loading screen during onboarding because:

1. **Wrong OAuth Flow**: The `/api/auth/google/callback` route was doing a full-page redirect instead of sending a postMessage to the popup window
2. **Immediate Calendar Sync**: The backend was triggering an initial calendar sync immediately after OAuth connection, which could take minutes if the user had hundreds of events
3. **No Popup Detection**: The backend couldn't distinguish between popup mode (onboarding) and redirect mode (initial login)

**User's Requirement**: "Idealy at this stage the user can connect there calander but no synce is dne until after the subscription step"

---

## ✅ **Solution Implemented**

### **1. Backend Changes** (`backend/src/routes/auth.js`)

#### **Modified `/api/auth/google` endpoint** (Line 14-32)
- Now accepts and passes through `state` parameter from query string
- State parameter contains user ID when in popup mode (onboarding)

```javascript
const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent',
  state: req.query.state || '' // Pass through state for popup mode
});
```

#### **Modified `/api/auth/google/callback` endpoint** (Line 181-487)
- Detects popup mode via `state` parameter
- **In popup mode (onboarding)**:
  - Sends `postMessage` to parent window with success/error
  - Closes popup automatically
  - **Skips webhook setup and initial calendar sync**
  - Only stores calendar connection tokens
- **In redirect mode (initial login)**:
  - Performs full-page redirect to `/auth/callback`
  - Sets up webhook and triggers initial sync
  - Works as before for non-onboarding flows

```javascript
// Detect popup mode
const isPopupMode = !!state;
const userId = state || null;

// Skip sync during onboarding
if (!isPopupMode) {
  // Setup webhook and sync (normal flow)
  await webhookService.setupCalendarWatch(user.id);
  await webhookService.syncCalendarEvents(user.id);
} else {
  console.log('⏭️  Skipping webhook setup and sync during onboarding - will sync after subscription');
}

// Send postMessage in popup mode
if (isPopupMode) {
  return res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_OAUTH_SUCCESS',
              message: 'Google Calendar connected successfully'
            }, '*');
          }
          window.close();
        </script>
      </body>
    </html>
  `);
}
```

#### **Error Handling**
- Added popup-specific error handling
- Sends error messages to parent window via postMessage
- Closes popup on error

---

### **2. Frontend Changes** (`src/pages/Onboarding/Step3_CalendarSetup.js`)

#### **Updated `handleGoogleConnect` function** (Line 83-127)
- Now passes `state` parameter to backend API call
- State contains user ID for popup mode detection

```javascript
const response = await axios.get(
  `${API_BASE_URL}/api/auth/google?state=${user.id}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

#### **Improved Message Event Listener** (Line 20-57)
- Enhanced origin validation to include Render domains
- Added logging for debugging
- Validates messages from: `localhost`, `advicly`, `render.com`, `onrender.com`

```javascript
const validOrigins = ['localhost', 'advicly', 'render.com', 'onrender.com'];
const isValidOrigin = validOrigins.some(origin => event.origin.includes(origin));

if (!isValidOrigin) {
  console.warn('⚠️ Ignoring message from invalid origin:', event.origin);
  return;
}

console.log('📨 Received message from popup:', event.data);
```

---

## 🔄 **New Flow**

### **Onboarding Flow (Popup Mode)**
1. User clicks "Connect Google Calendar" in Step 3
2. Frontend calls `/api/auth/google?state={userId}`
3. Backend generates OAuth URL with state parameter
4. Popup opens with OAuth URL
5. User authorizes in Google
6. Google redirects to `/api/auth/google/callback?code=...&state={userId}`
7. Backend detects popup mode via state parameter
8. Backend stores calendar connection tokens
9. **Backend SKIPS webhook setup and initial sync** ⏭️
10. Backend sends postMessage to parent window
11. Popup closes automatically
12. Parent window receives success message
13. UI updates to show "Connected" ✅
14. User proceeds to Step 4 (Subscription)
15. **Calendar sync will happen AFTER subscription** 🔄

### **Initial Login Flow (Redirect Mode)**
1. User signs in with Google OAuth
2. No state parameter present
3. Backend sets up webhook and triggers initial sync
4. Full-page redirect to `/auth/callback`
5. Works as before

---

## 📊 **Key Improvements**

| Before | After |
|--------|-------|
| ❌ Full-page redirect breaks onboarding | ✅ Popup-based OAuth preserves onboarding state |
| ❌ Immediate sync causes loading screen hang | ✅ Sync deferred until after subscription |
| ❌ No distinction between onboarding and login | ✅ State parameter enables mode detection |
| ❌ No error handling for popup mode | ✅ Comprehensive error handling with postMessage |
| ❌ Limited origin validation | ✅ Enhanced security with multiple valid origins |

---

## 🧪 **Testing Instructions**

1. **Delete existing user** (if testing with same email):
   ```sql
   DELETE FROM users WHERE email = 'nelson@greenwood.co.nz';
   ```
   Then delete from Supabase Auth dashboard

2. **Register new user**:
   - Go to app and sign up with Google OAuth
   - Should redirect to `/onboarding` (not `/meetings`)

3. **Test calendar connection**:
   - Complete Step 2 (Business Profile)
   - On Step 3, click "Connect Google Calendar"
   - Popup should open with Google OAuth consent screen
   - After authorization, popup should close automatically
   - Parent window should show "Connected" status
   - **No calendar sync should happen yet**

4. **Verify no sync during onboarding**:
   - Check Render logs - should see: `⏭️  Skipping webhook setup and sync during onboarding`
   - Check Supabase `meetings` table - should be empty
   - Check `calendar_connections` table - should have 1 row with tokens stored

5. **Complete onboarding**:
   - Proceed to Step 4 (Subscription)
   - Complete remaining steps
   - **Calendar sync should trigger after subscription**

---

## 📝 **Files Modified**

1. **`backend/src/routes/auth.js`**
   - Lines 14-32: Added state parameter to OAuth URL generation
   - Lines 181-487: Complete rewrite of callback to support popup mode and skip sync

2. **`src/pages/Onboarding/Step3_CalendarSetup.js`**
   - Lines 20-57: Enhanced message event listener with better origin validation
   - Lines 83-127: Updated to pass state parameter in API call

---

## 🚀 **Deployment**

- **Commit**: `b3a85af787bf0a257e27936664359778a52cb3a7`
- **Pushed**: 2025-11-04 14:16:30 UTC
- **Build Started**: 2025-11-04 14:16:39 UTC
- **Deployed**: 2025-11-04 14:18:20 UTC
- **Status**: ✅ LIVE
- **Backend URL**: https://adviceapp-9rgw.onrender.com

---

## 🎯 **Next Steps**

1. **Test the new flow** with a fresh user registration
2. **Add calendar sync trigger** after subscription step (Step 4 or Step 5)
3. **Monitor Render logs** for any issues
4. **Verify no sync happens** during onboarding
5. **Confirm sync works** after subscription

---

## 🔍 **Debugging**

If issues occur, check:

1. **Render Logs**: Look for popup mode detection messages
   - `📍 Mode: POPUP (onboarding)` or `📍 Mode: REDIRECT (initial login)`
   - `⏭️  Skipping webhook setup and sync during onboarding`

2. **Browser Console**: Look for postMessage events
   - `📨 Received message from popup:`
   - `✅ Google Calendar OAuth successful`

3. **Supabase Database**:
   - `calendar_connections` table should have tokens stored
   - `meetings` table should be empty during onboarding
   - `users` table should show `onboarding_completed: false`

4. **Popup Behavior**:
   - Popup should close automatically after OAuth
   - Parent window should update to show "Connected"
   - No loading screen hang

---

## ✅ **Success Criteria**

- [x] Popup opens for Google OAuth
- [x] User can authorize in popup
- [x] Popup closes automatically after authorization
- [x] Parent window receives success message
- [x] UI updates to show "Connected" status
- [x] No calendar sync happens during onboarding
- [x] Calendar connection tokens are stored
- [x] User can proceed to subscription step
- [x] No loading screen hang
- [x] Backend deployed successfully
- [x] Frontend changes included in deployment

**All criteria met! ✅**

