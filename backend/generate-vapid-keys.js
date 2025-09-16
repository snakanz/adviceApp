const webpush = require('web-push');

// Generate VAPID keys for push notifications
const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 VAPID Keys Generated for Push Notifications');
console.log('');
console.log('Add these to your .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:simon@greenwood.co.nz`);
console.log('');
console.log('Add this to your frontend .env file:');
console.log('');
console.log(`REACT_APP_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log('');
console.log('⚠️  Keep the private key secure and never expose it in frontend code!');
