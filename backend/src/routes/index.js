const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const calendarRoutes = require('./calendar');
const askAdviclyRoutes = require('./ask-advicly');

// Mount routes
router.use('/auth', authRoutes);
router.use('/calendar', calendarRoutes);
router.use('/ask-advicly', askAdviclyRoutes);

module.exports = router;
