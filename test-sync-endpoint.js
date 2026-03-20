// Test script for sync-with-deletions endpoint
const API_URL = 'https://adviceapp-9rgw.onrender.com';

async function testSyncEndpoint() {
  console.log('🧪 Testing sync-with-deletions endpoint...');
  
  // You'll need to replace this with your actual JWT token
  const token = 'YOUR_JWT_TOKEN_HERE';
  
  try {
    const response = await fetch(`${API_URL}/api/calendar/sync-with-deletions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run the test
testSyncEndpoint();
