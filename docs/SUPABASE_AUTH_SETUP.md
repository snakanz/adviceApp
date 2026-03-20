# Supabase Auth Configuration Guide

## Overview

This guide walks you through configuring Supabase Auth for the Advicly platform, including Google OAuth, Microsoft OAuth, and Email/Password authentication.

## Prerequisites

- Supabase project created
- Access to Supabase dashboard
- Google Cloud Console access (for Google OAuth)
- Azure Portal access (for Microsoft OAuth)

## Step 1: Enable Authentication Providers

### 1.1 Access Supabase Auth Settings

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**

### 1.2 Enable Email/Password Authentication

1. Find **Email** in the providers list
2. Toggle **Enable Email provider** to ON
3. Configure email settings:
   - **Enable email confirmations**: ON (recommended)
   - **Secure email change**: ON (recommended)
   - **Double confirm email changes**: ON (recommended)
4. Click **Save**

### 1.3 Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Welcome email with confirmation link
   - **Magic Link**: Passwordless login email
   - **Change Email Address**: Email change confirmation
   - **Reset Password**: Password reset email

Example template for "Confirm signup":
```html
<h2>Welcome to Advicly!</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

## Step 2: Configure Google OAuth

### 2.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: Advicly Production
   - **Authorized JavaScript origins**:
     - `https://your-project.supabase.co`
     - `https://adviceapp.pages.dev` (your frontend URL)
   - **Authorized redirect URIs**:
     - `https://your-project.supabase.co/auth/v1/callback`
7. Click **Create**
8. Copy **Client ID** and **Client Secret**

### 2.2 Enable Google OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to expand
3. Toggle **Enable Sign in with Google** to ON
4. Enter your Google OAuth credentials:
   - **Client ID**: Paste from Google Cloud Console
   - **Client Secret**: Paste from Google Cloud Console
5. Configure scopes (optional):
   - Default scopes are sufficient for authentication
   - DO NOT add calendar scopes here (we'll do that separately)
6. Click **Save**

### 2.3 Test Google OAuth

1. Go to **Authentication** → **Users**
2. Click **Invite user** → **Sign in with Google**
3. Complete the OAuth flow
4. Verify user appears in the users list

## Step 3: Configure Microsoft OAuth

### 3.1 Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Advicly
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: 
     - Platform: Web
     - URI: `https://your-project.supabase.co/auth/v1/callback`
5. Click **Register**

### 3.2 Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add description: "Advicly Production"
4. Set expiration: 24 months (recommended)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again)

### 3.3 Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click **Add permissions**
7. Click **Grant admin consent** (if you have admin rights)

### 3.4 Get Application (Client) ID

1. Go to **Overview** in your app registration
2. Copy **Application (client) ID**
3. Copy **Directory (tenant) ID**

### 3.5 Enable Microsoft OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Azure (Microsoft)** and click to expand
3. Toggle **Enable Sign in with Azure** to ON
4. Enter your Azure credentials:
   - **Client ID**: Application (client) ID from Azure
   - **Client Secret**: Secret value from Azure
   - **Azure Tenant**: Use `common` for multi-tenant (recommended)
5. Click **Save**

## Step 4: Configure Redirect URLs

### 4.1 Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://adviceapp.pages.dev` (your production frontend URL)
3. For development, also add: `http://localhost:3000`

### 4.2 Add Redirect URLs

Add these redirect URLs:
- `https://adviceapp.pages.dev/auth/callback`
- `https://adviceapp.pages.dev/onboarding/callback`
- `http://localhost:3000/auth/callback` (development)
- `http://localhost:3000/onboarding/callback` (development)

## Step 5: Configure JWT Settings

### 5.1 JWT Expiry

1. Go to **Authentication** → **Settings**
2. Configure JWT expiry:
   - **JWT expiry limit**: 3600 (1 hour) - recommended
   - **Refresh token expiry**: 604800 (7 days) - recommended

### 5.2 Custom Claims (Optional)

If you need custom claims in the JWT:

1. Go to **Database** → **Functions**
2. Create a new function:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Get user role from users table
  SELECT onboarding_completed INTO user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';
  
  -- Add custom claim
  claims := jsonb_set(claims, '{onboarding_completed}', to_jsonb(user_role));

  -- Update the 'claims' object in the original event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;
```

3. Go to **Authentication** → **Hooks**
4. Enable **Custom Access Token Hook**
5. Select your function

## Step 6: Get API Keys

### 6.1 Get Anon Key

1. Go to **Settings** → **API**
2. Find **Project API keys**
3. Copy **anon** / **public** key
4. This is your `SUPABASE_ANON_KEY`

### 6.2 Get Service Role Key

1. In the same section, copy **service_role** key
2. **CRITICAL**: Keep this secret! Never expose in frontend code
3. This is your `SUPABASE_SERVICE_ROLE_KEY`

## Step 7: Update Environment Variables

### Backend (.env)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend URL
FRONTEND_URL=https://adviceapp.pages.dev

# JWT Secret (not needed with Supabase Auth)
# JWT_SECRET=... (can be removed)
```

### Frontend (.env)

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API
REACT_APP_API_BASE_URL=https://adviceapp-9rgw.onrender.com
```

### Render Environment Variables

Add these in Render dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`

### Cloudflare Pages Environment Variables

Add these in Cloudflare Pages dashboard:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_API_BASE_URL`

## Step 8: Test Authentication

### Test Email/Password Signup

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'SecurePassword123!',
  options: {
    data: {
      name: 'Test User'
    }
  }
});
```

### Test Google OAuth

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://adviceapp.pages.dev/auth/callback'
  }
});
```

### Test Microsoft OAuth

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    redirectTo: 'https://adviceapp.pages.dev/auth/callback',
    scopes: 'email profile'
  }
});
```

## Troubleshooting

### "Invalid redirect URL"
- Check that redirect URL is added in Supabase **URL Configuration**
- Verify URL matches exactly (including protocol and trailing slash)

### "OAuth error: invalid_client"
- Verify Client ID and Client Secret are correct
- Check that redirect URI in Google/Azure matches Supabase callback URL

### "User not found after OAuth"
- Check that user was created in **Authentication** → **Users**
- Verify RLS policies allow user to read their own data

### "Token expired"
- Check JWT expiry settings
- Implement token refresh in frontend

## Security Best Practices

1. **Never expose service role key** in frontend code
2. **Use HTTPS** for all redirect URLs in production
3. **Enable email confirmation** to prevent fake signups
4. **Set appropriate JWT expiry** (1 hour recommended)
5. **Enable MFA** for admin accounts
6. **Regularly rotate** client secrets
7. **Monitor auth logs** for suspicious activity

## Next Steps

After configuring Supabase Auth:
1. Update frontend to use Supabase Auth
2. Update backend to verify Supabase tokens
3. Test complete authentication flow
4. Implement onboarding flow
5. Add calendar integration (separate from auth)

