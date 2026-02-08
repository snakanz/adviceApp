# Microsoft Admin Consent Testing Guide

This document explains how to test the Microsoft/Outlook enterprise admin consent flow using a Microsoft 365 Developer sandbox.

## Overview

When users from enterprise organizations try to connect their Microsoft Calendar, they may encounter AADSTS errors that require IT administrator approval. Our app now detects these errors and provides:

1. A friendly error message explaining the situation
2. An admin consent URL to share with IT
3. An email template to send to IT
4. A "Try Again" button for after approval

## Test Environment Setup

### Option 1: Microsoft 365 Developer Program (FREE)

This is the recommended approach for testing.

#### Step 1: Join the Developer Program

1. Go to https://developer.microsoft.com/microsoft-365/dev-program
2. Click "Join now" and sign in with any Microsoft account
3. Fill out the profile:
   - Use "Personal projects" or "I'm building solutions for my company"
4. You'll get a free Microsoft 365 E5 sandbox subscription (renewable every 90 days)
5. Note your sandbox domain (e.g., `yoursandbox.onmicrosoft.com`)

#### Step 2: Configure Restricted Tenant

1. Sign into https://portal.azure.com with your sandbox **admin** account
2. Navigate to: **Azure Active Directory** → **Enterprise applications** → **User settings**
3. Find the setting: "Users can consent to apps accessing company data on their behalf"
4. Set it to **No**
5. Click **Save**

This forces admin consent for ALL third-party apps in your sandbox.

#### Step 3: Create Test User

1. In Azure AD, go to **Users** → **New user**
2. Create a test user (e.g., `testuser@yoursandbox.onmicrosoft.com`)
3. Set a password
4. Assign a Microsoft 365 license to this user

#### Step 4: Test the Flow

1. In Advicly, click "Connect Microsoft Calendar"
2. Sign in as the **test user** (NOT the admin)
3. You should see the AADSTS65001 error
4. Our app should now show the "IT Approval Required" screen
5. Copy the admin consent URL
6. Sign in as the **admin** and open the admin consent URL
7. Approve the app for the organization
8. Back in Advicly, click "Try Again" - connection should now succeed

### Option 2: Use Your Organization's Tenant

If you have access to a restricted Microsoft 365 tenant at your company:

1. Try connecting with your normal work account
2. If your organization blocks user consent, you'll see the AADSTS error
3. Work with your IT team to test the approval flow

## AADSTS Error Codes

The following error codes are handled:

| Code | Type | Description |
|------|------|-------------|
| AADSTS65001 | `admin_consent_required` | Admin approval needed before users can connect |
| AADSTS700016 | `app_not_found_in_tenant` | App not registered in the organization |
| AADSTS50105 | `user_not_assigned` | User not granted access to the app |
| AADSTS90094 | `admin_consent_required` | Admin consent needed for specific permissions |
| AADSTS650052 | `app_needs_permissions` | App needs permissions only admin can grant |

## Testing Checklist

- [ ] AADSTS65001 error shows "IT Approval Required" modal in AuthCallback
- [ ] Admin consent URL is correct and clickable
- [ ] "Copy Link" button works
- [ ] "Copy Email" button works
- [ ] "Try Again" button attempts new OAuth flow
- [ ] "Skip for now" redirects to onboarding/settings appropriately
- [ ] CalendarSettings shows "IT Approval Pending" badge for pending connections
- [ ] After IT approval, "Try Again" successfully connects the calendar
- [ ] Pending status persists across page reloads

## Files Modified

### Backend
- `backend/src/routes/auth.js` - AADSTS error detection and admin consent URL generation
- `backend/src/routes/calendar-settings.js` - Check consent status endpoint
- `backend/migrations/035_add_microsoft_admin_consent_tracking.sql` - Database columns

### Frontend
- `src/pages/AuthCallback.js` - Enterprise error UI
- `src/components/CalendarSettings.js` - Pending status display

## API Endpoints

### GET /api/auth/microsoft/admin-consent-url

Returns the admin consent URL and email template.

**Response:**
```json
{
  "success": true,
  "admin_consent_url": "https://login.microsoftonline.com/common/adminconsent?...",
  "email_template": {
    "subject": "Please approve Advicly for Microsoft 365",
    "body": "Hi IT Team,\n\n..."
  },
  "instructions": [...]
}
```

### POST /api/calendar-connections/microsoft/check-status

Checks if admin consent has been granted.

**Response:**
```json
{
  "status": "pending_admin_approval" | "approved" | "blocked" | "unknown",
  "message": "...",
  "can_connect": true | false
}
```

## Database Schema

```sql
ALTER TABLE calendar_connections
ADD COLUMN pending_admin_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN admin_consent_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN admin_consent_error TEXT,
ADD COLUMN admin_consent_error_type TEXT,
ADD COLUMN microsoft_tenant_id TEXT;
```

## Troubleshooting

### "Admin consent URL not showing"

- Check browser console for API errors
- Verify the `/api/auth/microsoft/admin-consent-url` endpoint is returning data
- Check that MICROSOFT_CLIENT_ID is set in environment variables

### "Try Again still fails after IT approval"

- IT admin may have approved with different permissions than required
- Check Azure AD audit logs for the approval event
- Ensure the app's required permissions match what was approved

### "Connection succeeds but then fails"

- Token may have expired - this is normal for first connection
- Try disconnecting and reconnecting
- Check that refresh token is being stored properly
