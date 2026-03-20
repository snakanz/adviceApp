// Test script to check the meetings endpoint
const API_URL = 'https://advicely-backend.onrender.com'; // Your Render backend URL

async function testMeetingsEndpoint() {
  console.log('🧪 Testing meetings endpoint...');
  
  // You'll need to get your JWT token from localStorage in the browser
  // For now, let's test without auth to see what error we get
  
  try {
    console.log(`📡 Testing: ${API_URL}/api/dev/meetings`);
    
    const response = await fetch(`${API_URL}/api/dev/meetings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add your JWT token here: 'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const data = await response.text(); // Get as text first to see raw response
    console.log(`📊 Raw response:`, data);
    
    if (response.ok) {
      try {
        const jsonData = JSON.parse(data);
        console.log(`✅ Parsed JSON:`, jsonData);
      } catch (e) {
        console.log(`❌ Failed to parse as JSON:`, e.message);
      }
    } else {
      console.log(`❌ Request failed with status ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Also test the clients endpoint
async function testClientsEndpoint() {
  console.log('🧪 Testing clients endpoint...');
  
  try {
    console.log(`📡 Testing: ${API_URL}/api/clients`);
    
    const response = await fetch(`${API_URL}/api/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add your JWT token here: 'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    const data = await response.text();
    console.log(`📊 Raw response:`, data);
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run tests
console.log('🚀 Starting endpoint tests...');
testMeetingsEndpoint();
testClientsEndpoint();

console.log(`
📝 To test with authentication:
1. Open your browser dev tools on the Advicly app
2. Go to Application > Local Storage
3. Copy the 'jwt' value
4. Replace 'YOUR_JWT_TOKEN' in this script with that value
5. Run this script again with: node test-meetings-endpoint.js
`);
