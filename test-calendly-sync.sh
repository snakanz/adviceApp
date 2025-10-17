#!/bin/bash

# =====================================================
# Calendly Sync Test Script
# =====================================================
# This script tests your Calendly webhook and sync setup
# =====================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "Calendly Sync System Test"
echo -e "==========================================${NC}"
echo ""

# Configuration
BACKEND_URL="https://adviceapp-9rgw.onrender.com"
WEBHOOK_ID="af8074d8-7d56-4431-b2b8-653f64c3f5b4"

# Check if JWT token is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  No JWT token provided${NC}"
    echo "Usage: ./test-calendly-sync.sh YOUR_JWT_TOKEN"
    echo ""
    echo "Running tests that don't require authentication..."
    echo ""
    JWT_TOKEN=""
else
    JWT_TOKEN="$1"
    echo -e "${GREEN}✅ JWT token provided${NC}"
    echo ""
fi

# =====================================================
# Test 1: Webhook Endpoint Accessibility
# =====================================================
echo -e "${BLUE}Test 1: Webhook Endpoint Accessibility${NC}"
echo "Testing: $BACKEND_URL/api/calendly/webhook/test"
echo ""

WEBHOOK_TEST=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/calendly/webhook/test" || echo "000")
HTTP_CODE=$(echo "$WEBHOOK_TEST" | tail -n 1)
RESPONSE=$(echo "$WEBHOOK_TEST" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Webhook endpoint is accessible${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}❌ Webhook endpoint returned HTTP $HTTP_CODE${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# =====================================================
# Test 2: Webhook Status in Calendly
# =====================================================
echo -e "${BLUE}Test 2: Webhook Status in Calendly${NC}"
echo "Webhook ID: $WEBHOOK_ID"
echo ""

if [ -n "$CALENDLY_TOKEN" ]; then
    WEBHOOK_STATUS=$(curl -s --request GET \
      --url "https://api.calendly.com/webhook_subscriptions/$WEBHOOK_ID" \
      --header "Authorization: Bearer $CALENDLY_TOKEN")
    
    STATE=$(echo "$WEBHOOK_STATUS" | jq -r '.resource.state' 2>/dev/null)
    
    if [ "$STATE" = "active" ]; then
        echo -e "${GREEN}✅ Webhook is ACTIVE in Calendly${NC}"
        echo "Callback URL: $(echo "$WEBHOOK_STATUS" | jq -r '.resource.callback_url')"
        echo "Events: $(echo "$WEBHOOK_STATUS" | jq -r '.resource.events | join(", ")')"
    else
        echo -e "${RED}❌ Webhook state: $STATE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  CALENDLY_TOKEN not set, skipping Calendly API check${NC}"
    echo "To check webhook status, set CALENDLY_TOKEN environment variable"
fi
echo ""

# =====================================================
# Test 3: Scheduler Status (requires JWT)
# =====================================================
if [ -n "$JWT_TOKEN" ]; then
    echo -e "${BLUE}Test 3: Automatic Sync Scheduler Status${NC}"
    echo ""
    
    SCHEDULER_STATUS=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      "$BACKEND_URL/api/calendly/scheduler/status" || echo "000")
    
    HTTP_CODE=$(echo "$SCHEDULER_STATUS" | tail -n 1)
    RESPONSE=$(echo "$SCHEDULER_STATUS" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Scheduler status retrieved${NC}"
        echo "Response:"
        echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        
        IS_RUNNING=$(echo "$RESPONSE" | jq -r '.scheduler.isRunning' 2>/dev/null)
        if [ "$IS_RUNNING" = "true" ]; then
            echo -e "${GREEN}✅ Scheduler is RUNNING${NC}"
        else
            echo -e "${RED}❌ Scheduler is NOT running${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to get scheduler status (HTTP $HTTP_CODE)${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping scheduler status test (no JWT token)${NC}"
    echo ""
fi

# =====================================================
# Test 4: Trigger Manual Sync (requires JWT)
# =====================================================
if [ -n "$JWT_TOKEN" ]; then
    echo -e "${BLUE}Test 4: Trigger Manual Sync${NC}"
    echo ""
    
    read -p "Do you want to trigger a manual sync? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Triggering manual sync..."
        
        SYNC_RESULT=$(curl -s -w "\n%{http_code}" \
          -X POST \
          -H "Authorization: Bearer $JWT_TOKEN" \
          "$BACKEND_URL/api/calendly/scheduler/trigger" || echo "000")
        
        HTTP_CODE=$(echo "$SYNC_RESULT" | tail -n 1)
        RESPONSE=$(echo "$SYNC_RESULT" | head -n -1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ Manual sync triggered${NC}"
            echo "Response:"
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
            echo ""
            echo "Check Render logs to see sync progress:"
            echo "https://dashboard.render.com"
        else
            echo -e "${RED}❌ Failed to trigger sync (HTTP $HTTP_CODE)${NC}"
        fi
    else
        echo "Skipping manual sync trigger"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping manual sync test (no JWT token)${NC}"
    echo ""
fi

# =====================================================
# Test 5: Database Connection Test
# =====================================================
echo -e "${BLUE}Test 5: Backend Health Check${NC}"
echo ""

HEALTH_CHECK=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" || echo "000")
HTTP_CODE=$(echo "$HEALTH_CHECK" | tail -n 1)
RESPONSE=$(echo "$HEALTH_CHECK" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}❌ Backend health check failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =====================================================
# Summary
# =====================================================
echo -e "${GREEN}=========================================="
echo "Test Summary"
echo -e "==========================================${NC}"
echo ""
echo "✅ Tests completed"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Book a test meeting in Calendly"
echo "2. Check Render logs for webhook event:"
echo "   https://dashboard.render.com"
echo "3. Look for: '📥 Received Calendly webhook:'"
echo "4. Verify meeting appears in Advicly within 1-2 seconds"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo "- Webhook endpoint: $BACKEND_URL/api/calendly/webhook"
echo "- Webhook ID: $WEBHOOK_ID"
echo "- Automatic sync: Every 15 minutes"
echo ""
echo -e "${GREEN}=========================================${NC}"

