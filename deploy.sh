#!/bin/bash

# Advicly Platform Deployment Script
# This script deploys the complete Advicly platform to all environments

set -e  # Exit on any error

echo "🚀 Starting Advicly Platform Deployment..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the root of the Advicly project"
    exit 1
fi

# Step 1: Commit and push to GitHub
print_status "Step 1: Pushing latest changes to GitHub..."
git add .
if git diff --staged --quiet; then
    print_warning "No changes to commit"
else
    git commit -m "deploy: Update for production deployment $(date '+%Y-%m-%d %H:%M:%S')" || true
fi

git push origin main
print_success "Code pushed to GitHub"

# Step 2: Build frontend for production
print_status "Step 2: Building frontend for production..."
npm run build
print_success "Frontend build completed"

# Step 3: Deploy to Cloudflare Pages
print_status "Step 3: Deploying frontend to Cloudflare Pages..."
if command -v wrangler &> /dev/null; then
    # Deploy using Wrangler CLI
    npx wrangler pages deploy build --project-name=adviceapp
    print_success "Frontend deployed to Cloudflare Pages"
else
    print_warning "Wrangler CLI not found. Please deploy manually to Cloudflare Pages:"
    echo "  1. Go to https://dash.cloudflare.com/pages"
    echo "  2. Select your adviceapp project"
    echo "  3. Go to Deployments tab"
    echo "  4. Click 'Create deployment'"
    echo "  5. Upload the 'build' folder"
fi

# Step 4: Deploy backend to Render
print_status "Step 4: Backend will auto-deploy to Render from GitHub..."
print_warning "Render will automatically deploy the backend from the GitHub repository"
print_warning "Monitor deployment at: https://dashboard.render.com/"

# Step 5: Database migrations (if needed)
print_status "Step 5: Checking database migrations..."
if [ -f "backend/migrations/001_comprehensive_sync_schema.sql" ]; then
    print_warning "Database migrations available. Run manually if needed:"
    echo "  - Connect to your Supabase dashboard"
    echo "  - Go to SQL Editor"
    echo "  - Run any pending migrations from backend/migrations/"
fi

# Step 6: Environment variables check
print_status "Step 6: Environment variables checklist..."
echo ""
echo "📋 ENVIRONMENT VARIABLES CHECKLIST"
echo "=================================="
echo ""
echo "🔧 RENDER BACKEND ENVIRONMENT:"
echo "  ✓ SUPABASE_URL"
echo "  ✓ SUPABASE_ANON_KEY"
echo "  ✓ SUPABASE_SERVICE_ROLE_KEY"
echo "  ✓ JWT_SECRET"
echo "  ✓ OPENAI_API_KEY"
echo "  ✓ GOOGLE_CLIENT_ID"
echo "  ✓ GOOGLE_CLIENT_SECRET"
echo "  ✓ GOOGLE_REDIRECT_URI"
echo "  ✓ NODE_ENV=production"
echo "  ✓ PORT=10000"
echo ""
echo "🌐 CLOUDFLARE PAGES ENVIRONMENT:"
echo "  ✓ REACT_APP_BACKEND_URL (your Render backend URL)"
echo "  ✓ REACT_APP_SUPABASE_URL"
echo "  ✓ REACT_APP_SUPABASE_ANON_KEY"
echo ""

# Step 7: Deployment URLs
print_status "Step 7: Deployment URLs..."
echo ""
echo "🌍 DEPLOYMENT URLS"
echo "=================="
echo "Frontend: https://adviceapp.pages.dev"
echo "Backend:  https://your-render-service.onrender.com"
echo "Database: https://your-project.supabase.co"
echo ""

# Step 8: Post-deployment tests
print_status "Step 8: Post-deployment verification..."
echo ""
echo "🧪 POST-DEPLOYMENT CHECKLIST"
echo "============================"
echo "□ Frontend loads correctly"
echo "□ User authentication works"
echo "□ Google OAuth integration works"
echo "□ Clients page loads and displays data"
echo "□ Meetings page loads and displays data"
echo "□ Data import feature works"
echo "□ Ask Advicly chat functionality works"
echo "□ Settings page accessible"
echo "□ All API endpoints responding"
echo ""

print_success "Deployment process completed!"
echo ""
echo "🎉 NEXT STEPS:"
echo "============="
echo "1. Verify frontend deployment at: https://adviceapp.pages.dev"
echo "2. Check backend deployment status in Render dashboard"
echo "3. Test all functionality in production"
echo "4. Run the post-deployment checklist above"
echo "5. Monitor logs for any issues"
echo ""
echo "📚 For detailed deployment information, see:"
echo "   - COMPLETE_DEPLOYMENT_GUIDE.md"
echo "   - DATA_IMPORT_IMPLEMENTATION.md"
echo ""
print_success "Happy deploying! 🚀"
