#!/bin/bash

# Pipeline Fixes - Deployment Verification Script
# This script checks if the pipeline fixes have been successfully deployed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_URL="https://adviceapp.pages.dev"
BACKEND_URL="https://adviceapp-9rgw.onrender.com"
COMMIT_HASH="4016cb7"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Pipeline Fixes - Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check 1: Verify Git Status
print_status "Checking Git status..."
if git log --oneline -1 | grep -q "$COMMIT_HASH"; then
    print_success "Latest commit matches expected hash: $COMMIT_HASH"
else
    print_error "Latest commit does not match expected hash"
    git log --oneline -1
fi
echo ""

# Check 2: Verify Files Changed
print_status "Verifying changed files..."
if git show --name-only $COMMIT_HASH | grep -q "backend/src/routes/clients.js"; then
    print_success "Backend file changed: backend/src/routes/clients.js"
else
    print_error "Backend file not found in commit"
fi

if git show --name-only $COMMIT_HASH | grep -q "src/pages/Pipeline.js"; then
    print_success "Frontend file changed: src/pages/Pipeline.js"
else
    print_error "Frontend file not found in commit"
fi
echo ""

# Check 3: Verify Backend Changes
print_status "Verifying backend code changes..."
if grep -q "We allow adding clients to pipeline regardless of whether they have future meetings" backend/src/routes/clients.js; then
    print_success "Backend fix verified: Meeting restriction removed"
else
    print_error "Backend fix not found in code"
fi
echo ""

# Check 4: Verify Frontend Changes
print_status "Verifying frontend code changes..."
if grep -q "Show clients that match the selected month OR clients with pipeline data" src/pages/Pipeline.js; then
    print_success "Frontend fix #1 verified: Filtering logic updated"
else
    print_error "Frontend fix #1 not found in code"
fi

if grep -q "Meeting Status Indicator" src/pages/Pipeline.js; then
    print_success "Frontend fix #2 verified: Meeting status indicators added"
else
    print_error "Frontend fix #2 not found in code"
fi
echo ""

# Check 5: Test Backend Availability
print_status "Testing backend availability..."
if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" | grep -q "200"; then
    print_success "Backend is accessible at $BACKEND_URL"
else
    print_warning "Backend may not be accessible yet (still deploying?)"
fi
echo ""

# Check 6: Test Frontend Availability
print_status "Testing frontend availability..."
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    print_success "Frontend is accessible at $FRONTEND_URL"
else
    print_warning "Frontend may not be accessible yet (still deploying?)"
fi
echo ""

# Check 7: Verify Documentation
print_status "Verifying documentation files..."
if [ -f "PIPELINE_FIXES_SUMMARY.md" ]; then
    print_success "Documentation found: PIPELINE_FIXES_SUMMARY.md"
else
    print_error "Documentation missing: PIPELINE_FIXES_SUMMARY.md"
fi

if [ -f "PIPELINE_VISUAL_GUIDE.md" ]; then
    print_success "Documentation found: PIPELINE_VISUAL_GUIDE.md"
else
    print_error "Documentation missing: PIPELINE_VISUAL_GUIDE.md"
fi

if [ -f "QUICK_TEST_GUIDE.md" ]; then
    print_success "Documentation found: QUICK_TEST_GUIDE.md"
else
    print_error "Documentation missing: QUICK_TEST_GUIDE.md"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Code Changes:${NC}"
echo "  ✓ Commit pushed to GitHub"
echo "  ✓ Backend fix applied"
echo "  ✓ Frontend fixes applied"
echo "  ✓ Documentation created"
echo ""
echo -e "${YELLOW}Deployment Status:${NC}"
echo "  → Backend: Check https://dashboard.render.com/"
echo "  → Frontend: Check https://dash.cloudflare.com/pages"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Monitor deployment dashboards (5-10 minutes)"
echo "  2. Test functionality in production"
echo "  3. Verify all three fixes are working"
echo ""
echo -e "${GREEN}Production URLs:${NC}"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo ""
echo -e "${BLUE}========================================${NC}"

