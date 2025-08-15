require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');

// Get pipeline data grouped by month
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    console.log('Pipeline request for userId:', userId);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // For now, return empty pipeline data since we don't have a clients table with pipeline data
    const pipelineByMonth = {};
    let totalValue = 0;
    let totalClients = 0;

    // Convert to array and sort by month
    const months = Object.values(pipelineByMonth).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Calculate summary statistics
    const summary = {
      totalValue: totalValue,
      totalClients: totalClients,
      averageValue: totalClients > 0 ? totalValue / totalClients : 0,
      months: months
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data', details: error.message });
  }
});

module.exports = router; 