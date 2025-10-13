const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const clientExtractionService = require('../services/clientExtraction');
const { authenticateUser } = require('../middleware/auth');

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

    // Get filter parameter for upcoming meetings
    const filter = req.query.filter; // 'all', 'with-upcoming', 'no-upcoming'

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

    // Get business types for all clients
    const { data: allBusinessTypes, error: businessTypesError } = await getSupabase()
      .from('client_business_types')
      .select('*')
      .in('client_id', clients.map(c => c.id));

    if (businessTypesError) {
      console.error('Error fetching business types:', businessTypesError);
      // Continue without business types rather than failing
    }

    // Group business types by client_id
    const businessTypesByClient = {};
    (allBusinessTypes || []).forEach(bt => {
      if (!businessTypesByClient[bt.client_id]) {
        businessTypesByClient[bt.client_id] = [];
      }
      businessTypesByClient[bt.client_id].push(bt);
    });

    // Format the response and apply filtering based on upcoming meetings
    const now = new Date();
    const formattedClients = (clients || []).map(client => {
      const meetings = (client.meetings || []).map(meeting => ({
        id: meeting.googleeventid,
        title: meeting.title,
        starttime: meeting.starttime,
        endtime: meeting.endtime,
        summary: meeting.summary,
        transcript: meeting.transcript,
        quick_summary: meeting.quick_summary,
        email_summary_draft: meeting.email_summary_draft,
        action_points: meeting.action_points
      }));

      // Calculate upcoming meetings
      const upcomingMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(meeting.starttime);
        return meetingDate > now;
      });

      // Get business types for this client (SINGLE SOURCE OF TRUTH)
      const clientBusinessTypes = businessTypesByClient[client.id] || [];

      // Calculate aggregated totals from business types
      const totalBusinessAmount = clientBusinessTypes.reduce((sum, bt) => sum + (parseFloat(bt.business_amount) || 0), 0);
      const totalIafExpected = clientBusinessTypes.reduce((sum, bt) => sum + (parseFloat(bt.iaf_expected) || 0), 0);
      const businessTypesList = clientBusinessTypes.map(bt => bt.business_type);
      const primaryBusinessType = businessTypesList[0] || client.business_type || null;

      return {
        id: client.id,
        email: client.email,
        name: client.name,
        // Use aggregated business type data as SINGLE SOURCE OF TRUTH
        business_type: primaryBusinessType,
        business_types: businessTypesList,
        business_types_data: clientBusinessTypes,
        business_amount: totalBusinessAmount || client.business_amount || null,
        iaf_expected: totalIafExpected || client.iaf_expected || null,
        likely_value: totalIafExpected || client.likely_value || null, // Backward compatibility
        likely_close_month: client.likely_close_month,
        pipeline_stage: client.pipeline_stage,
        priority_level: client.priority_level,
        last_contact_date: client.last_contact_date,
        next_follow_up_date: client.next_follow_up_date,
        notes: client.notes,
        tags: client.tags,
        source: client.source,
        is_active: client.is_active,
        meeting_count: client.meeting_count || meetings.length,
        active_meeting_count: client.active_meeting_count,
        last_meeting_date: client.last_meeting_date,
        created_at: client.created_at,
        updated_at: client.updated_at,
        avatar_url: client.avatar_url,
        meetings: meetings,
        upcoming_meetings_count: upcomingMeetings.length,
        has_upcoming_meetings: upcomingMeetings.length > 0
      };
    });

    // Apply filter based on upcoming meetings
    let filteredClients = formattedClients;
    if (filter === 'with-upcoming') {
      filteredClients = formattedClients.filter(client => client.has_upcoming_meetings);
    } else if (filter === 'no-upcoming') {
      filteredClients = formattedClients.filter(client => !client.has_upcoming_meetings);
    }
    // If filter === 'all' or undefined, return all clients

    res.json(filteredClients);
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
    const {
      email,
      name,
      business_type,
      likely_value,
      iaf_expected,
      business_amount,
      regular_contribution_type,
      regular_contribution_amount,
      likely_close_month
    } = req.body;

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
      const updateData = {
        name: name || null,
        business_type: business_type || null,
        likely_close_month: likely_close_month || null,
        updated_at: new Date().toISOString()
      };

      // Handle both old and new field names for backward compatibility
      if (iaf_expected !== undefined) {
        updateData.iaf_expected = iaf_expected;
      } else if (likely_value !== undefined) {
        updateData.iaf_expected = likely_value; // Map old field to new field
      }

      // Add new fields
      if (business_amount !== undefined) updateData.business_amount = business_amount;
      if (regular_contribution_type !== undefined) updateData.regular_contribution_type = regular_contribution_type;
      if (regular_contribution_amount !== undefined) updateData.regular_contribution_amount = regular_contribution_amount;

      const { data: updatedClient, error: updateError } = await getSupabase()
        .from('clients')
        .update(updateData)
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
      const insertData = {
        advisor_id: advisorId,
        email: email,
        name: name || null,
        business_type: business_type || null,
        likely_close_month: likely_close_month || null,
        pipeline_stage: 'need_to_book_meeting', // Updated default stage
        priority_level: 3
      };

      // Handle both old and new field names for backward compatibility
      if (iaf_expected !== undefined) {
        insertData.iaf_expected = iaf_expected;
      } else if (likely_value !== undefined) {
        insertData.iaf_expected = likely_value; // Map old field to new field
      }

      // Add new fields
      if (business_amount !== undefined) insertData.business_amount = business_amount;
      if (regular_contribution_type !== undefined) insertData.regular_contribution_type = regular_contribution_type;
      if (regular_contribution_amount !== undefined) insertData.regular_contribution_amount = regular_contribution_amount;

      const { data: newClient, error: insertError } = await getSupabase()
        .from('clients')
        .insert(insertData)
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
    const {
      email,
      name,
      business_type,
      likely_value,
      iaf_expected,
      business_amount,
      regular_contribution_type,
      regular_contribution_amount,
      likely_close_month
    } = req.body;

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
    const updateData = {
      name: name,
      business_type: business_type || null,
      likely_close_month: likely_close_month || null,
      updated_at: new Date().toISOString()
    };

    // Handle both old and new field names for backward compatibility
    if (iaf_expected !== undefined) {
      updateData.iaf_expected = iaf_expected;
    } else if (likely_value !== undefined) {
      updateData.iaf_expected = likely_value; // Map old field to new field
    }

    // Add new fields
    if (business_amount !== undefined) updateData.business_amount = business_amount;
    if (regular_contribution_type !== undefined) updateData.regular_contribution_type = regular_contribution_type;
    if (regular_contribution_amount !== undefined) updateData.regular_contribution_amount = regular_contribution_amount;

    const { data: updatedClient, error: updateError } = await getSupabase()
      .from('clients')
      .update(updateData)
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

    // Get business types for this client (SINGLE SOURCE OF TRUTH)
    const { data: clientBusinessTypes, error: businessTypesError } = await getSupabase()
      .from('client_business_types')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: true });

    if (businessTypesError) {
      console.error('Error fetching business types:', businessTypesError);
      // Continue without business types rather than failing
    }

    // Calculate aggregated totals from business types
    const businessTypes = clientBusinessTypes || [];
    const totalBusinessAmount = businessTypes.reduce((sum, bt) => sum + (parseFloat(bt.business_amount) || 0), 0);
    const totalIafExpected = businessTypes.reduce((sum, bt) => sum + (parseFloat(bt.iaf_expected) || 0), 0);
    const businessTypesList = businessTypes.map(bt => bt.business_type);
    const primaryBusinessType = businessTypesList[0] || client.business_type || null;

    // Format the response
    const formattedClient = {
      id: client.id,
      email: client.email,
      name: client.name,
      // Use aggregated business type data as SINGLE SOURCE OF TRUTH
      business_type: primaryBusinessType,
      business_types: businessTypesList,
      business_types_data: businessTypes,
      business_amount: totalBusinessAmount || client.business_amount || null,
      iaf_expected: totalIafExpected || client.iaf_expected || null,
      likely_value: totalIafExpected || client.likely_value || null, // Backward compatibility
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
      avatar_url: client.avatar_url,
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
    const {
      name,
      emails,
      business_type,
      likely_value,
      iaf_expected,
      business_amount,
      regular_contribution_type,
      regular_contribution_amount,
      likely_close_month
    } = req.body;

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
    if (likely_close_month !== undefined) updateData.likely_close_month = likely_close_month;

    // Handle both old and new field names for backward compatibility
    if (iaf_expected !== undefined) {
      updateData.iaf_expected = iaf_expected;
    } else if (likely_value !== undefined) {
      updateData.iaf_expected = likely_value; // Map old field to new field
    }

    // Add new fields
    if (business_amount !== undefined) updateData.business_amount = business_amount;
    if (regular_contribution_type !== undefined) updateData.regular_contribution_type = regular_contribution_type;
    if (regular_contribution_amount !== undefined) updateData.regular_contribution_amount = regular_contribution_amount;

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

// Extract clients from meeting attendees and link meetings
router.post('/extract-clients', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    console.log('🔗 Starting client extraction for user:', userId);

    // Run client extraction service
    const result = await clientExtractionService.linkMeetingsToClients(userId);

    if (result.success) {
      res.json({
        message: 'Client extraction completed successfully',
        ...result
      });
    } else {
      res.status(500).json({
        error: 'Client extraction failed',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Client extraction endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create pipeline entry for client without future meetings
router.post('/:clientId/pipeline-entry', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientId = req.params.clientId;

    const {
      pipeline_stage,
      iaf_expected,
      business_type,
      business_amount,
      regular_contribution_type,
      regular_contribution_amount,
      pipeline_notes,
      likely_close_month,
      // Optional meeting data
      create_meeting,
      meeting_title,
      meeting_date,
      meeting_time,
      meeting_type,
      meeting_location
    } = req.body;

    // Validate required pipeline fields
    if (!pipeline_stage || !business_type) {
      return res.status(400).json({
        error: 'Pipeline stage and business type are required'
      });
    }

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client exists and belongs to advisor
    const { data: client, error: clientError } = await getSupabase()
      .from('clients')
      .select('id, name, email')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Note: We allow adding clients to pipeline regardless of whether they have future meetings
    // The pipeline is for tracking business opportunities, not just clients without meetings

    // Update client with pipeline-level data (stage and close month only)
    const clientUpdateData = {
      pipeline_stage,
      likely_close_month: likely_close_month || null,
      notes: pipeline_notes || null,
      updated_at: new Date().toISOString()
    };

    console.log('📝 Updating client with pipeline data:', {
      clientId,
      updateData: JSON.stringify(clientUpdateData, null, 2)
    });

    const { data: updatedClient, error: updateError } = await getSupabase()
      .from('clients')
      .update(clientUpdateData)
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating client pipeline:', updateError);
      console.error('Update data that failed:', clientUpdateData);
      return res.status(500).json({
        error: 'Failed to update client pipeline',
        details: updateError.message,
        hint: updateError.hint || 'Check if all required database columns exist'
      });
    }

    console.log('✅ Client pipeline updated successfully:', updatedClient.id);

    // Create or update business type entry (SINGLE SOURCE OF TRUTH)
    // First, check if a business type entry already exists for this client
    const { data: existingBusinessTypes, error: fetchError } = await getSupabase()
      .from('client_business_types')
      .select('*')
      .eq('client_id', clientId)
      .eq('business_type', business_type)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing business type:', fetchError);
    }

    // Prepare business type data
    const parsedIafExpected = iaf_expected && iaf_expected !== '' ? parseFloat(iaf_expected) : null;
    const parsedBusinessAmount = business_amount && business_amount !== '' ? parseFloat(business_amount) : null;

    // Determine contribution method from regular_contribution_type
    let contributionMethod = null;
    if (regular_contribution_type && regular_contribution_type !== '') {
      contributionMethod = 'Regular Monthly Contribution';
    }

    const businessTypeData = {
      client_id: clientId,
      business_type: business_type,
      business_amount: isNaN(parsedBusinessAmount) ? null : parsedBusinessAmount,
      iaf_expected: isNaN(parsedIafExpected) ? null : parsedIafExpected,
      contribution_method: contributionMethod,
      regular_contribution_amount: regular_contribution_amount || null,
      notes: pipeline_notes || null,
      updated_at: new Date().toISOString()
    };

    if (existingBusinessTypes) {
      // Update existing business type
      const { error: updateBTError } = await getSupabase()
        .from('client_business_types')
        .update(businessTypeData)
        .eq('id', existingBusinessTypes.id);

      if (updateBTError) {
        console.error('❌ Error updating business type:', updateBTError);
        // Don't fail the whole operation, but log the error
      } else {
        console.log('✅ Business type updated successfully');
      }
    } else {
      // Create new business type entry
      const { error: insertBTError } = await getSupabase()
        .from('client_business_types')
        .insert([businessTypeData]);

      if (insertBTError) {
        console.error('❌ Error creating business type:', insertBTError);
        // Don't fail the whole operation, but log the error
      } else {
        console.log('✅ Business type created successfully');
      }
    }

    // Log pipeline activity
    await getSupabase()
      .from('pipeline_activities')
      .insert({
        client_id: clientId,
        advisor_id: advisorId,
        activity_type: 'stage_change',
        title: `Pipeline entry created - ${pipeline_stage}`,
        description: `Pipeline entry created with stage: ${pipeline_stage}${pipeline_notes ? `, Notes: ${pipeline_notes}` : ''}`,
        metadata: {
          pipeline_stage,
          business_type,
          iaf_expected,
          business_amount,
          entry_type: 'pipeline_entry_creation'
        }
      });

    let createdMeeting = null;

    // Optionally create meeting if requested
    if (create_meeting && meeting_title && meeting_date && meeting_time) {
      const meetingDateTime = new Date(`${meeting_date}T${meeting_time}`);
      const meetingEndTime = new Date(meetingDateTime.getTime() + 60 * 60 * 1000); // 1 hour default

      const meetingData = {
        userid: advisorId,
        client_id: clientId,
        title: meeting_title,
        starttime: meetingDateTime.toISOString(),
        endtime: meetingEndTime.toISOString(),
        summary: `Meeting scheduled via pipeline entry for ${client.name}`,
        meeting_source: 'manual',
        location_type: meeting_type || 'video',
        location_details: meeting_location || null,
        created_by: advisorId,
        attendees: JSON.stringify([{
          email: client.email,
          displayName: client.name,
          responseStatus: 'needsAction'
        }])
      };

      const { data: newMeeting, error: meetingError } = await getSupabase()
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (meetingError) {
        console.error('Error creating meeting:', meetingError);
        // Don't fail the pipeline entry creation if meeting creation fails
        console.warn('Pipeline entry created successfully, but meeting creation failed');
      } else {
        createdMeeting = newMeeting;

        // Log meeting creation activity
        await getSupabase()
          .from('pipeline_activities')
          .insert({
            client_id: clientId,
            advisor_id: advisorId,
            activity_type: 'meeting',
            title: `Meeting scheduled: ${meeting_title}`,
            description: `Meeting scheduled for ${meetingDateTime.toLocaleDateString()} at ${meetingDateTime.toLocaleTimeString()}`,
            metadata: {
              meeting_id: newMeeting.id,
              meeting_type,
              created_with_pipeline_entry: true
            }
          });
      }
    }

    res.json({
      message: 'Pipeline entry created successfully',
      client: updatedClient,
      meeting: createdMeeting,
      pipeline_entry: {
        pipeline_stage,
        business_type,
        iaf_expected,
        business_amount,
        regular_contribution_type,
        regular_contribution_amount,
        pipeline_notes,
        likely_close_month
      }
    });

  } catch (error) {
    console.error('Error creating pipeline entry:', error);
    res.status(500).json({ error: 'Failed to create pipeline entry', details: error.message });
  }
});

// Get client business types
router.get('/:clientId/business-types', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientId = req.params.clientId;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get client business types
    const { data: businessTypes, error } = await getSupabase()
      .from('client_business_types')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching client business types:', error);
      return res.status(500).json({ error: 'Failed to fetch business types' });
    }

    res.json(businessTypes || []);
  } catch (error) {
    console.error('Error in get client business types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client business types
router.put('/:clientId/business-types', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const clientId = req.params.clientId;
    const { businessTypes } = req.body;

    if (!Array.isArray(businessTypes)) {
      return res.status(400).json({ error: 'businessTypes must be an array' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client belongs to advisor
    const { data: client, error: clientError } = await getSupabase()
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete existing business types for this client
    const { error: deleteError } = await getSupabase()
      .from('client_business_types')
      .delete()
      .eq('client_id', clientId);

    if (deleteError) {
      console.error('Error deleting existing business types:', deleteError);
      return res.status(500).json({ error: 'Failed to update business types' });
    }

    // Insert new business types
    if (businessTypes.length > 0) {
      const businessTypeData = businessTypes.map(bt => ({
        client_id: clientId,
        business_type: bt.business_type,
        business_amount: bt.business_amount ? parseFloat(bt.business_amount) : null,
        contribution_method: bt.contribution_method || null,
        regular_contribution_amount: bt.regular_contribution_amount || null,
        iaf_expected: bt.iaf_expected ? parseFloat(bt.iaf_expected) : null,
        notes: bt.notes || null
      }));

      const { data: newBusinessTypes, error: insertError } = await getSupabase()
        .from('client_business_types')
        .insert(businessTypeData)
        .select();

      if (insertError) {
        console.error('Error inserting business types:', insertError);
        return res.status(500).json({ error: 'Failed to save business types' });
      }

      res.json({ businessTypes: newBusinessTypes });
    } else {
      res.json({ businessTypes: [] });
    }
  } catch (error) {
    console.error('Error in update client business types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new client with pipeline integration and business types
router.post('/create', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;

    const {
      // Basic client info
      name,
      email,
      phone,
      address,
      // Pipeline info
      pipeline_stage,
      likely_close_month,
      priority_level,
      notes,
      source,
      // Business types array
      business_types
    } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    if (!pipeline_stage) {
      return res.status(400).json({ error: 'Pipeline stage is required' });
    }

    if (!business_types || !Array.isArray(business_types) || business_types.length === 0) {
      return res.status(400).json({ error: 'At least one business type is required' });
    }

    // Validate business types
    for (const bt of business_types) {
      if (!bt.business_type || !bt.contribution_method) {
        return res.status(400).json({
          error: 'Each business type must have a type and contribution method'
        });
      }

      if (bt.contribution_method === 'Regular Monthly Contribution' && !bt.regular_contribution_amount) {
        return res.status(400).json({
          error: 'Regular contribution amount is required for Regular Monthly Contribution'
        });
      }
    }

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
      return res.status(400).json({ error: 'Client with this email already exists' });
    }

    // Create new client
    const clientData = {
      advisor_id: advisorId,
      name,
      email,
      phone: phone || null,
      address: address || null,
      pipeline_stage,
      likely_close_month: likely_close_month || null,
      priority_level: priority_level || 3,
      notes: notes || null,
      source: source || 'manual',
      last_contact_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newClient, error: clientError } = await getSupabase()
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      return res.status(500).json({ error: 'Failed to create client' });
    }

    // Create business types
    const businessTypeData = business_types.map(bt => ({
      client_id: newClient.id,
      business_type: bt.business_type,
      business_amount: bt.business_amount ? parseFloat(bt.business_amount) : null,
      contribution_method: bt.contribution_method,
      regular_contribution_amount: bt.regular_contribution_amount || null,
      iaf_expected: bt.iaf_expected ? parseFloat(bt.iaf_expected) : null,
      notes: bt.notes || null
    }));

    const { data: newBusinessTypes, error: businessTypeError } = await getSupabase()
      .from('client_business_types')
      .insert(businessTypeData)
      .select();

    if (businessTypeError) {
      console.error('Error creating business types:', businessTypeError);
      // Don't fail the whole operation, but log the error
    }

    // Create pipeline activity
    await getSupabase()
      .from('pipeline_activities')
      .insert({
        client_id: newClient.id,
        advisor_id: advisorId,
        activity_type: 'note',
        title: 'Client created',
        description: `New client created with pipeline stage: ${pipeline_stage}`,
        metadata: {
          source: 'client_creation',
          business_types: business_types.map(bt => bt.business_type)
        }
      });

    res.json({
      message: 'Client created successfully',
      client: newClient,
      business_types: newBusinessTypes
    });

  } catch (error) {
    console.error('Error in create client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;