#!/bin/bash

# Full Auto Migration Script
# Updates all backend route files to use Supabase Auth

echo "🚀 Starting FULL AUTO migration of all backend routes..."

# List of files to update
FILES=(
  "backend/src/routes/ask-advicly.js"
  "backend/src/routes/calendar.js"
  "backend/src/routes/calendly.js"
  "backend/src/routes/clientDocuments.js"
  "backend/src/routes/clients.js"
  "backend/src/routes/dataImport.js"
  "backend/src/routes/notifications.js"
  "backend/src/routes/pipeline.js"
)

# Counter
TOTAL=${#FILES[@]}
CURRENT=0

for file in "${FILES[@]}"; do
  CURRENT=$((CURRENT + 1))
  echo ""
  echo "[$CURRENT/$TOTAL] Processing $file..."
  
  if [ ! -f "$file" ]; then
    echo "  ⚠️  File not found, skipping..."
    continue
  fi
  
  # 1. Replace authenticateUser with authenticateSupabaseUser
  sed -i '' 's/authenticateUser/authenticateSupabaseUser/g' "$file"
  echo "  ✅ Replaced authenticateUser → authenticateSupabaseUser"
  
  # 2. Replace authenticateToken with authenticateSupabaseUser
  sed -i '' 's/authenticateToken/authenticateSupabaseUser/g' "$file"
  echo "  ✅ Replaced authenticateToken → authenticateSupabaseUser"
  
  # 3. Update import statement for auth middleware
  sed -i '' "s/const { authenticateSupabaseUser } = require('..\/middleware\/auth');/const { authenticateSupabaseUser } = require('..\/middleware\/supabaseAuth');/g" "$file"
  sed -i '' "s/const { authenticateSupabaseUser, authenticateSupabaseUser } = require('..\/middleware\/auth');/const { authenticateSupabaseUser } = require('..\/middleware\/supabaseAuth');/g" "$file"
  echo "  ✅ Updated import statement"
  
  # 4. Replace getSupabase() with req.supabase
  sed -i '' 's/await getSupabase()/await req.supabase/g' "$file"
  sed -i '' 's/getSupabase()/req.supabase/g' "$file"
  echo "  ✅ Replaced getSupabase() → req.supabase"
  
  # 5. Remove inline JWT verification patterns (common patterns)
  # This is more complex and might need manual review, so we'll just flag it
  if grep -q "jwt.verify" "$file"; then
    echo "  ⚠️  File contains jwt.verify - may need manual cleanup"
  fi
  
  if grep -q "const token = auth.split" "$file"; then
    echo "  ⚠️  File contains inline JWT parsing - may need manual cleanup"
  fi
  
  echo "  ✅ $file updated"
done

echo ""
echo "🎉 Migration complete!"
echo ""
echo "⚠️  IMPORTANT: Some files may still contain inline JWT verification code."
echo "   These need manual cleanup to remove redundant auth checks."
echo ""
echo "📋 Next steps:"
echo "  1. Review the changes with: git diff"
echo "  2. Test the application locally"
echo "  3. Fix any remaining inline JWT code manually"
echo "  4. Commit and push when ready"
echo ""

