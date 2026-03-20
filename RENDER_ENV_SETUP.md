# Render Environment Variables Setup

## Required Environment Variables for Render Deployment

To fix the current deployment issues, you need to set these environment variables in your Render service dashboard:

### Essential Variables (Required for basic functionality)
```
JWT_SECRET=your-secure-random-string-here
FRONTEND_URL=https://adviceapp.pages.dev
NODE_ENV=production
```

### Google OAuth (Required for authentication)
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/auth/google/callback
```

### Supabase Database (Required for data persistence)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### OpenAI (Optional - for AI features)
```
OPENAI_API_KEY=sk-proj-your-openai-key
```

## How to Set Environment Variables in Render

1. Go to your Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Click "Add Environment Variable"
5. Add each variable one by one

## Current Status

✅ **Backend starts without errors** - Missing environment variables are handled gracefully
✅ **Health endpoint works** - Returns status even without database connection
✅ **All endpoints handle missing services** - Return proper 503 errors when services unavailable
✅ **Smoke tests passing** - All basic functionality verified
⚠️ **Database features disabled** - Until Supabase variables are added
⚠️ **AI features disabled** - Until OpenAI API key is added
⚠️ **Authentication disabled** - Until Google OAuth is configured

## Recent Fixes (Latest Deployment)

✅ **Fixed Google OAuth callback** - No longer crashes when Supabase unavailable
✅ **Fixed all calendar endpoints** - Graceful handling of missing database
✅ **Fixed meeting endpoints** - Proper error responses for missing services
✅ **All Supabase calls protected** - No more null reference errors

## Priority Order

1. **JWT_SECRET** - Generate a secure random string (32+ characters)
2. **FRONTEND_URL** - Set to your Cloudflare Pages URL
3. **Google OAuth credentials** - For user authentication
4. **Supabase credentials** - For data persistence
5. **OpenAI API key** - For AI features (optional)

## Testing

After setting the environment variables, the backend should:
- Start successfully ✅
- Return healthy status from `/api/health` ✅
- Allow Google OAuth login (with Google vars)
- Store/retrieve data (with Supabase vars)
- Generate AI summaries (with OpenAI key)
