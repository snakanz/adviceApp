# Local Development Setup

## Quick Start

1. **Run the setup script:**
   ```bash
   npm run setup
   ```

2. **Start the backend (in one terminal):**
   ```bash
   npm run backend
   ```
   This starts your Cloudflare Worker locally at http://localhost:8787

3. **Start the frontend (in another terminal):**
   ```bash
   npm start
   ```
   This starts your React app at http://localhost:3000

## Manual Setup

If you prefer to set up manually:

1. **Create .env.local file:**
   ```bash
   echo "REACT_APP_API_URL=http://localhost:8787" > .env.local
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Start services:**
   - Backend: `cd backend && wrangler dev`
   - Frontend: `npm start`

## Working Offline

- Make changes to your code
- Test locally at http://localhost:3000
- Commit changes: `git add . && git commit -m "your message"`
- Push when ready: `git push`

## URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8787
- **Production Frontend:** https://adviceapp.pages.dev
- **Production Backend:** https://adviceapp-database.nelson-ec5.workers.dev 