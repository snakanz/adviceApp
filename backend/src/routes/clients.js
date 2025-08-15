const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../lib/supabase');

const router = express.Router();

// Get all clients for an advisor with their meetings
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get all clients for this advisor
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('advisor_id', userId)
      .order('name');

    if (clientsError) {
      throw clientsError;
    }

    // Get meetings for each client
    const clientsWithMeetings = await Promise.all(
      clients.map(async (client) => {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('id, title, starttime, endtime, summary, transcript')
          .eq('client_id', client.id);

        return {
          ...client,
          meeting_count: meetings?.length || 0,
          meetings: meetings || []
        };
      })
    );

    const formattedClients = clientsWithMeetings.map(client => ({
      id: client.id,
      email: client.email,
      name: client.name || client.email,
      business_type: client.business_type || '',
      likely_value: client.likely_value || '',
      likely_close_month: client.likely_close_month || '',
      meeting_count: client.meeting_count,
      meetings: client.meetings,
      created_at: client.created_at,
      updated_at: client.updated_at
    }));

    res.json(formattedClients);
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

    // Upsert client using Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .upsert({
        advisor_id: advisorId,
        email: email,
        name: name,
        business_type: business_type,
        likely_value: likely_value,
        likely_close_month: likely_close_month,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'advisor_id,email'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(client);
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

    // Update or create client using Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .upsert({
        advisor_id: advisorId,
        email: email,
        name: name,
        business_type: business_type,
        likely_value: likely_value,
        likely_close_month: likely_close_month,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'advisor_id,email'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
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

    // Build update object dynamically
    const updateData = { updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name;
    if (emails !== undefined) updateData.emails = emails;
    if (business_type !== undefined) updateData.business_type = business_type;
    if (likely_value !== undefined) updateData.likely_value = likely_value;
    if (likely_close_month !== undefined) updateData.likely_close_month = likely_close_month;

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update client using Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Client not found' });
      }
      throw error;
    }

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

module.exports = router; 