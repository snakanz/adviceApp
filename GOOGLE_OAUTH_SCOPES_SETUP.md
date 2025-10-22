# Google OAuth Scopes Setup for Calendar Access

## 🎯 Objective

Configure Supabase Google OAuth to request **both authentication AND calendar access** in a single OAuth flow, eliminating the need for a separate calendar connection step during onboarding.

---

## 📋 Current Problem

- Supabase Google OAuth only requests basic authentication scopes (email, profile)
- Calendar access requires additional scopes: `https://www.googleapis.com/auth/calendar.readonly`
- Users are stuck in redirect loop when trying to connect calendar separately

---

## ✅ Solution

Update the Google OAuth configuration in Supabase to include calendar scopes during the initial sign-in flow.

---

## 🔧 Step-by-Step Instructions

### **Step 1: Access Supabase Dashboard**

1. Go to: https://supabase.com/dashboard
2. Select your project: **xjqjzievgepqpgtggcjx** (Advicly)
3. Navigate to: **Authentication** → **Providers**
4. Find and click on: **Google**

---

### **Step 2: Update Google OAuth Scopes**

In the Google provider settings, you'll see a field called **"Scopes"** or **"Additional Scopes"**.

**Current scopes (default):**
```
openid email profile
```

**Update to include calendar access:**
```
openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events
```

**Explanation of scopes:**
- `openid` - Required for OAuth 2.0 authentication
- `email` - Access to user's email address
- `profile` - Access to user's basic profile info (name, picture)
- `https://www.googleapis.com/auth/calendar.readonly` - Read-only access to Google Calendar
- `https://www.googleapis.com/auth/calendar.events` - Read/write access to calendar events (for creating meetings)

---

### **Step 3: Verify Google Cloud Console Settings**

The Google OAuth client must also be configured to allow these scopes.

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID (the one used for Supabase)
3. Click **Edit**
4. Under **"Scopes for Google APIs"**, ensure the following are enabled:
   - Google Calendar API
   - Google People API (for profile info)

5. If not enabled, go to: https://console.cloud.google.com/apis/library
6. Search for **"Google Calendar API"**
7. Click **Enable**

---

### **Step 4: Update Supabase Configuration**

Back in the Supabase Dashboard:

1. **Save** the updated scopes
2. **Copy** the Redirect URL shown in the Google provider settings
3. Verify it matches the one in your Google Cloud Console OAuth client:
   ```
   https://xjqjzievgepqpgtggcjx.supabase.co/auth/v1/callback
   ```

---

### **Step 5: Test the OAuth Flow**

1. **Sign out** of Advicly (if currently signed in)
2. **Clear browser cache** and cookies for `adviceapp.pages.dev`
3. **Sign in again** with Google
4. You should now see a Google consent screen that includes:
   - ✅ View your email address
   - ✅ View your basic profile info
   - ✅ **See, edit, share, and permanently delete all the calendars you can access using Google Calendar** ← NEW!

5. After granting permissions, the calendar should be auto-connected

---

## 🔍 Verification

After updating the scopes and signing in, check the following:

### **Frontend Console Logs:**
```
✅ Session established: your-email@gmail.com
✅ JWT token stored in localStorage
✅ Profile loaded successfully
✅ Google Calendar auto-connected: Calendar connection created
```

### **Backend Logs (Render):**
```
📅 Auto-connecting Google Calendar for user: your-email@gmail.com
✅ Found Google provider token in Supabase Auth session
✅ Google Calendar auto-connected successfully: <connection-id>
```

### **Database Check:**
Query the `calendar_connections` table in Supabase:
```sql
SELECT * FROM calendar_connections WHERE user_id = '<your-user-id>';
```

You should see a row with:
- `provider` = 'google'
- `provider_account_email` = your email
- `is_active` = true
- `sync_enabled` = true
- `access_token` = (encrypted token)

---

## 🚨 Important Notes

### **Token Storage**

Supabase stores the Google OAuth tokens in the user's session metadata:
- `app_metadata.provider_token` - Google access token
- `app_metadata.provider_refresh_token` - Google refresh token

Our backend extracts these tokens and stores them in the `calendar_connections` table for calendar sync operations.

### **Token Refresh**

Supabase automatically refreshes the Google OAuth tokens when they expire. However, we need to ensure our `calendar_connections` table is updated with the new tokens.

**TODO:** Implement a token refresh mechanism that updates `calendar_connections` when Supabase refreshes the provider tokens.

### **Existing Users**

Users who signed in **before** the scope update will need to:
1. Sign out
2. Sign in again
3. Re-authorize with the new calendar scopes

Alternatively, they can revoke access and re-authorize:
- Go to: https://myaccount.google.com/permissions
- Find "Advicly" in the list
- Click **Remove Access**
- Sign in to Advicly again

---

## 🐛 Troubleshooting

### **Issue: "Calendar not connected" message after sign-in**

**Possible causes:**
1. Google OAuth scopes not updated in Supabase
2. Google Calendar API not enabled in Google Cloud Console
3. User denied calendar permissions during OAuth consent

**Solution:**
- Verify scopes in Supabase Dashboard
- Enable Google Calendar API in Google Cloud Console
- Sign out and sign in again to re-trigger OAuth consent

---

### **Issue: "No provider token found" error**

**Possible causes:**
1. User signed in with email/password instead of Google OAuth
2. Supabase not storing provider tokens

**Solution:**
- Ensure user signs in with "Continue with Google" button
- Check Supabase Auth settings to ensure provider tokens are stored

---

### **Issue: "User must complete business profile setup first" error**

**Possible causes:**
1. User hasn't completed Step 2 (Business Profile) in onboarding
2. `tenant_id` is null in users table

**Solution:**
- Complete the Business Profile step first
- The auto-connect endpoint requires a `tenant_id` to create the calendar connection

---

## 📚 Additional Resources

- [Supabase Auth Providers Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)

---

## ✅ Success Criteria

After completing this setup, users should be able to:

1. ✅ Sign in with Google OAuth (single click)
2. ✅ Grant both authentication AND calendar permissions in one consent screen
3. ✅ Have their Google Calendar automatically connected after sign-in
4. ✅ Proceed through onboarding without any calendar connection steps
5. ✅ See their meetings synced from Google Calendar

---

**Status:** ⏳ **PENDING** - Requires manual configuration in Supabase Dashboard
**Priority:** 🔴 **CRITICAL** - Required for onboarding flow to work correctly
**Estimated Time:** 5-10 minutes

---

**Next Steps:**
1. Update Google OAuth scopes in Supabase Dashboard
2. Enable Google Calendar API in Google Cloud Console
3. Test sign-in flow with new scopes
4. Verify calendar auto-connection works
5. Create Settings page for post-onboarding calendar management

