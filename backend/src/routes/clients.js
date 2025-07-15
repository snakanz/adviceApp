const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
// const { Configuration, OpenAIApi } = require('openai');
// const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

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
    const userEmail = decoded.email;

    // Get all meetings for this advisor
    const result = await pool.query('SELECT id, title, starttime, endtime, attendees, client_name FROM meetings WHERE userid = $1', [userId]);
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
        // Use email as unique key, skip advisor's own email
        if (att && att.email && att.email !== userEmail) {
          if (!clientsMap[att.email]) {
            clientsMap[att.email] = { email: att.email, name: '', meetings: [] };
          }
          // Use client_name from meetings table if available, otherwise use displayName from attendees
          if (meeting.client_name && !clientsMap[att.email].name) {
            clientsMap[att.email].name = meeting.client_name;
          } else if (att.displayName && !clientsMap[att.email].name) {
            clientsMap[att.email].name = att.displayName;
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

// POST /api/clients/:clientEmail/ai-summary - generate/update AI summary for a client
router.post('/:clientEmail/ai-summary', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientEmail = req.params.clientEmail;

    // Gather all meetings and transcripts for this client
    const meetingsResult = await pool.query(
      `SELECT m.id, m.title, m.starttime, m.transcript, m.summary, m.attendees
       FROM meetings m
       WHERE m.userid = $1`,
      [advisorId]
    );
    const meetings = meetingsResult.rows.filter(mtg => {
      // Check if this meeting includes the client as an attendee
      let attendees = [];
      try { attendees = JSON.parse(mtg.attendees || '[]'); } catch { attendees = []; }
      return attendees.some(att => att && att.email === clientEmail);
    });

    if (meetings.length === 0) {
      return res.status(404).json({ error: 'No meetings found for this client.' });
    }

    // Build prompt for OpenAI
    let prompt = `You are an expert client relationship assistant. Summarize the following meetings for client ${clientEmail}. Focus on key themes, business discussed, and important notes.\n`;
    meetings.forEach((mtg, idx) => {
      prompt += `\nMeeting ${idx + 1}:\nTitle: ${mtg.title}\nDate: ${mtg.starttime}\n`;
      if (mtg.transcript) {
        prompt += `Transcript: ${mtg.transcript}\n`;
      } else if (mtg.summary) {
        prompt += `Summary: ${mtg.summary}\n`;
      }
    });
    prompt += '\nProvide a concise summary for the advisor.';

    // Call OpenAI
    // const response = await openai.createChatCompletion({
    //   model: 'gpt-4',
    //   messages: [
    //     { role: 'system', content: 'You are a professional client summary assistant.' },
    //     { role: 'user', content: prompt }
    //   ],
    //   max_tokens: 500,
    //   temperature: 0.7
    // });
    // const aiSummary = response.data.choices[0].message.content;

    // Upsert into clients table
    // Try to get client name from meetings
    let clientName = '';
    for (const mtg of meetings) {
      let attendees = [];
      try { attendees = JSON.parse(mtg.attendees || '[]'); } catch { attendees = []; }
      const found = attendees.find(att => att && att.email === clientEmail && att.displayName);
      if (found) { clientName = found.displayName; break; }
    }
    // await pool.query(
    //   `INSERT INTO clients (advisor_id, email, name, ai_summary, created_at, updated_at)
    //    VALUES ($1, $2, $3, $4, NOW(), NOW())
    //    ON CONFLICT (advisor_id, email)
    //    DO UPDATE SET name = $3, ai_summary = $4, updated_at = NOW()`,
    //   [advisorId, clientEmail, clientName, aiSummary]
    // );

    // res.json({ success: true, ai_summary: aiSummary });
    res.json({ success: true, message: 'AI summary generation is currently disabled.' });
  } catch (error) {
    console.error('Error generating AI summary for client:', error);
    res.status(500).json({ error: 'Failed to generate AI summary.' });
  }
});

// POST /api/clients/upsert - upsert a client by email for the advisor
router.post('/upsert', async (req, res) => {
  console.log('--- CLIENT UPSERT DEBUG ---');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { email, name, likely_value, business_type } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Check if client exists
    console.log('Checking for existing client with advisorId and email:', advisorId, email);
    const existing = await pool.query('SELECT * FROM clients WHERE advisor_id = $1 AND email = $2', [advisorId, email]);
    let client;
    if (existing.rows.length > 0) {
      // Update name, likely_value, business_type
      console.log('Updating client with:', [name, likely_value, business_type, advisorId, email]);
      const result = await pool.query(
        'UPDATE clients SET name = $1, likely_value = $2, business_type = $3, updated_at = NOW() WHERE advisor_id = $4 AND email = $5 RETURNING *',
        [name, likely_value, business_type, advisorId, email]
      );
      console.log('Update result:', result.rows);
      client = result.rows[0];
    } else {
      // Insert new client
      console.log('Inserting client with:', [advisorId, email, name, likely_value, business_type]);
      const result = await pool.query(
        'INSERT INTO clients (advisor_id, email, name, likely_value, business_type, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
        [advisorId, email, name, likely_value, business_type]
      );
      console.log('Insert result:', result.rows);
      client = result.rows[0];
    }
    console.log('Upserted client:', client); // Debug log
    res.json(client);
  } catch (error) {
    console.error('Error upserting client:', error);
    res.status(500).json({ error: 'Failed to upsert client', details: error.message });
  }
});

// POST /api/clients/update-name - update client name in meetings table
router.post('/update-name', async (req, res) => {
  console.log('Update client name request:', req.body);
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Update client_name in meetings table for all meetings with this client
    const result = await pool.query(
      `UPDATE meetings 
       SET client_name = $1, updated_at = NOW() 
       WHERE userid = $2 AND attendees LIKE $3`,
      [name, advisorId, `%${email}%`]
    );

    console.log(`Updated ${result.rowCount} meetings for client ${email} with name ${name}`);
    
    res.json({ 
      success: true, 
      message: `Updated client name to "${name}" for ${result.rowCount} meetings`,
      updatedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Error updating client name:', error);
    res.status(500).json({ error: 'Failed to update client name', details: error.message });
  }
});

// PATCH /api/clients/:clientId - update client details
router.patch('/:clientId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientId = req.params.clientId;
    const { name, emails, likely_value, business_type, likely_close_month } = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name'); values.push(name); }
    if (emails !== undefined) { fields.push('emails'); values.push(emails); }
    if (likely_value !== undefined) { fields.push('likely_value'); values.push(likely_value); }
    if (business_type !== undefined) { fields.push('business_type'); values.push(business_type); }
    if (likely_close_month !== undefined) { fields.push('likely_close_month'); values.push(likely_close_month); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Add updated_at
    fields.push('updated_at');
    values.push(new Date());

    // Build SET clause
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(clientId, advisorId);

    const result = await pool.query(
      `UPDATE clients SET ${setClause} WHERE id = $${fields.length + 1} AND advisor_id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

module.exports = router; 