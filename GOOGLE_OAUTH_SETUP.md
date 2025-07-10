# Google OAuth Setup Guide

## Overview
This guide will help you set up Google OAuth with the correct scopes for calendar access in your adviceApp.

## Step 1: Google Cloud Console Setup

### 1.1 Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to "APIs & Services" > "OAuth consent screen"

### 1.2 Configure OAuth Consent Screen
1. **User Type**: Choose "External" (unless you have a Google Workspace domain)
2. **App Information**:
   - App name: `adviceApp`
   - User support email: Your email
   - Developer contact information: Your email

### 1.3 Add Required Scopes
In the "Scopes" section, add these scopes:
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

### 1.4 Add Test Users (if External)
If your app is in "Testing" mode, add your email address as a test user.

## Step 2: OAuth 2.0 Client IDs

### 2.1 Create OAuth 2.0 Client ID
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"

### 2.2 Configure Authorized Redirect URIs
Add these redirect URIs:
- `http://localhost:3000/auth/callback` (for local development)
- `https://your-frontend-domain.com/auth/callback` (for production)

### 2.3 Save Credentials
- Copy the **Client ID** and **Client Secret**
- Update your environment variables:
  ```
  GOOGLE_CLIENT_ID=your_client_id_here
  GOOGLE_CLIENT_SECRET=your_client_secret_here
  GOOGLE_REDIRECT_URI=https://your-backend-domain.com/api/auth/google/callback
  ```

## Step 3: Enable Google Calendar API

1. Go to "APIs & Services" > "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

## Step 4: Environment Variables

### Backend (.env)
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-backend-domain.com/api/auth/google/callback
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://your-frontend-domain.com
DATABASE_URL=your_supabase_connection_string
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-backend-domain.com
```

## Step 5: Testing the Setup

### 5.1 Test OAuth Flow
1. Go to your app's login page
2. Click "Login with Google"
3. You should see the consent screen with the new scopes
4. After consenting, you should be redirected back to your app

### 5.2 Test Calendar Access
1. After logging in, go to the Meetings page
2. Click "Sync Meetings" to test calendar access
3. If you get a 403 error, you may need to:
   - Re-authenticate (click "Reconnect Google")
   - Check that all scopes are properly configured
   - Ensure the Google Calendar API is enabled

## Step 6: Troubleshooting

### Common Issues

#### 403 Forbidden Error
- **Cause**: Insufficient scopes or API not enabled
- **Solution**: 
  1. Ensure all required scopes are added to OAuth consent screen
  2. Enable Google Calendar API
  3. Re-authenticate users (they need to consent to new scopes)

#### Redirect URI Mismatch
- **Cause**: Redirect URI in code doesn't match Google Console
- **Solution**: Update redirect URIs in Google Cloud Console

#### Token Expired
- **Cause**: Access tokens expire after 1 hour
- **Solution**: The app now automatically refreshes tokens

#### User Not Found
- **Cause**: Database schema mismatch
- **Solution**: Ensure your database has the correct tables and columns

## Step 7: Production Deployment

### 7.1 Update Redirect URIs
When deploying to production:
1. Update redirect URIs in Google Cloud Console
2. Update environment variables
3. Ensure HTTPS is used for all URLs

### 7.2 Publish App (Optional)
If you want to make your app available to all users:
1. Go to OAuth consent screen
2. Click "Publish App"
3. Note: This requires Google's verification process

## Security Notes

1. **Never commit secrets to version control**
2. **Use environment variables for all sensitive data**
3. **Rotate JWT secrets regularly**
4. **Monitor OAuth usage in Google Cloud Console**
5. **Implement proper error handling for token refresh**

## Support

If you encounter issues:
1. Check Google Cloud Console logs
2. Review browser network tab for OAuth errors
3. Check backend logs for detailed error messages
4. Ensure all environment variables are correctly set 