require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Get pipeline data grouped by month
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    
    console.log('Pipeline request for userId:', userId);

    // Get all clients with pipeline data, grouped by likely_close_month
    // Use a more robust approach with explicit type handling
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.business_type,
        CASE 
          WHEN c.likely_value IS NULL THEN NULL
          WHEN c.likely_value::text = '' THEN NULL
          WHEN c.likely_value <= 0 THEN NULL
          ELSE c.likely_value
        END as likely_value,
        c.likely_close_month,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as meeting_count
      FROM clients c
      LEFT JOIN meetings m ON c.id = m.client_id
      WHERE c.advisor_id = $1
        AND c.likely_close_month IS NOT NULL
        AND c.likely_value IS NOT NULL
        AND c.likely_value::text != ''
        AND c.likely_value > 0
      GROUP BY c.id, c.name, c.email, c.business_type, c.likely_value, c.likely_close_month, c.created_at, c.updated_at
      ORDER BY c.likely_close_month, c.name
    `, [userId]);

    // Group clients by month
    const pipelineByMonth = {};
    let totalValue = 0;
    let totalClients = 0;

    result.rows.forEach(client => {
      // Additional validation to ensure we have valid data
      if (!client.likely_close_month || !client.likely_value) {
        console.warn('Skipping client with invalid data:', client.id, {
          likely_close_month: client.likely_close_month,
          likely_value: client.likely_value
        });
        return;
      }

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

      // Additional validation to ensure likely_value is a valid number
      const clientValue = parseFloat(client.likely_value);
      if (isNaN(clientValue) || clientValue <= 0) {
        console.warn('Invalid likely_value for client:', client.id, client.likely_value);
        return; // Skip this client
      }

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