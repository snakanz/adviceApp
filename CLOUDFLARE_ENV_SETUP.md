# Cloudflare Pages Environment Variables Setup

## ⚠️ CRITICAL: Required Environment Variables

The Advicly frontend requires these environment variables to be configured in Cloudflare Pages for authentication to work.

## 🔧 Setup Instructions

### 1. Go to Cloudflare Pages Dashboard
Visit: https://dash.cloudflare.com/pages

### 2. Select Your Project
Click on: **adviceapp**

### 3. Go to Settings → Environment Variables
Navigate to: **Settings** → **Environment variables**

### 4. Add the Following Variables

#### For Production Environment:

| Variable Name | Value |
|--------------|-------|
| `REACT_APP_SUPABASE_URL` | `https://xjqjzievgepqpgtggcjx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcWp6aWV2Z2VwcXBndGdnY2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5ODYyNTksImV4cCI6MjA2NzU2MjI1OX0.dWBeOIQ-Je3FfKtT4npLZgmIkaMUtquXrk64Jeg6yxk` |
| `REACT_APP_API_BASE_URL` | `https://adviceapp-9rgw.onrender.com` |

### 5. Save and Redeploy

After adding the environment variables:
1. Click **"Save"**
2. Go to **"Deployments"** tab
3. Click **"Retry deployment"** on the latest deployment

OR

Trigger a new deployment by pushing a commit to the repository.

---

## 🔍 Verification

After deployment completes:

1. Visit: https://adviceapp.pages.dev
2. Open browser DevTools (F12) → Console
3. Check for Supabase initialization logs
4. Try signing in with Google OAuth
5. Verify no authentication loop errors

---

## 📝 Notes

- **NEVER commit `.env.local` to git** (it's already in `.gitignore`)
- The anon key is safe to expose in frontend code (it's public)
- The service role key should ONLY be used in the backend
- Environment variables in Cloudflare Pages are encrypted at rest

---

## 🚨 Current Issue

**Before this fix:**
- Frontend had no Supabase configuration
- Supabase client initialized with `undefined` values
- Authentication failed silently
- Users stuck in sign-in/sign-out loop

**After this fix:**
- Frontend can properly connect to Supabase
- OAuth authentication will work correctly
- Session management will function properly

