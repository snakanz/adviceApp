// Test the sync endpoint with a real JWT token
// This script will help us test the endpoint with proper authentication

const jwt = require('jsonwebtoken');

// Create a test JWT token (you'll need to replace with actual user ID)
function createTestToken(userId = '1') {
  const payload = {
    id: userId,
    email: 'test@example.com',
    name: 'Test User'
  };
  
  // You'll need to set the JWT_SECRET environment variable
  const secret = process.env.JWT_SECRET || 'your-jwt-secret-here';
  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  
  return token;
}

async function testSyncEndpoint(userId = '1') {
  const token = createTestToken(userId);
  const API_URL = 'https://adviceapp-9rgw.onrender.com';
  
  console.log('🧪 Testing sync endpoint with user ID:', userId);
  console.log('🔑 Generated JWT token (first 50 chars):', token.substring(0, 50) + '...');
  
  try {
    const response = await fetch(`${API_URL}/api/calendar/sync-with-deletions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\n📄 Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ SUCCESS: Endpoint is working!');
    } else {
      console.log('❌ ERROR: Check the response above for details');
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
}

// Test with different user IDs
async function runTests() {
  console.log('🚀 Starting sync endpoint tests...\n');
  
  // Test with user ID 1 (common default)
  await testSyncEndpoint('1');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test with a Google OAuth user ID format (longer string)
  await testSyncEndpoint('123456789012345678901');
}

// Run the tests
runTests();
