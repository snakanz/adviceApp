/**
 * Environment Variables Verification Script
 * 
 * This script runs during the build process to verify that all required
 * environment variables are present. If any are missing, the build will
 * fail with a clear error message.
 * 
 * Run this with: node verify-env.js
 */

const requiredEnvVars = [
  {
    name: 'REACT_APP_SUPABASE_URL',
    description: 'Supabase project URL',
    example: 'https://xjqjzievgepqpgtggcjx.supabase.co'
  },
  {
    name: 'REACT_APP_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous/public key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  {
    name: 'REACT_APP_API_BASE_URL',
    description: 'Backend API base URL',
    example: 'https://adviceapp-9rgw.onrender.com'
  },
  {
    name: 'REACT_APP_STRIPE_PUBLIC_KEY',
    description: 'Stripe publishable key (test or live)',
    example: 'pk_test_51S0eaJ58eL7gey1h...'
  },
  {
    name: 'REACT_APP_STRIPE_PRICE_ID',
    description: 'Stripe monthly subscription price ID',
    example: 'price_1SPnun58eL7gey1h3Grxuo4T'
  },
  {
    name: 'REACT_APP_STRIPE_PRICE_ID_ANNUAL',
    description: 'Stripe annual subscription price ID',
    example: 'price_1SQCkS58eL7gey1hMqV8qURW'
  }
];

console.log('\n=== Environment Variables Verification ===\n');

let hasErrors = false;
const results = [];

requiredEnvVars.forEach(({ name, description, example }) => {
  const value = process.env[name];
  const isPresent = !!value;
  const status = isPresent ? '✅' : '❌';
  
  if (!isPresent) {
    hasErrors = true;
  }
  
  results.push({
    name,
    description,
    status,
    isPresent,
    value: value ? `${value.substring(0, 20)}...` : 'MISSING',
    example
  });
  
  console.log(`${status} ${name}`);
  console.log(`   Description: ${description}`);
  console.log(`   Value: ${value ? `${value.substring(0, 30)}...` : 'MISSING'}`);
  if (!isPresent) {
    console.log(`   Example: ${example}`);
  }
  console.log('');
});

console.log('=== Summary ===\n');
console.log(`Total variables checked: ${requiredEnvVars.length}`);
console.log(`Present: ${results.filter(r => r.isPresent).length}`);
console.log(`Missing: ${results.filter(r => !r.isPresent).length}`);
console.log('');

if (hasErrors) {
  console.error('❌ ERROR: Missing required environment variables!\n');
  console.error('Please set the following environment variables in Cloudflare Pages:');
  console.error('1. Go to: https://dash.cloudflare.com/');
  console.error('2. Select your project');
  console.error('3. Settings → Environment variables → Production');
  console.error('4. Add the missing variables listed above');
  console.error('5. Trigger a new deployment\n');
  
  console.error('Missing variables:');
  results.filter(r => !r.isPresent).forEach(({ name, example }) => {
    console.error(`  - ${name} (example: ${example})`);
  });
  console.error('');
  
  process.exit(1);
} else {
  console.log('✅ All required environment variables are present!\n');
  process.exit(0);
}

