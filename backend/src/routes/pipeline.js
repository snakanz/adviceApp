const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../index');

// Get pipeline data grouped by month
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get all clients with pipeline data, grouped by likely_close_month
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.business_type,
        c.likely_value,
        c.likely_close_month,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as meeting_count
      FROM clients c
      LEFT JOIN meetings m ON c.id = m.client_id
      WHERE c.advisor_id = $1
        AND c.likely_close_month IS NOT NULL
        AND c.likely_value IS NOT NULL
      GROUP BY c.id, c.name, c.email, c.business_type, c.likely_value, c.likely_close_month, c.created_at, c.updated_at
      ORDER BY c.likely_close_month, c.name
    `, [userId]);

    // Group clients by month
    const pipelineByMonth = {};
    let totalValue = 0;
    let totalClients = 0;

    result.rows.forEach(client => {
      if (client.likely_close_month) {
        const monthKey = client.likely_close_month.toISOString().slice(0, 7); // YYYY-MM format
        const monthName = client.likely_close_month.toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric' 
        });

        if (!pipelineByMonth[monthKey]) {
          pipelineByMonth[monthKey] = {
            month: monthName,
            monthKey: monthKey,
            clients: [],
            totalValue: 0,
            clientCount: 0
          };
        }

        const clientValue = parseFloat(client.likely_value) || 0;
        pipelineByMonth[monthKey].clients.push({
          id: client.id,
          name: client.name,
          email: client.email,
          business_type: client.business_type,
          likely_value: client.likely_value,
          likely_close_month: client.likely_close_month,
          meeting_count: parseInt(client.meeting_count) || 0
        });
        pipelineByMonth[monthKey].totalValue += clientValue;
        pipelineByMonth[monthKey].clientCount += 1;
        totalValue += clientValue;
        totalClients += 1;
      }
    });

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