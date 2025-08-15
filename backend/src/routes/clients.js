const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Get all clients for an advisor with their meetings
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get all clients for this advisor with their pipeline data and meeting counts
    const result = await pool.query(`
      SELECT 
        c.id,
        c.email,
        c.name,
        c.business_type,
        c.likely_value,
        c.likely_close_month,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as meeting_count,
        ARRAY_AGG(
          CASE WHEN m.id IS NOT NULL THEN 
            json_build_object(
              'id', m.id,
              'title', m.title,
              'starttime', m.starttime,
              'endtime', m.endtime,
              'summary', m.summary,
              'transcript', m.transcript
            )
          END
        ) FILTER (WHERE m.id IS NOT NULL) as meetings
      FROM clients c
      LEFT JOIN meetings m ON c.id = m.client_id
      WHERE c.advisor_id = $1
      GROUP BY c.id, c.email, c.name, c.business_type, c.likely_value, c.likely_close_month, c.created_at, c.updated_at
      ORDER BY c.name
    `, [userId]);

    const clients = result.rows.map(client => ({
      id: client.id,
      email: client.email,
      name: client.name || client.email,
      business_type: client.business_type || '',
      likely_value: client.likely_value || '',
      likely_close_month: client.likely_close_month ? 
        client.likely_close_month.toISOString().slice(0, 7) : '', // Convert DATE to YYYY-MM format
      meeting_count: parseInt(client.meeting_count) || 0,
      meetings: client.meetings || [],
      created_at: client.created_at,
      updated_at: client.updated_at
    }));

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients', details: error.message });
  }
});

// Upsert client (create or update)
router.post('/upsert', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { email, name, business_type, likely_value, likely_close_month } = req.body;
    
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Convert likely_close_month from YYYY-MM to YYYY-MM-01 format for database
    let formattedCloseMonth = likely_close_month;
    if (likely_close_month && likely_close_month.match(/^\d{4}-\d{2}$/)) {
      formattedCloseMonth = `${likely_close_month}-01`;
    }

    // Check if client exists
    const existing = await pool.query('SELECT * FROM clients WHERE advisor_id = $1 AND email = $2', [advisorId, email]);
    let client;
    
    if (existing.rows.length > 0) {
      // Update existing client
      const result = await pool.query(
        `UPDATE clients 
         SET name = $1, business_type = $2, likely_value = $3, likely_close_month = $4, updated_at = NOW() 
         WHERE advisor_id = $5 AND email = $6 
         RETURNING *`,
        [name, business_type, likely_value, formattedCloseMonth, advisorId, email]
      );
      client = result.rows[0];
    } else {
      // Insert new client
      const result = await pool.query(
        `INSERT INTO clients (advisor_id, email, name, business_type, likely_value, likely_close_month, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
         RETURNING *`,
        [advisorId, email, name, business_type, likely_value, formattedCloseMonth]
      );
      client = result.rows[0];
    }

    // Format the response to include properly formatted likely_close_month
    const formattedClient = {
      ...client,
      likely_close_month: client.likely_close_month ? 
        client.likely_close_month.toISOString().slice(0, 7) : ''
    };
    res.json(formattedClient);
  } catch (error) {
    console.error('Error upserting client:', error);
    res.status(500).json({ error: 'Failed to upsert client', details: error.message });
  }
});

// Update client name and pipeline data
router.post('/update-name', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { email, name, business_type, likely_value, likely_close_month } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Convert likely_close_month from YYYY-MM to YYYY-MM-01 format for database
    let formattedCloseMonth = likely_close_month;
    if (likely_close_month && likely_close_month.match(/^\d{4}-\d{2}$/)) {
      formattedCloseMonth = `${likely_close_month}-01`;
    }

    // Update client in clients table
    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, business_type = $2, likely_value = $3, likely_close_month = $4, updated_at = NOW() 
       WHERE advisor_id = $5 AND email = $6 
       RETURNING *`,
      [name, business_type, likely_value, formattedCloseMonth, advisorId, email]
    );

    if (result.rowCount === 0) {
      // Client doesn't exist, create it
      const insertResult = await pool.query(
        `INSERT INTO clients (advisor_id, email, name, business_type, likely_value, likely_close_month, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
         RETURNING *`,
        [advisorId, email, name, business_type, likely_value, formattedCloseMonth]
      );
      return res.json(insertResult.rows[0]);
    }

    // Format the response to include properly formatted likely_close_month
    const client = result.rows[0];
    const formattedClient = {
      ...client,
      likely_close_month: client.likely_close_month ? 
        client.likely_close_month.toISOString().slice(0, 7) : ''
    };
    res.json(formattedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

// Get specific client by ID
router.get('/:clientId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const clientId = req.params.clientId;

    // Get client details
    const result = await pool.query(`
      SELECT 
        c.id,
        c.email,
        c.name,
        c.business_type,
        c.likely_value,
        c.likely_close_month,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as meeting_count
      FROM clients c
      LEFT JOIN meetings m ON c.id = m.client_id
      WHERE c.id = $1 AND c.advisor_id = $2
      GROUP BY c.id, c.email, c.name, c.business_type, c.likely_value, c.likely_close_month, c.created_at, c.updated_at
    `, [clientId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = result.rows[0];
    const formattedClient = {
      id: client.id,
      email: client.email,
      name: client.name || client.email,
      business_type: client.business_type || '',
      likely_value: client.likely_value || '',
      likely_close_month: client.likely_close_month ? 
        client.likely_close_month.toISOString().slice(0, 7) : '',
      meeting_count: parseInt(client.meeting_count) || 0,
      created_at: client.created_at,
      updated_at: client.updated_at
    };

    res.json(formattedClient);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client', details: error.message });
  }
});

// Get meetings for a specific client
router.get('/:clientId/meetings', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const clientId = req.params.clientId;

    // Verify client belongs to this advisor
    const clientCheck = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND advisor_id = $2',
      [clientId, userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get meetings for this client - using only existing columns
    const result = await pool.query(`
      SELECT 
        m.id,
        m.title,
        m.summary,
        m.transcript,
        m.starttime,
        m.endtime,
        m.attendees,
        m.created_at
      FROM meetings m
      WHERE m.client_id = $1
      ORDER BY m.starttime DESC
    `, [clientId]);

    const meetings = result.rows.map(meeting => ({
      id: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      transcript: meeting.transcript,
      starttime: meeting.starttime,
      endtime: meeting.endtime,
      attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
      created_at: meeting.created_at
    }));

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching client meetings:', error);
    res.status(500).json({ error: 'Failed to fetch client meetings', details: error.message });
  }
});

// Update specific client by ID
router.put('/:clientId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientId = req.params.clientId;
    const { name, emails, business_type, likely_value, likely_close_month } = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push('name'); values.push(name); paramIndex++; }
    if (emails !== undefined) { fields.push('emails'); values.push(emails); paramIndex++; }
    if (business_type !== undefined) { fields.push('business_type'); values.push(business_type); paramIndex++; }
    if (likely_value !== undefined) { fields.push('likely_value'); values.push(likely_value); paramIndex++; }
    if (likely_close_month !== undefined) { 
      // Convert likely_close_month from YYYY-MM to YYYY-MM-01 format for database
      let formattedCloseMonth = likely_close_month;
      if (likely_close_month && likely_close_month.match(/^\d{4}-\d{2}$/)) {
        formattedCloseMonth = `${likely_close_month}-01`;
      }
      fields.push('likely_close_month'); 
      values.push(formattedCloseMonth); 
      paramIndex++; 
    }
    
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Add updated_at
    fields.push('updated_at');
    values.push(new Date());

    // Build SET clause
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(clientId, advisorId);

    const query = `
      UPDATE clients 
      SET ${setClause} 
      WHERE id = $${paramIndex} AND advisor_id = $${paramIndex + 1} 
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Format the response to include properly formatted likely_close_month
    const client = result.rows[0];
    const formattedClient = {
      ...client,
      likely_close_month: client.likely_close_month ? 
        client.likely_close_month.toISOString().slice(0, 7) : ''
    };
    res.json(formattedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

module.exports = router; 