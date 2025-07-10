const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Use the same pool as in index.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/clients - returns unique clients (by attendee email) and their meetings
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get all meetings for this advisor
    const result = await pool.query('SELECT id, title, starttime, endtime, attendees FROM meetings WHERE userid = $1', [userId]);
    const meetings = result.rows;

    // Map: email -> { email, meetings: [] }
    const clientsMap = {};
    meetings.forEach(meeting => {
      let attendees = [];
      try {
        attendees = JSON.parse(meeting.attendees || '[]');
      } catch (e) {
        attendees = [];
      }
      attendees.forEach(att => {
        // Use email as unique key
        if (att && att.email) {
          if (!clientsMap[att.email]) {
            clientsMap[att.email] = { email: att.email, name: att.displayName || '', meetings: [] };
          }
          clientsMap[att.email].meetings.push({
            id: meeting.id,
            title: meeting.title,
            starttime: meeting.starttime,
            endtime: meeting.endtime
          });
        }
      });
    });

    // Return as array
    res.json(Object.values(clientsMap));
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

module.exports = router; 