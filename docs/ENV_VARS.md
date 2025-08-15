# Environment Variables

This document lists all environment variables used in the Advicly platform and where they should be configured.

## Backend Environment Variables (Render)

Configure these in your Render service dashboard:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for backend operations | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | `sk-proj-...` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-secure-random-string` |
| `FRONTEND_URL` | Frontend URL for OAuth redirects | `https://adviceapp.pages.dev` |
| `NODE_ENV` | Node.js environment | `production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | `https://your-backend.onrender.com/api/auth/google/callback` |

## Frontend Environment Variables (Cloudflare Pages)

Configure these in your Cloudflare Pages dashboard:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anonymous key for frontend operations | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `REACT_APP_API_BASE_URL` | Backend API base URL | `https://your-backend.onrender.com` |

## Supabase Configuration

Configure these in your Supabase dashboard:

1. **Database URL**: Available in Supabase Settings > Database
2. **API Keys**: Available in Supabase Settings > API
   - `anon` key for frontend (public)
   - `service_role` key for backend (private)

## Security Notes

- Never commit real environment values to version control
- Use `.env.example` files with placeholder values only
- Store production secrets only in deployment platforms (Render, Cloudflare Pages, Supabase)
- Rotate secrets regularly, especially JWT_SECRET and API keys
