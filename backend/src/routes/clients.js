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
        // Use email as unique key, skip advisor's own email
        if (att && att.email && att.email !== userEmail) {
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

module.exports = router; 