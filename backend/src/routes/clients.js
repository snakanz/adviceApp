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

// GET /api/clients - returns all unique clients (grouped by email) from both clients table and meeting attendees
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;

    // 1. Get all real clients from the clients table
    const dbClientsResult = await pool.query(
      'SELECT id, name, emails, likely_value, business_type, likely_close_month, email, ai_summary, created_at, updated_at FROM clients WHERE advisor_id = $1',
      [advisorId]
    );
    const dbClients = dbClientsResult.rows;

    // 2. Get all meetings for this advisor
    const meetingsResult = await pool.query('SELECT id, title, starttime, endtime, attendees FROM meetings WHERE userid = $1', [advisorId]);
    const meetings = meetingsResult.rows;

    // 3. Build a map: email -> client object
    const clientsMap = {};
    // Add DB clients first
    dbClients.forEach(client => {
      const emails = client.emails && client.emails.length ? client.emails : (client.email ? [client.email] : []);
      emails.forEach(email => {
        if (!clientsMap[email]) {
          clientsMap[email] = { ...client, emails: emails.slice(), meetings: [] };
        }
      });
    });
    // Add meeting attendees
    meetings.forEach(meeting => {
      let attendees = [];
      try { attendees = JSON.parse(meeting.attendees || '[]'); } catch { attendees = []; }
      attendees.forEach(att => {
        if (att && att.email && att.email !== decoded.email) {
          if (!clientsMap[att.email]) {
            clientsMap[att.email] = {
              emails: [att.email],
              name: att.displayName || '',
              meetings: [],
            };
          }
          // Add meeting info
          clientsMap[att.email].meetings.push({
            id: meeting.id,
            title: meeting.title,
            starttime: meeting.starttime,
            endtime: meeting.endtime
          });
        }
      });
    });
    // Convert to array
    const allClients = Object.values(clientsMap);
    res.json(allClients);
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