const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all clients for an advisor with their meetings
router.get('/', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // First, get all client IDs that have meetings
    const { data: clientsWithMeetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('client_id')
      .eq('userid', userId)
      .not('client_id', 'is', null);

    if (meetingsError) {
      console.error('Error fetching clients with meetings:', meetingsError);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    // Extract unique client IDs
    const clientIds = [...new Set(clientsWithMeetings.map(m => m.client_id))];

    if (clientIds.length === 0) {
      // No clients with meetings found
      return res.json([]);
    }

    // Get clients who have meetings (only show clients with actual meetings)
    const { data: clients, error: clientsError } = await getSupabase()
      .from('clients')
      .select(`
        *,
        meetings:meetings(
          id,
          googleeventid,
          title,
          starttime,
          endtime,
          summary,
          transcript,
          quick_summary,
          email_summary_draft,
          action_points
        )
      `)
      .eq('advisor_id', userId)
      .in('id', clientIds) // Only include clients who have meetings
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    // Format the response to match the expected structure
    const formattedClients = (clients || []).map(client => ({
      id: client.id,
      email: client.email,
      name: client.name,
      business_type: client.business_type,
      likely_value: client.likely_value,
      likely_close_month: client.likely_close_month,
      pipeline_stage: client.pipeline_stage,
      priority_level: client.priority_level,
      last_contact_date: client.last_contact_date,
      next_follow_up_date: client.next_follow_up_date,
      notes: client.notes,
      tags: client.tags,
      source: client.source,
      is_active: client.is_active,
      meeting_count: client.meeting_count || (client.meetings ? client.meetings.length : 0),
      active_meeting_count: client.active_meeting_count,
      last_meeting_date: client.last_meeting_date,
      created_at: client.created_at,
      updated_at: client.updated_at,
      meetings: (client.meetings || []).map(meeting => ({
        id: meeting.googleeventid,
        title: meeting.title,
        starttime: meeting.starttime,
        endtime: meeting.endtime,
        summary: meeting.summary,
        transcript: meeting.transcript,
        quick_summary: meeting.quick_summary,
        email_summary_draft: meeting.email_summary_draft,
        action_points: meeting.action_points
      }))
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

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Check if client already exists
    const { data: existingClient, error: checkError } = await getSupabase()
      .from('clients')
      .select('id')
      .eq('advisor_id', advisorId)
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing client:', checkError);
      return res.status(500).json({ error: 'Failed to check existing client' });
    }

    if (existingClient) {
      // Update existing client
      const { data: updatedClient, error: updateError } = await getSupabase()
        .from('clients')
        .update({
          name: name || null,
          business_type: business_type || null,
          likely_value: likely_value || null,
          likely_close_month: likely_close_month || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingClient.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating client:', updateError);
        return res.status(500).json({ error: 'Failed to update client' });
      }

      res.json({ message: 'Client updated successfully', client: updatedClient });
    } else {
      // Create new client
      const { data: newClient, error: insertError } = await getSupabase()
        .from('clients')
        .insert({
          advisor_id: advisorId,
          email: email,
          name: name || null,
          business_type: business_type || null,
          likely_value: likely_value || null,
          likely_close_month: likely_close_month || null,
          pipeline_stage: 'unscheduled',
          priority_level: 3
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating client:', insertError);
        return res.status(500).json({ error: 'Failed to create client' });
      }

      res.json({ message: 'Client created successfully', client: newClient });
    }
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

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Find and update the client
    const { data: updatedClient, error: updateError } = await getSupabase()
      .from('clients')
      .update({
        name: name,
        business_type: business_type || null,
        likely_value: likely_value || null,
        likely_close_month: likely_close_month || null,
        updated_at: new Date().toISOString()
      })
      .eq('advisor_id', advisorId)
      .eq('email', email)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return res.status(500).json({ error: 'Failed to update client' });
    }

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client updated successfully', client: updatedClient });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

// Get specific client by ID (can be UUID or email for backward compatibility)
router.get('/:clientId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const clientIdentifier = decodeURIComponent(req.params.clientId);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Try to find client by ID first, then by email for backward compatibility
    let clientQuery = getSupabase()
      .from('clients')
      .select(`
        *,
        meetings:meetings(
          id,
          googleeventid,
          title,
          starttime,
          endtime,
          summary,
          transcript,
          quick_summary,
          email_summary_draft,
          action_points
        )
      `)
      .eq('advisor_id', userId);

    // Check if clientIdentifier looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientIdentifier);

    if (isUUID) {
      clientQuery = clientQuery.eq('id', clientIdentifier);
    } else {
      // Assume it's an email
      clientQuery = clientQuery.eq('email', clientIdentifier);
    }

    const { data: client, error: clientError } = await clientQuery.single();

    if (clientError) {
      if (clientError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Client not found' });
      }
      console.error('Error fetching client:', clientError);
      return res.status(500).json({ error: 'Failed to fetch client' });
    }

    // Format the response
    const formattedClient = {
      id: client.id,
      email: client.email,
      name: client.name,
      business_type: client.business_type,
      likely_value: client.likely_value,
      likely_close_month: client.likely_close_month,
      pipeline_stage: client.pipeline_stage,
      priority_level: client.priority_level,
      last_contact_date: client.last_contact_date,
      next_follow_up_date: client.next_follow_up_date,
      notes: client.notes,
      tags: client.tags,
      source: client.source,
      is_active: client.is_active,
      meeting_count: client.meeting_count || (client.meetings ? client.meetings.length : 0),
      active_meeting_count: client.active_meeting_count,
      last_meeting_date: client.last_meeting_date,
      created_at: client.created_at,
      updated_at: client.updated_at,
      meetings: (client.meetings || []).map(meeting => ({
        id: meeting.googleeventid,
        title: meeting.title,
        starttime: meeting.starttime,
        endtime: meeting.endtime,
        summary: meeting.summary,
        transcript: meeting.transcript,
        quick_summary: meeting.quick_summary,
        email_summary_draft: meeting.email_summary_draft,
        action_points: meeting.action_points
      }))
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
    const clientIdentifier = decodeURIComponent(req.params.clientId);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // First, find the client to get their UUID
    let clientQuery = getSupabase()
      .from('clients')
      .select('id')
      .eq('advisor_id', userId);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientIdentifier);

    if (isUUID) {
      clientQuery = clientQuery.eq('id', clientIdentifier);
    } else {
      clientQuery = clientQuery.eq('email', clientIdentifier);
    }

    const { data: client, error: clientError } = await clientQuery.single();

    if (clientError) {
      if (clientError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Client not found' });
      }
      console.error('Error fetching client:', clientError);
      return res.status(500).json({ error: 'Failed to fetch client' });
    }

    // Get meetings for this client
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .eq('client_id', client.id)
      .order('starttime', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    // Format the meetings
    const formattedMeetings = (meetings || []).map(meeting => ({
      id: meeting.googleeventid,
      title: meeting.title,
      starttime: meeting.starttime,
      endtime: meeting.endtime,
      summary: meeting.summary,
      transcript: meeting.transcript,
      quick_summary: meeting.quick_summary,
      email_summary_draft: meeting.email_summary_draft,
      action_points: meeting.action_points,
      attendees: meeting.attendees,
      created_at: meeting.created_at
    }));

    res.json(formattedMeetings);
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

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Update the client
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (business_type !== undefined) updateData.business_type = business_type;
    if (likely_value !== undefined) updateData.likely_value = likely_value;
    if (likely_close_month !== undefined) updateData.likely_close_month = likely_close_month;

    const { data: updatedClient, error: updateError } = await getSupabase()
      .from('clients')
      .update(updateData)
      .eq('advisor_id', advisorId)
      .eq('id', clientId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return res.status(500).json({ error: 'Failed to update client' });
    }

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client updated successfully', client: updatedClient });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

// Upload client avatar
router.post('/:clientId/avatar', upload.single('avatar'), async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { clientId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client belongs to advisor
    const { data: client, error: clientError } = await getSupabase()
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Generate unique filename
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${clientId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await getSupabase()
      .storage
      .from('avatars')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      return res.status(500).json({ error: 'Failed to upload avatar' });
    }

    // Get public URL
    const { data: urlData } = getSupabase()
      .storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Update client record with avatar URL
    const { data: updatedClient, error: updateError } = await getSupabase()
      .from('clients')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client avatar:', updateError);
      return res.status(500).json({ error: 'Failed to update client avatar' });
    }

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
      client: updatedClient
    });

  } catch (error) {
    console.error('Error in avatar upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;