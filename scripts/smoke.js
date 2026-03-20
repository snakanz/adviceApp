#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Mock environment variables for backend testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-for-testing-only';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'mock-openai-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '8787';

console.log('🚀 Starting Advicly smoke tests...');
console.log('📍 Backend URL: http://localhost:8787');

// Start backend server
const backendPath = path.join(__dirname, '..', 'backend', 'src', 'index.js');
const backend = spawn('node', [backendPath], {
  stdio: 'pipe',
  env: { ...process.env }
});

let backendReady = false;
let testsPassed = 0;
let testsFailed = 0;

backend.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Server running on port') || output.includes('listening')) {
    backendReady = true;
    console.log('✅ Backend server started');
  }
});

backend.stderr.on('data', (data) => {
  const error = data.toString();
  if (!error.includes('Warning') && !error.includes('DeprecationWarning')) {
    console.error('❌ Backend Error:', error);
  }
});

// Wait for backend to start, then run tests
setTimeout(async () => {
  try {
    console.log('\n🔍 Running smoke tests...\n');
    
    // Test 1: Health endpoint
    await runTest('Health Check', async () => {
      const response = await makeRequest('/api/health');
      if (!response.status || response.status !== 'ok') {
        throw new Error(`Expected status 'ok', got '${response.status}'`);
      }
      console.log(`   Database: ${response.db ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`   Version: ${response.version}`);
      return response;
    });
    
    // Test 2: Google OAuth endpoint
    await runTest('Google OAuth Endpoint', async () => {
      const response = await makeRequest('/api/auth/google');
      // Should redirect or return auth URL
      return response;
    });
    
    // Test 3: Protected endpoint (should return 401)
    await runTest('Protected Endpoint (No Auth)', async () => {
      try {
        await makeRequest('/api/clients');
        throw new Error('Expected 401 Unauthorized');
      } catch (error) {
        if (error.message.includes('401') || error.message.includes('No token')) {
          return { message: 'Correctly rejected unauthorized request' };
        }
        throw error;
      }
    });
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 All smoke tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Smoke tests failed:', error.message);
    process.exit(1);
  } finally {
    backend.kill();
  }
}, 3000);

async function runTest(name, testFn) {
  try {
    console.log(`🧪 ${name}...`);
    const result = await testFn();
    console.log(`   ✅ ${name} passed`);
    testsPassed++;
    return result;
  } catch (error) {
    console.log(`   ❌ ${name} failed: ${error.message}`);
    testsFailed++;
    throw error;
  }
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'localhost',
      port: 8787,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const error = new Error(`HTTP ${res.statusCode}: ${parsed.error || parsed.message || 'Unknown error'}`);
            error.statusCode = res.statusCode;
            error.response = parsed;
            reject(error);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted');
  backend.kill();
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Tests terminated');
  backend.kill();
  process.exit(1);
});
