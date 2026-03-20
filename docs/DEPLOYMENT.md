# Deployment Guide

This guide covers deploying the Advicly platform to production.

## Architecture Overview

- **Frontend**: React app deployed to Cloudflare Pages
- **Backend**: Node.js/Express API deployed to Render
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API integration

## Frontend Deployment (Cloudflare Pages)

### Build Configuration
- **Framework preset**: Create React App
- **Build command**: `npm ci && npm run build`
- **Build output directory**: `build`
- **Node.js version**: 18.x or higher
- **Install command**: `npm ci` (for faster, reliable installs)

### Environment Variables
Configure in Cloudflare Pages dashboard under Settings > Environment variables:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
REACT_APP_API_BASE_URL=https://your-backend.onrender.com
```

### Exact Cloudflare Pages Settings
1. **Framework preset**: Create React App
2. **Build command**: `npm ci && npm run build`
3. **Build output directory**: `build`
4. **Root directory**: `/` (leave empty)
5. **Environment variables**: Add the three variables above

### Deployment Steps
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set build output directory: `build`
4. Configure environment variables
5. Deploy

## Backend Deployment (Render)

### Build Configuration
- **Build command**: `npm ci`
- **Start command**: `npm start`
- **Node.js version**: 18.x or higher
- **Environment**: Node.js
- **Region**: Choose closest to your users

### Environment Variables
Configure in Render dashboard:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
OPENAI_API_KEY=sk-proj-your-openai-key
JWT_SECRET=your-secure-random-string
FRONTEND_URL=https://adviceapp.pages.dev
NODE_ENV=production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/google/callback
```

### Deployment Steps
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Configure environment variables
6. Deploy

## Database Setup (Supabase)

### Initial Setup
1. Create a new Supabase project
2. Note down your project URL and API keys
3. Run the database migrations (see SCHEMA.md)

### Configuration
- Enable Row Level Security (RLS) for production
- Configure authentication providers (Google OAuth)
- Set up database policies for secure access

## Local Development

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   ```
3. Create `.env` files (see .env.example files)
4. Start development servers:
   ```bash
   # Frontend (port 3000)
   npm run dev
   
   # Backend (port 8787)
   npm run backend
   ```

## Health Checks

### Frontend
- Visit your Cloudflare Pages URL
- Check that the app loads and authentication works

### Backend
- Visit `https://your-backend.onrender.com/api/health`
- Should return `{"status": "ok"}`

### Database
- Check Supabase dashboard for connection status
- Verify tables and data are accessible

## Troubleshooting

### Common Issues
1. **CORS errors**: Check FRONTEND_URL in backend environment
2. **Authentication failures**: Verify Google OAuth configuration
3. **Database connection**: Check Supabase URL and keys
4. **Build failures**: Ensure all dependencies are in package.json

### Logs
- **Frontend**: Check Cloudflare Pages build logs
- **Backend**: Check Render service logs
- **Database**: Check Supabase logs and metrics
