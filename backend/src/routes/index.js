const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const calendarRoutes = require('./calendar');

// Mount routes
router.use('/auth', authRoutes);
router.use('/calendar', calendarRoutes);

module.exports = router;
