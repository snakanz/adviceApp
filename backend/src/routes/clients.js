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

    // For now, let's create clients from meeting attendees since we don't have a clients table yet
    // Get all meetings for this user
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .order('starttime', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    // Extract unique clients from meeting attendees
    const clientsMap = new Map();

    for (const meeting of meetings || []) {
      if (meeting.attendees) {
        try {
          const attendees = typeof meeting.attendees === 'string'
            ? JSON.parse(meeting.attendees)
            : meeting.attendees;

          for (const attendee of attendees || []) {
            if (attendee.email && attendee.email !== decoded.email) {
              const clientEmail = attendee.email;
              if (!clientsMap.has(clientEmail)) {
                clientsMap.set(clientEmail, {
                  id: clientEmail, // Use email as ID for now
                  email: clientEmail,
                  name: attendee.displayName || attendee.email,
                  business_type: '',
                  likely_value: '',
                  likely_close_month: '',
                  meeting_count: 0,
                  meetings: [],
                  created_at: meeting.starttime,
                  updated_at: meeting.updatedat || meeting.starttime
                });
              }

              // Add this meeting to the client
              const client = clientsMap.get(clientEmail);
              client.meeting_count++;
              client.meetings.push({
                id: meeting.googleeventid,
                title: meeting.title,
                starttime: meeting.starttime,
                endtime: meeting.endtime,
                summary: meeting.summary,
                transcript: meeting.transcript
              });
            }
          }
        } catch (e) {
          console.error('Error parsing attendees for meeting:', meeting.googleeventid, e);
        }
      }
    }

    const clients = Array.from(clientsMap.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email)
    );

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

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // For now, return a message that client management is not yet implemented
    // In the future, this would create/update a clients table
    res.status(501).json({
      error: 'Client management features are not yet implemented. Clients are currently derived from meeting attendees.'
    });
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

    // For now, return a message that client management is not yet implemented
    res.status(501).json({
      error: 'Client management features are not yet implemented. Clients are currently derived from meeting attendees.'
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

// Get specific client by ID (email)
router.get('/:clientId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const clientEmail = decodeURIComponent(req.params.clientId); // clientId is actually email

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get all meetings for this user to find the client
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .order('starttime', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    // Find client data from meeting attendees
    let clientData = null;
    const clientMeetings = [];

    for (const meeting of meetings || []) {
      if (meeting.attendees) {
        try {
          const attendees = typeof meeting.attendees === 'string'
            ? JSON.parse(meeting.attendees)
            : meeting.attendees;

          const clientAttendee = attendees?.find(att => att.email === clientEmail);
          if (clientAttendee) {
            if (!clientData) {
              clientData = {
                id: clientEmail,
                email: clientEmail,
                name: clientAttendee.displayName || clientEmail,
                business_type: '',
                likely_value: '',
                likely_close_month: '',
                meeting_count: 0,
                created_at: meeting.starttime,
                updated_at: meeting.updatedat || meeting.starttime
              };
            }

            clientMeetings.push({
              id: meeting.googleeventid,
              title: meeting.title,
              starttime: meeting.starttime,
              endtime: meeting.endtime,
              summary: meeting.summary,
              transcript: meeting.transcript
            });
          }
        } catch (e) {
          console.error('Error parsing attendees for meeting:', meeting.googleeventid, e);
        }
      }
    }

    if (!clientData) {
      return res.status(404).json({ error: 'Client not found' });
    }

    clientData.meeting_count = clientMeetings.length;
    clientData.meetings = clientMeetings;

    res.json(clientData);
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
    const clientEmail = decodeURIComponent(req.params.clientId); // clientId is actually email

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get all meetings for this user
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('userid', userId)
      .order('starttime', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }

    // Filter meetings that include this client
    const clientMeetings = [];

    for (const meeting of meetings || []) {
      if (meeting.attendees) {
        try {
          const attendees = typeof meeting.attendees === 'string'
            ? JSON.parse(meeting.attendees)
            : meeting.attendees;

          const hasClient = attendees?.some(att => att.email === clientEmail);
          if (hasClient) {
            clientMeetings.push({
              id: meeting.googleeventid,
              title: meeting.title,
              summary: meeting.summary,
              transcript: meeting.transcript,
              starttime: meeting.starttime,
              endtime: meeting.endtime,
              attendees: attendees,
              created_at: meeting.starttime
            });
          }
        } catch (e) {
          console.error('Error parsing attendees for meeting:', meeting.googleeventid, e);
        }
      }
    }

    res.json(clientMeetings);
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

    // For now, return a message that client management is not yet implemented
    res.status(501).json({
      error: 'Client management features are not yet implemented. Clients are currently derived from meeting attendees.'
    });
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