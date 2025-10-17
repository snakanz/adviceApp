#!/bin/bash

# =====================================================
# Calendly Webhook Setup Script
# =====================================================
# This script will:
# 1. Get your Calendly organization URI
# 2. Create a webhook subscription
# 3. Display the signing key to add to Render
# =====================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "Calendly Webhook Setup"
echo -e "==========================================${NC}"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Calendly token not provided${NC}"
    echo ""
    echo "Usage: ./setup-calendly-webhook.sh YOUR_CALENDLY_TOKEN"
    echo ""
    echo "Get your token from: https://calendly.com/integrations/api_webhooks"
    echo "Use your 'advicly' token"
    exit 1
fi

TOKEN="$1"
WEBHOOK_URL="https://adviceapp-9rgw.onrender.com/api/calendly/webhook"

echo -e "${BLUE}Step 1: Getting your organization URI...${NC}"
echo ""

# Get user info and organization URI
ORG_RESPONSE=$(curl -s --request GET \
  --url https://api.calendly.com/users/me \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json')

# Check if request was successful
if echo "$ORG_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Error getting organization info:${NC}"
    echo "$ORG_RESPONSE" | jq . 2>/dev/null || echo "$ORG_RESPONSE"
    exit 1
fi

# Extract organization URI
ORG_URI=$(echo "$ORG_RESPONSE" | jq -r '.resource.current_organization' 2>/dev/null)

if [ -z "$ORG_URI" ] || [ "$ORG_URI" = "null" ]; then
    echo -e "${RED}❌ Error: Could not extract organization URI${NC}"
    echo "Response:"
    echo "$ORG_RESPONSE" | jq . 2>/dev/null || echo "$ORG_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Organization URI: $ORG_URI${NC}"
echo ""

# Get user name for display
USER_NAME=$(echo "$ORG_RESPONSE" | jq -r '.resource.name' 2>/dev/null)
USER_EMAIL=$(echo "$ORG_RESPONSE" | jq -r '.resource.email' 2>/dev/null)

echo -e "${BLUE}User: $USER_NAME ($USER_EMAIL)${NC}"
echo ""

echo -e "${BLUE}Step 2: Creating webhook subscription...${NC}"
echo ""

# Create webhook subscription
WEBHOOK_RESPONSE=$(curl -s --request POST \
  --url https://api.calendly.com/webhook_subscriptions \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{
    \"url\": \"$WEBHOOK_URL\",
    \"events\": [\"invitee.created\", \"invitee.canceled\"],
    \"organization\": \"$ORG_URI\",
    \"scope\": \"organization\"
  }")

# Check if webhook creation was successful
if echo "$WEBHOOK_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Error creating webhook:${NC}"
    echo "$WEBHOOK_RESPONSE" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE"
    
    # Check if webhook already exists
    if echo "$WEBHOOK_RESPONSE" | grep -q "already exists"; then
        echo ""
        echo -e "${YELLOW}⚠️  Webhook might already exist. Checking existing webhooks...${NC}"
        echo ""
        
        # List existing webhooks
        EXISTING_WEBHOOKS=$(curl -s --request GET \
          --url "https://api.calendly.com/webhook_subscriptions?organization=$ORG_URI&scope=organization" \
          --header "Authorization: Bearer $TOKEN")
        
        echo "$EXISTING_WEBHOOKS" | jq .
        
        echo ""
        echo -e "${YELLOW}If you see a webhook with your URL above, it's already configured!${NC}"
        echo -e "${YELLOW}Note: The signing key is only shown once during creation.${NC}"
        echo -e "${YELLOW}If you need to get it again, you'll need to delete and recreate the webhook.${NC}"
    fi
    
    exit 1
fi

# Extract signing key
SIGNING_KEY=$(echo "$WEBHOOK_RESPONSE" | jq -r '.resource.signing_key' 2>/dev/null)
WEBHOOK_URI=$(echo "$WEBHOOK_RESPONSE" | jq -r '.resource.uri' 2>/dev/null)
WEBHOOK_STATE=$(echo "$WEBHOOK_RESPONSE" | jq -r '.resource.state' 2>/dev/null)

if [ -z "$SIGNING_KEY" ] || [ "$SIGNING_KEY" = "null" ]; then
    echo -e "${RED}❌ Error: Could not extract signing key${NC}"
    echo "Response:"
    echo "$WEBHOOK_RESPONSE" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Webhook created successfully!${NC}"
echo ""
echo -e "${BLUE}Webhook Details:${NC}"
echo "  URI: $WEBHOOK_URI"
echo "  State: $WEBHOOK_STATE"
echo "  Callback URL: $WEBHOOK_URL"
echo "  Events: invitee.created, invitee.canceled"
echo ""

echo -e "${GREEN}=========================================="
echo "✅ WEBHOOK SETUP COMPLETE!"
echo -e "==========================================${NC}"
echo ""
echo -e "${YELLOW}📋 NEXT STEP: Add this to Render${NC}"
echo ""
echo "1. Go to: https://dashboard.render.com"
echo "2. Select your backend service: adviceapp-9rgw"
echo "3. Click 'Environment' tab"
echo "4. Click 'Add Environment Variable'"
echo "5. Add this variable:"
echo ""
echo -e "${GREEN}Key:${NC}"
echo "CALENDLY_WEBHOOK_SIGNING_KEY"
echo ""
echo -e "${GREEN}Value:${NC}"
echo "$SIGNING_KEY"
echo ""
echo "6. Click 'Save Changes'"
echo ""
echo -e "${BLUE}⚠️  IMPORTANT: Save this signing key somewhere safe!${NC}"
echo -e "${BLUE}It will only be shown once.${NC}"
echo ""
echo -e "${GREEN}=========================================="
echo "Testing Instructions"
echo -e "==========================================${NC}"
echo ""
echo "After adding the signing key to Render:"
echo ""
echo "1. Wait for Render to redeploy (~2 minutes)"
echo ""
echo "2. Test the webhook endpoint:"
echo "   curl https://adviceapp-9rgw.onrender.com/api/calendly/webhook/test"
echo ""
echo "3. Schedule a test meeting in Calendly"
echo ""
echo "4. Check Render logs for:"
echo "   📥 Received Calendly webhook: ..."
echo "   ✅ Meeting created from webhook: ..."
echo ""
echo "5. Meeting should appear in Advicly within 1-2 seconds!"
echo ""
echo -e "${GREEN}=========================================${NC}"

