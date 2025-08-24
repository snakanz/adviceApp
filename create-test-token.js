// Create a test JWT token for user 1
require('dotenv').config();
const jwt = require('jsonwebtoken');

const userId = 1;
const email = 'snaka1003@gmail.com';
const name = 'Test User';

const token = jwt.sign(
  { id: userId, email, name },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔑 Generated JWT token for user 1:');
console.log(token);
console.log('\n📋 Use this token in Authorization header:');
console.log(`Bearer ${token}`);
