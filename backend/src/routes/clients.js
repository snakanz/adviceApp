const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const clientExtractionService = require('../services/clientExtraction');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

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

    // Get ALL clients for this advisor (not just those with meetings)
    const { data: clients, error: clientsError } = await req.supabase
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
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    // Get business types for all clients
    // Note: We fetch all business types and filter in application code if needed
    const { data: allBusinessTypes, error: businessTypesError } = await req.supabase
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
    const { data: existingClient, error: checkError } = await req.supabase
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

      const { data: updatedClient, error: updateError } = await req.supabase
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

      const { data: newClient, error: insertError } = await req.supabase
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
      pipeline_stage,
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

    // Find the client first
    const { data: client, error: findError } = await req.supabase
      .from('clients')
      .select('id')
      .eq('advisor_id', advisorId)
      .eq('email', email)
      .single();

    if (findError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Update client name, pipeline_stage, and likely_close_month only (not business data)
    const clientUpdateData = {
      name: name,
      pipeline_stage: pipeline_stage || null,
      likely_close_month: likely_close_month || null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedClient, error: updateError } = await req.supabase
      .from('clients')
      .update(clientUpdateData)
      .eq('id', client.id)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return res.status(500).json({ error: 'Failed to update client' });
    }

    // If business type data is provided, update or create business type entry
    if (business_type && business_type !== '') {
      // Check if business type entry already exists
      const { data: existingBusinessType, error: fetchError } = await req.supabase
        .from('client_business_types')
        .select('*')
        .eq('client_id', client.id)
        .eq('business_type', business_type)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing business type:', fetchError);
      }

      // Prepare business type data
      const parsedIafExpected = (iaf_expected !== undefined && iaf_expected !== '')
        ? parseFloat(iaf_expected)
        : (likely_value !== undefined && likely_value !== '')
          ? parseFloat(likely_value)
          : null;
      const parsedBusinessAmount = (business_amount !== undefined && business_amount !== '')
        ? parseFloat(business_amount)
        : null;

      // Determine contribution method from regular_contribution_type
      let contributionMethod = null;
      if (regular_contribution_type && regular_contribution_type !== '') {
        contributionMethod = 'Regular Monthly Contribution';
      }

      const businessTypeData = {
        client_id: client.id,
        business_type: business_type,
        business_amount: isNaN(parsedBusinessAmount) ? null : parsedBusinessAmount,
        iaf_expected: isNaN(parsedIafExpected) ? null : parsedIafExpected,
        contribution_method: contributionMethod,
        regular_contribution_amount: regular_contribution_amount || null,
        updated_at: new Date().toISOString()
      };

      if (existingBusinessType) {
        // Update existing business type
        const { error: updateBTError } = await req.supabase
          .from('client_business_types')
          .update(businessTypeData)
          .eq('id', existingBusinessType.id);

        if (updateBTError) {
          console.error('Error updating business type:', updateBTError);
          // Don't fail the whole operation, but log the error
        } else {
          console.log('✅ Business type updated successfully');
        }
      } else {
        // Create new business type entry
        const { error: insertBTError } = await req.supabase
          .from('client_business_types')
          .insert([businessTypeData]);

        if (insertBTError) {
          console.error('Error creating business type:', insertBTError);
          // Don't fail the whole operation, but log the error
        } else {
          console.log('✅ Business type created successfully');
        }
      }
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
    let clientQuery = req.supabase
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
    const { data: clientBusinessTypes, error: businessTypesError } = await req.supabase
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
    let clientQuery = req.supabase
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
    const { data: meetings, error: meetingsError } = await req.supabase
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

    const { data: updatedClient, error: updateError } = await req.supabase
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
    const { data: client, error: clientError } = await req.supabase
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
    const { data: uploadData, error: uploadError } = await req.supabase
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
    const { data: urlData } = req.supabase
      .storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Update client record with avatar URL
    const { data: updatedClient, error: updateError } = await req.supabase
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
      likely_close_month,
      pipeline_notes,
      business_types, // Array of business type objects
      // Optional meeting data
      create_meeting,
      meeting_title,
      meeting_date,
      meeting_time,
      meeting_type,
      meeting_location
    } = req.body;

    // Validate required pipeline fields
    if (!pipeline_stage) {
      return res.status(400).json({
        error: 'Pipeline stage is required'
      });
    }

    // Validate business types array
    if (!business_types || !Array.isArray(business_types) || business_types.length === 0) {
      return res.status(400).json({
        error: 'At least one business type is required'
      });
    }

    // Check that at least one business type has a type selected
    const hasValidBusinessType = business_types.some(bt => bt.business_type && bt.business_type.trim() !== '');
    if (!hasValidBusinessType) {
      return res.status(400).json({
        error: 'At least one business type must be selected'
      });
    }

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client exists and belongs to advisor
    const { data: client, error: clientError } = await req.supabase
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
    // Note: pipeline_notes are stored in client_business_types table, not clients table

    // Convert likely_close_month from "YYYY-MM" to "YYYY-MM-01" for DATE column
    let closeMonthDate = null;
    if (likely_close_month) {
      // If it's already a full date, use it; otherwise append "-01"
      closeMonthDate = likely_close_month.includes('-') && likely_close_month.split('-').length === 2
        ? `${likely_close_month}-01`
        : likely_close_month;
    }

    const clientUpdateData = {
      pipeline_stage,
      likely_close_month: closeMonthDate,
      updated_at: new Date().toISOString()
    };

    console.log('📝 Updating client with pipeline data:', {
      clientId,
      updateData: JSON.stringify(clientUpdateData, null, 2)
    });

    const { data: updatedClient, error: updateError } = await req.supabase
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

    // Process multiple business types (SINGLE SOURCE OF TRUTH)
    // Strategy: Delete all existing business types for this client and insert new ones
    // This ensures clean state and allows multiple entries of the same type
    const businessTypeResults = [];

    // First, delete all existing business types for this client
    const { error: deleteError } = await req.supabase
      .from('client_business_types')
      .delete()
      .eq('client_id', clientId);

    if (deleteError) {
      console.error('❌ Error deleting existing business types:', deleteError);
      return res.status(500).json({
        error: 'Failed to update business types',
        details: deleteError.message
      });
    }

    console.log('✅ Cleared existing business types for client:', clientId);

    // Now insert all new business types
    const businessTypesToInsert = [];

    for (const businessType of business_types) {
      // Skip empty business types
      if (!businessType.business_type || businessType.business_type.trim() === '') {
        continue;
      }

      // Prepare business type data
      const parsedIafExpected = businessType.iaf_expected && businessType.iaf_expected !== ''
        ? parseFloat(businessType.iaf_expected)
        : null;
      const parsedBusinessAmount = businessType.business_amount && businessType.business_amount !== ''
        ? parseFloat(businessType.business_amount)
        : null;
      const parsedRegularContribution = businessType.regular_contribution_amount && businessType.regular_contribution_amount !== ''
        ? parseFloat(businessType.regular_contribution_amount)
        : null;

      const businessTypeData = {
        client_id: clientId,
        business_type: businessType.business_type,
        business_amount: isNaN(parsedBusinessAmount) ? null : parsedBusinessAmount,
        iaf_expected: isNaN(parsedIafExpected) ? null : parsedIafExpected,
        contribution_method: businessType.contribution_method || null,
        regular_contribution_amount: isNaN(parsedRegularContribution) ? null : parsedRegularContribution,
        notes: businessType.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      businessTypesToInsert.push(businessTypeData);
      businessTypeResults.push({ type: businessType.business_type, status: 'prepared' });
    }

    // Bulk insert all business types
    if (businessTypesToInsert.length > 0) {
      const { error: insertError } = await req.supabase
        .from('client_business_types')
        .insert(businessTypesToInsert);

      if (insertError) {
        console.error('❌ Error inserting business types:', insertError);
        console.error('Data that failed:', businessTypesToInsert);
        return res.status(500).json({
          error: 'Failed to save business types',
          details: insertError.message,
          data: businessTypesToInsert
        });
      }

      console.log(`✅ Successfully inserted ${businessTypesToInsert.length} business types`);
      businessTypeResults.forEach(r => r.status = 'created');
    }

    console.log('📊 Business types processing results:', businessTypeResults);

    // Log pipeline activity (optional - don't fail if table doesn't exist)
    try {
      const businessTypeSummary = businessTypeResults
        .filter(r => r.status !== 'error')
        .map(r => r.type)
        .join(', ');

      await req.supabase
        .from('pipeline_activities')
        .insert({
          client_id: clientId,
          advisor_id: advisorId,
          activity_type: 'stage_change',
          title: `Pipeline entry created - ${pipeline_stage}`,
          description: `Pipeline entry created with stage: ${pipeline_stage}. Business types: ${businessTypeSummary}${pipeline_notes ? `. Notes: ${pipeline_notes}` : ''}`,
          metadata: {
            pipeline_stage,
            business_types: businessTypeResults,
            entry_type: 'pipeline_entry_creation'
          }
        });
      console.log('✅ Pipeline activity logged successfully');
    } catch (activityError) {
      // Don't fail the whole operation if activity logging fails
      console.warn('⚠️ Failed to log pipeline activity (table may not exist):', activityError.message);
    }

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

      const { data: newMeeting, error: meetingError } = await req.supabase
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

        // Log meeting creation activity (optional - don't fail if table doesn't exist)
        try {
          await req.supabase
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
          console.log('✅ Meeting activity logged successfully');
        } catch (activityError) {
          console.warn('⚠️ Failed to log meeting activity (table may not exist):', activityError.message);
        }
      }
    }

    res.json({
      message: 'Pipeline entry created successfully',
      client: updatedClient,
      meeting: createdMeeting,
      pipeline_entry: {
        pipeline_stage,
        likely_close_month,
        pipeline_notes,
        business_types: businessTypeResults
      }
    });

  } catch (error) {
    console.error('Error creating pipeline entry:', error);
    res.status(500).json({ error: 'Failed to create pipeline entry', details: error.message });
  }
});

// Get client business types
router.get('/:clientId/business-types', authenticateSupabaseUser, async (req, res) => {
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
    const { data: businessTypes, error } = await req.supabase
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
router.put('/:clientId/business-types', authenticateSupabaseUser, async (req, res) => {
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
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete existing business types for this client
    const { error: deleteError } = await req.supabase
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
        expected_close_date: bt.expected_close_date || null,
        notes: bt.notes || null
      }));

      const { data: newBusinessTypes, error: insertError } = await req.supabase
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

// Mark a business type as not proceeding
router.patch('/business-types/:businessTypeId/not-proceeding', authenticateSupabaseUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const businessTypeId = req.params.businessTypeId;
    const { not_proceeding, not_proceeding_reason } = req.body;

    console.log('🔄 Marking business type as not proceeding:', {
      businessTypeId,
      not_proceeding,
      reason: not_proceeding_reason
    });

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify business type exists and belongs to advisor's client
    const { data: businessType, error: fetchError } = await req.supabase
      .from('client_business_types')
      .select(`
        *,
        client:clients!inner(
          id,
          advisor_id
        )
      `)
      .eq('id', businessTypeId)
      .single();

    if (fetchError || !businessType) {
      console.error('❌ Business type not found:', fetchError);
      return res.status(404).json({ error: 'Business type not found' });
    }

    if (businessType.client.advisor_id !== advisorId) {
      console.error('❌ Unauthorized access attempt');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update not_proceeding status
    const updateData = {
      not_proceeding: not_proceeding === true,
      not_proceeding_reason: not_proceeding_reason || null,
      not_proceeding_date: not_proceeding === true ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedBusinessType, error: updateError } = await req.supabase
      .from('client_business_types')
      .update(updateData)
      .eq('id', businessTypeId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating business type:', updateError);
      return res.status(500).json({ error: 'Failed to update business type' });
    }

    console.log('✅ Business type updated successfully:', updatedBusinessType.id);

    res.json({
      message: not_proceeding ? 'Business type marked as not proceeding' : 'Business type marked as proceeding',
      businessType: updatedBusinessType
    });
  } catch (error) {
    console.error('Error in mark business type as not proceeding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new client with pipeline integration and business types
router.post('/create', authenticateSupabaseUser, async (req, res) => {
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
    const { data: existingClient, error: checkError } = await req.supabase
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

    const { data: newClient, error: clientError } = await req.supabase
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
      expected_close_date: bt.expected_close_date || null,
      notes: bt.notes || null
    }));

    const { data: newBusinessTypes, error: businessTypeError } = await req.supabase
      .from('client_business_types')
      .insert(businessTypeData)
      .select();

    if (businessTypeError) {
      console.error('Error creating business types:', businessTypeError);
      // Don't fail the whole operation, but log the error
    }

    // Create pipeline activity (optional - don't fail if table doesn't exist)
    try {
      await req.supabase
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
      console.log('✅ Client creation activity logged successfully');
    } catch (activityError) {
      console.warn('⚠️ Failed to log client creation activity (table may not exist):', activityError.message);
    }

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

// Generate AI summary for a client
router.post('/:clientId/generate-summary', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

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

    // Get client data
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get client's meetings with transcripts
    const { data: meetings, error: meetingsError } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .eq('userid', advisorId)
      .order('starttime', { ascending: false })
      .limit(5); // Get last 5 meetings

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
    }

    // Check if we have any meetings with transcripts or summaries
    const meetingsWithContent = meetings?.filter(m =>
      m.transcript || m.detailed_summary || m.quick_summary
    ) || [];

    if (meetingsWithContent.length === 0) {
      return res.json({
        summary: null,
        message: 'No meeting content available to generate summary'
      });
    }

    // Get business types
    const { data: businessTypes } = await req.supabase
      .from('client_business_types')
      .select('*')
      .eq('client_id', clientId);

    // Prepare context for OpenAI
    const meetingContext = meetingsWithContent.map(m => ({
      date: m.starttime,
      title: m.title,
      summary: m.detailed_summary || m.quick_summary || 'No summary available',
      transcript: m.transcript ? m.transcript.substring(0, 1000) : null // Limit transcript length
    }));

    const businessContext = businessTypes?.map(bt => ({
      type: bt.business_type,
      amount: bt.business_amount,
      iaf: bt.iaf_expected,
      method: bt.contribution_method
    })) || [];

    // Generate summary using OpenAI
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `You are a financial advisor's assistant. Generate a brief, professional summary (2-3 sentences) of where we're at with this client based on their recent meetings and business information.

Client: ${client.name}
Pipeline Stage: ${client.pipeline_stage || 'Not set'}

Recent Meetings:
${meetingContext.map(m => `- ${new Date(m.date).toLocaleDateString()}: ${m.title}\n  ${m.summary}`).join('\n')}

Business Types:
${businessContext.map(bt => `- ${bt.type}: £${bt.amount?.toLocaleString() || 0} (IAF: £${bt.iaf?.toLocaleString() || 0})`).join('\n')}

Generate a concise summary that captures:
1. Current relationship status
2. Key business opportunities or progress
3. Next steps or what we're waiting for

Keep it professional, factual, and under 100 words.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional financial advisor assistant. Generate concise, factual client summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const summary = completion.choices[0].message.content.trim();

    // Store summary in database (add ai_summary column if it doesn't exist)
    const { error: updateError } = await req.supabase
      .from('clients')
      .update({
        ai_summary: summary,
        ai_summary_generated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error storing summary:', updateError);
      // Don't fail the request, just return the summary
    }

    res.json({
      summary,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating client summary:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message
    });
  }
});

// Generate AI "Next Steps to Close" summary for pipeline
router.post('/:clientId/generate-pipeline-summary', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

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

    // Get client data with pipeline information
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('advisor_id', advisorId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get business types with expected close dates
    const { data: businessTypes } = await req.supabase
      .from('client_business_types')
      .select('*')
      .eq('client_id', clientId);

    // Get recent meetings
    const { data: meetings } = await req.supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .eq('userid', advisorId)
      .order('starttime', { ascending: false })
      .limit(3);

    // Get action points from recent meetings
    const actionPoints = meetings?.filter(m => m.action_points).map(m => m.action_points).join('\n') || 'None';

    // Check if we have enough context
    if (!client.pipeline_stage && (!businessTypes || businessTypes.length === 0)) {
      return res.json({
        summary: 'No pipeline information available yet. Add pipeline stage and business types to get AI-generated next steps.',
        generated_at: new Date().toISOString()
      });
    }

    // Prepare context for OpenAI
    const businessContext = businessTypes?.map(bt => ({
      type: bt.business_type,
      amount: bt.business_amount,
      iaf: bt.iaf_expected,
      expectedClose: bt.expected_close_date,
      notes: bt.notes
    })) || [];

    // Generate "Next Steps to Close" summary using OpenAI
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `You are a financial advisor's assistant. Generate a brief, actionable summary (2-3 sentences maximum) explaining what needs to happen to finalize this business deal.

Client: ${client.name}
Pipeline Stage: ${client.pipeline_stage || 'Not set'}
IAF Expected: £${client.iaf_expected?.toLocaleString() || 0}
Likelihood: ${client.likelihood || 'Unknown'}%

Business Types:
${businessContext.map(bt => `- ${bt.type}: £${bt.amount?.toLocaleString() || 0} (IAF: £${bt.iaf?.toLocaleString() || 0})
  Expected Close: ${bt.expectedClose || 'Not set'}
  ${bt.notes ? 'Notes: ' + bt.notes : ''}`).join('\n')}

Recent Action Points:
${actionPoints}

Pipeline Notes:
${client.pipeline_notes || 'None'}

Generate a concise, actionable summary that explains:
1. What specific actions or documents are needed to close this deal
2. Any blockers or pending items that need attention
3. The immediate next step the advisor should take

Be specific and actionable. Focus on what needs to happen NOW to move this forward. Maximum 3 sentences.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional financial advisor assistant. Generate concise, actionable next steps for closing business deals.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const summary = completion.choices[0].message.content.trim();

    // Store summary in database
    const { error: updateError } = await req.supabase
      .from('clients')
      .update({
        pipeline_next_steps: summary,
        pipeline_next_steps_generated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error storing pipeline summary:', updateError);
      // Don't fail the request, just return the summary
    }

    res.json({
      summary,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating pipeline summary:', error);
    res.status(500).json({
      error: 'Failed to generate pipeline summary',
      details: error.message
    });
  }
});

module.exports = router;