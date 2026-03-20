#!/bin/bash

# Script to sync Calendly meetings and extract clients
# Run this after updating the database constraint to allow 'calendly' as a meeting source

echo "🔄 Starting Calendly sync and client extraction..."

# Get JWT token for user ID 1
JWT_TOKEN=$(node -e "require('dotenv').config(); const jwt = require('jsonwebtoken'); console.log(jwt.sign({id: 1}, process.env.JWT_SECRET))")

echo "📅 Syncing Calendly meetings..."
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8787/api/calendly/sync

echo ""
echo "🔗 Extracting and linking clients from meetings..."
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8787/api/clients/extract-clients

echo ""
echo "✅ Sync and extraction complete!"
echo ""
echo "📊 Check the results:"
echo "- Calendly meetings should now appear in your meetings list"
echo "- Clients should be extracted and appear in the Clients tab"
echo "- Each meeting should show its source (Google Calendar vs Calendly)"
