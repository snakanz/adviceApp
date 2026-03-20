const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const calendarRoutes = require('./calendar');
const calendlyRoutes = require('./calendly');
const askAdviclyRoutes = require('./ask-advicly');
const tenantRoutes = require('./tenants');
const adminRoutes = require('./admin');

// Mount routes
console.log('🔄 Mounting routes...');
router.use('/auth', authRoutes);
console.log('✅ Auth routes mounted');
router.use('/calendar', calendarRoutes);
console.log('✅ Calendar routes mounted');
router.use('/calendly', calendlyRoutes);
console.log('✅ Calendly routes mounted');
router.use('/ask-advicly', askAdviclyRoutes);
console.log('✅ Ask Advicly routes mounted');
router.use('/tenants', tenantRoutes);
console.log('✅ Tenant routes mounted');

// Mount billing routes
const billingRoutes = require('./billing');
router.use('/billing', billingRoutes);
console.log('✅ Billing routes mounted');

// Mount admin routes
router.use('/admin', adminRoutes);
console.log('✅ Admin routes mounted');

module.exports = router;
