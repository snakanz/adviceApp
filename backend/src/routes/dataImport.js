const express = require('express');
const jwt = require('jsonwebtoken');
const { isSupabaseAvailable } = require('../lib/supabase');
const dataImportService = require('../services/dataImport');

const router = express.Router();

// Middleware to authenticate user
const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token provided' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * POST /api/data-import/preview
 * Upload file and preview import data without saving to database
 */
router.post('/preview', authenticateToken, dataImportService.upload.single('file'), async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const preview = await dataImportService.previewImport(
      req.file.buffer,
      req.file.originalname,
      userId
    );

    res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      preview
    });

  } catch (error) {
    console.error('Error previewing import:', error);
    res.status(500).json({ 
      error: 'Failed to preview import data',
      details: error.message 
    });
  }
});

/**
 * POST /api/data-import/execute
 * Execute the actual data import
 */
router.post('/execute', authenticateToken, dataImportService.upload.single('file'), async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const options = {
      skipDuplicates: req.body.skipDuplicates !== 'false',
      updateExisting: req.body.updateExisting === 'true'
    };

    const results = await dataImportService.importData(
      req.file.buffer,
      req.file.originalname,
      userId,
      options
    );

    res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      results,
      options
    });

  } catch (error) {
    console.error('Error executing import:', error);
    res.status(500).json({ 
      error: 'Failed to import data',
      details: error.message 
    });
  }
});

/**
 * GET /api/data-import/template
 * Download a template Excel file for data import
 */
router.get('/template', authenticateToken, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    // Create sample data for the template
    const clientsData = [
      {
        email: 'john.doe@example.com',
        name: 'John Doe',
        business_type: 'Technology',
        likely_value: 50000,
        likely_close_month: '2024-03-01',
        pipeline_stage: 'prospecting',
        priority_level: 3,
        last_contact_date: '2024-01-15',
        next_follow_up_date: '2024-02-01',
        notes: 'Interested in our premium package',
        tags: 'tech, startup, high-value',
        source: 'referral'
      },
      {
        email: 'jane.smith@company.com',
        name: 'Jane Smith',
        business_type: 'Healthcare',
        likely_value: 75000,
        likely_close_month: '2024-04-01',
        pipeline_stage: 'qualified',
        priority_level: 2,
        last_contact_date: '2024-01-20',
        next_follow_up_date: '2024-02-05',
        notes: 'Ready for proposal presentation',
        tags: 'healthcare, enterprise',
        source: 'website'
      }
    ];

    // Create sample meetings data matching Create Meeting form fields
    const meetingsData = [
      {
        'Meeting Held With': 'john.doe@example.com',
        'Full Name': 'John Doe',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Meeting Title': 'Initial Consultation',
        'Description': 'Discussed client needs and our services',
        'Start Time': '2024-01-15T10:00',
        'End Time': '2024-01-15T11:00',
        'Location Type': 'video',
        'Location Details': 'Zoom meeting',
        'Attendees': 'John Doe',
        'Transcript': ''
      },
      {
        'Meeting Held With': 'jane.smith@company.com',
        'Full Name': 'Jane Smith',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        'Meeting Title': 'Proposal Review',
        'Description': 'Reviewed detailed proposal and pricing',
        'Start Time': '2024-01-20T14:30',
        'End Time': '2024-01-20T15:30',
        'Location Type': 'in-person',
        'Location Details': 'Client office, Conference Room A',
        'Attendees': 'Jane Smith',
        'Transcript': ''
      },
      {
        'Meeting Held With': 'newclient@startup.com',
        'Full Name': 'Alex Johnson',
        'First Name': 'Alex',
        'Last Name': 'Johnson',
        'Meeting Title': 'Discovery Meeting',
        'Description': 'New client discovery session - will create client automatically',
        'Start Time': '2024-01-25T09:00',
        'End Time': '2024-01-25T09:45',
        'Location Type': 'video',
        'Location Details': 'Google Meet',
        'Attendees': 'Alex Johnson',
        'Transcript': ''
      }
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Add clients sheet
    const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Clients');
    
    // Add meetings sheet
    const meetingsSheet = XLSX.utils.json_to_sheet(meetingsData);
    XLSX.utils.book_append_sheet(workbook, meetingsSheet, 'Meetings');
    
    // Add instructions sheet
    const instructionsData = [
      { Field: 'CLIENTS SHEET INSTRUCTIONS', Description: '', Required: '', Format: '' },
      { Field: 'email', Description: 'Client email address', Required: 'Yes', Format: 'valid email format' },
      { Field: 'name', Description: 'Client full name', Required: 'No', Format: 'text' },
      { Field: 'business_type', Description: 'Type of business', Required: 'No', Format: 'text' },
      { Field: 'likely_value', Description: 'Expected deal value', Required: 'No', Format: 'number' },
      { Field: 'likely_close_month', Description: 'Expected close date', Required: 'No', Format: 'YYYY-MM-DD' },
      { Field: 'pipeline_stage', Description: 'Current pipeline stage', Required: 'No', Format: 'unscheduled, prospecting, qualified, proposal, negotiation, closed_won, closed_lost' },
      { Field: 'priority_level', Description: 'Priority level (1=highest, 5=lowest)', Required: 'No', Format: '1-5' },
      { Field: 'last_contact_date', Description: 'Last contact date', Required: 'No', Format: 'YYYY-MM-DD' },
      { Field: 'next_follow_up_date', Description: 'Next follow-up date', Required: 'No', Format: 'YYYY-MM-DD' },
      { Field: 'notes', Description: 'Additional notes', Required: 'No', Format: 'text' },
      { Field: 'tags', Description: 'Comma-separated tags', Required: 'No', Format: 'tag1, tag2, tag3' },
      { Field: 'source', Description: 'How client was acquired', Required: 'No', Format: 'text' },
      { Field: '', Description: '', Required: '', Format: '' },
      { Field: 'MEETINGS SHEET INSTRUCTIONS (Matches Create Meeting Form)', Description: '', Required: '', Format: '' },
      { Field: 'Meeting Held With', Description: 'Client email (new clients created automatically)', Required: 'Yes', Format: 'valid email format' },
      { Field: 'Full Name', Description: 'Client full name (used for new client creation)', Required: 'Yes', Format: 'text' },
      { Field: 'First Name', Description: 'Client first name', Required: 'No', Format: 'text' },
      { Field: 'Last Name', Description: 'Client last name', Required: 'No', Format: 'text' },
      { Field: 'Meeting Title', Description: 'Meeting title/subject', Required: 'Yes', Format: 'text' },
      { Field: 'Description', Description: 'Meeting description or agenda', Required: 'No', Format: 'text' },
      { Field: 'Start Time', Description: 'Meeting start date and time', Required: 'Yes', Format: 'YYYY-MM-DDTHH:MM (e.g., 2024-01-15T10:00)' },
      { Field: 'End Time', Description: 'Meeting end date and time', Required: 'No', Format: 'YYYY-MM-DDTHH:MM (e.g., 2024-01-15T11:00)' },
      { Field: 'Location Type', Description: 'Type of meeting location (defaults to video)', Required: 'No', Format: 'video, phone, in-person, other' },
      { Field: 'Location Details', Description: 'Meeting link, address, or phone number', Required: 'No', Format: 'text' },
      { Field: 'Attendees', Description: 'Client name or attendee list', Required: 'No', Format: 'text' },
      { Field: 'Transcript', Description: 'Meeting transcript if available', Required: 'No', Format: 'text' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="advicly-import-template.xlsx"');
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ 
      error: 'Failed to generate template',
      details: error.message 
    });
  }
});

/**
 * GET /api/data-import/status
 * Get import status and statistics
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { getSupabase } = require('../lib/supabase');
    const supabase = getSupabase();
    const userId = req.user.id;

    // Get client statistics
    const { data: clientStats, error: clientError } = await supabase
      .from('clients')
      .select('id, created_at, pipeline_stage')
      .eq('advisor_id', userId);

    if (clientError) {
      throw clientError;
    }

    // Get meeting statistics
    const { data: meetingStats, error: meetingError } = await supabase
      .from('meetings')
      .select('id, created_at, is_manual')
      .eq('userid', userId);

    if (meetingError) {
      throw meetingError;
    }

    // Calculate statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      clients: {
        total: clientStats.length,
        recentlyAdded: clientStats.filter(c => new Date(c.created_at) > thirtyDaysAgo).length,
        byStage: clientStats.reduce((acc, client) => {
          acc[client.pipeline_stage] = (acc[client.pipeline_stage] || 0) + 1;
          return acc;
        }, {})
      },
      meetings: {
        total: meetingStats.length,
        manual: meetingStats.filter(m => m.is_manual).length,
        recentlyAdded: meetingStats.filter(m => new Date(m.created_at) > thirtyDaysAgo).length
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting import status:', error);
    res.status(500).json({ 
      error: 'Failed to get import status',
      details: error.message 
    });
  }
});

module.exports = router;
