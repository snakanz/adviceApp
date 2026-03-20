#!/bin/bash

echo "🚀 Setting up local development environment for AdviceApp..."

# Create .env.local file for frontend
echo "📝 Creating .env.local file..."
cat > .env.local << EOF
REACT_APP_API_BASE_URL=http://localhost:8787
EOF

echo "✅ .env.local created with local backend URL"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "🎉 Setup complete! Here's how to run your app locally:"
echo ""
echo "1. Start the backend (in one terminal):"
echo "   cd backend && wrangler dev"
echo ""
echo "2. Start the frontend (in another terminal):"
echo "   npm start"
echo ""
echo "3. View your app at: http://localhost:3000"
echo "4. Backend API at: http://localhost:8787"
echo ""
echo "💡 To work offline:"
echo "   - Make changes to your code"
echo "   - Test locally at http://localhost:3000"
echo "   - Commit with: git add . && git commit -m 'your message'"
echo "   - Push when ready: git push"
echo "" 