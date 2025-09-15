const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { getSupabase } = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  }
});

/**
 * Expected spreadsheet format:
 * 
 * CLIENTS SHEET/SECTION:
 * - email (required)
 * - name
 * - business_type
 * - likely_value
 * - likely_close_month (YYYY-MM-DD or MM/YYYY format)
 * - pipeline_stage (unscheduled, prospecting, qualified, proposal, negotiation, closed_won, closed_lost)
 * - priority_level (1-5)
 * - last_contact_date (YYYY-MM-DD format)
 * - next_follow_up_date (YYYY-MM-DD format)
 * - notes
 * - tags (comma-separated)
 * - source
 * 
 * MEETINGS SHEET/SECTION:
 * - client_email (required, must match a client)
 * - title (required)
 * - start_date (YYYY-MM-DD format, required)
 * - start_time (HH:MM format, required)
 * - end_date (YYYY-MM-DD format)
 * - end_time (HH:MM format)
 * - summary
 * - notes
 * - location_type (in-person, phone, video, other)
 * - location_details
 * - attendees (comma-separated email addresses)
 */

/**
 * Parse Excel or CSV file and extract data
 */
async function parseFile(fileBuffer, filename) {
  const fileExtension = filename.toLowerCase().split('.').pop();
  
  if (fileExtension === 'csv') {
    return await parseCSV(fileBuffer);
  } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
    return parseExcel(fileBuffer);
  } else {
    throw new Error('Unsupported file format');
  }
}

/**
 * Parse CSV file
 */
async function parseCSV(fileBuffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(fileBuffer.toString());
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // For CSV, we assume all data is in one sheet
        // We'll separate clients and meetings based on column presence
        const clients = [];
        const meetings = [];
        
        results.forEach(row => {
          if (row.email && !row.client_email) {
            // This looks like a client row
            clients.push(row);
          } else if (row.client_email && row.title) {
            // This looks like a meeting row
            meetings.push(row);
          }
        });
        
        resolve({
          clients: clients,
          meetings: meetings
        });
      })
      .on('error', reject);
  });
}

/**
 * Parse Excel file
 */
function parseExcel(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const result = {
    clients: [],
    meetings: []
  };
  
  // Look for sheets named 'Clients', 'Meetings', or use first two sheets
  const sheetNames = workbook.SheetNames;
  
  // Try to find clients sheet
  let clientsSheetName = sheetNames.find(name => 
    name.toLowerCase().includes('client')
  ) || sheetNames[0];
  
  // Try to find meetings sheet
  let meetingsSheetName = sheetNames.find(name => 
    name.toLowerCase().includes('meeting')
  ) || (sheetNames.length > 1 ? sheetNames[1] : null);
  
  // Parse clients sheet
  if (clientsSheetName) {
    const clientsSheet = workbook.Sheets[clientsSheetName];
    result.clients = XLSX.utils.sheet_to_json(clientsSheet);
  }
  
  // Parse meetings sheet
  if (meetingsSheetName) {
    const meetingsSheet = workbook.Sheets[meetingsSheetName];
    result.meetings = XLSX.utils.sheet_to_json(meetingsSheet);
  }
  
  return result;
}

/**
 * Validate and normalize client data
 */
function validateClientData(clientRow, rowIndex) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!clientRow.email) {
    errors.push(`Row ${rowIndex + 1}: Email is required`);
  }
  
  // Validate email format
  if (clientRow.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientRow.email)) {
    errors.push(`Row ${rowIndex + 1}: Invalid email format`);
  }
  
  // Validate pipeline stage
  const validStages = ['unscheduled', 'prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  if (clientRow.pipeline_stage && !validStages.includes(clientRow.pipeline_stage.toLowerCase())) {
    warnings.push(`Row ${rowIndex + 1}: Invalid pipeline stage '${clientRow.pipeline_stage}', will default to 'unscheduled'`);
    clientRow.pipeline_stage = 'unscheduled';
  }
  
  // Validate priority level
  if (clientRow.priority_level) {
    const priority = parseInt(clientRow.priority_level);
    if (isNaN(priority) || priority < 1 || priority > 5) {
      warnings.push(`Row ${rowIndex + 1}: Invalid priority level '${clientRow.priority_level}', will default to 3`);
      clientRow.priority_level = 3;
    } else {
      clientRow.priority_level = priority;
    }
  }
  
  // Validate and parse dates
  if (clientRow.likely_close_month) {
    const date = parseDate(clientRow.likely_close_month);
    if (!date) {
      warnings.push(`Row ${rowIndex + 1}: Invalid likely_close_month format '${clientRow.likely_close_month}'`);
      clientRow.likely_close_month = null;
    } else {
      clientRow.likely_close_month = date.toISOString().split('T')[0];
    }
  }
  
  if (clientRow.last_contact_date) {
    const date = parseDate(clientRow.last_contact_date);
    if (!date) {
      warnings.push(`Row ${rowIndex + 1}: Invalid last_contact_date format '${clientRow.last_contact_date}'`);
      clientRow.last_contact_date = null;
    } else {
      clientRow.last_contact_date = date.toISOString();
    }
  }
  
  if (clientRow.next_follow_up_date) {
    const date = parseDate(clientRow.next_follow_up_date);
    if (!date) {
      warnings.push(`Row ${rowIndex + 1}: Invalid next_follow_up_date format '${clientRow.next_follow_up_date}'`);
      clientRow.next_follow_up_date = null;
    } else {
      clientRow.next_follow_up_date = date.toISOString();
    }
  }
  
  // Parse tags
  if (clientRow.tags && typeof clientRow.tags === 'string') {
    clientRow.tags = clientRow.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
  }
  
  return { errors, warnings, data: clientRow };
}

/**
 * Validate and normalize meeting data
 */
function validateMeetingData(meetingRow, rowIndex, clientEmailMap) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!meetingRow.client_email) {
    errors.push(`Row ${rowIndex + 1}: Client email is required`);
  }
  
  if (!meetingRow.title) {
    errors.push(`Row ${rowIndex + 1}: Meeting title is required`);
  }
  
  if (!meetingRow.start_date) {
    errors.push(`Row ${rowIndex + 1}: Start date is required`);
  }
  
  if (!meetingRow.start_time) {
    errors.push(`Row ${rowIndex + 1}: Start time is required`);
  }
  
  // Validate client exists
  if (meetingRow.client_email && !clientEmailMap.has(meetingRow.client_email)) {
    errors.push(`Row ${rowIndex + 1}: Client with email '${meetingRow.client_email}' not found`);
  }
  
  // Validate and parse start datetime
  if (meetingRow.start_date && meetingRow.start_time) {
    const startDateTime = parseDateTime(meetingRow.start_date, meetingRow.start_time);
    if (!startDateTime) {
      errors.push(`Row ${rowIndex + 1}: Invalid start date/time format`);
    } else {
      meetingRow.starttime = startDateTime.toISOString();
    }
  }
  
  // Validate and parse end datetime
  if (meetingRow.end_date && meetingRow.end_time) {
    const endDateTime = parseDateTime(meetingRow.end_date, meetingRow.end_time);
    if (!endDateTime) {
      warnings.push(`Row ${rowIndex + 1}: Invalid end date/time format`);
      meetingRow.endtime = null;
    } else {
      meetingRow.endtime = endDateTime.toISOString();
    }
  }
  
  // Validate location type
  const validLocationTypes = ['in-person', 'phone', 'video', 'other'];
  if (meetingRow.location_type && !validLocationTypes.includes(meetingRow.location_type.toLowerCase())) {
    warnings.push(`Row ${rowIndex + 1}: Invalid location type '${meetingRow.location_type}', will default to 'other'`);
    meetingRow.location_type = 'other';
  }
  
  // Parse attendees
  if (meetingRow.attendees && typeof meetingRow.attendees === 'string') {
    const attendeeEmails = meetingRow.attendees.split(',').map(email => email.trim()).filter(email => email);
    meetingRow.attendees = attendeeEmails.map(email => ({
      email: email,
      displayName: email.split('@')[0]
    }));
  }
  
  return { errors, warnings, data: meetingRow };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try different date formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{4}$/, // MM/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY or MM/DD/YYYY
    /^\d{4}\/\d{1,2}\/\d{1,2}$/, // YYYY/M/D or YYYY/MM/DD
  ];

  const dateString = dateStr.toString().trim();

  // Try parsing as ISO date first
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try MM/YYYY format
  if (/^\d{2}\/\d{4}$/.test(dateString)) {
    const [month, year] = dateString.split('/');
    date = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Parse datetime from date and time strings
 */
function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  const date = parseDate(dateStr);
  if (!date) return null;

  // Parse time (HH:MM format)
  const timeMatch = timeStr.toString().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  date.setHours(hours, minutes, seconds, 0);
  return date;
}

/**
 * Preview imported data without saving to database
 */
async function previewImport(fileBuffer, filename, userId) {
  try {
    const parsedData = await parseFile(fileBuffer, filename);
    const preview = {
      clients: {
        total: parsedData.clients.length,
        valid: 0,
        errors: [],
        warnings: [],
        sample: []
      },
      meetings: {
        total: parsedData.meetings.length,
        valid: 0,
        errors: [],
        warnings: [],
        sample: []
      }
    };

    // Validate clients
    const clientEmailMap = new Map();
    parsedData.clients.forEach((client, index) => {
      const validation = validateClientData(client, index);

      if (validation.errors.length === 0) {
        preview.clients.valid++;
        clientEmailMap.set(client.email, true);

        // Add to sample (first 5 valid records)
        if (preview.clients.sample.length < 5) {
          preview.clients.sample.push(validation.data);
        }
      }

      preview.clients.errors.push(...validation.errors);
      preview.clients.warnings.push(...validation.warnings);
    });

    // Validate meetings
    parsedData.meetings.forEach((meeting, index) => {
      const validation = validateMeetingData(meeting, index, clientEmailMap);

      if (validation.errors.length === 0) {
        preview.meetings.valid++;

        // Add to sample (first 5 valid records)
        if (preview.meetings.sample.length < 5) {
          preview.meetings.sample.push(validation.data);
        }
      }

      preview.meetings.errors.push(...validation.errors);
      preview.meetings.warnings.push(...validation.warnings);
    });

    return preview;
  } catch (error) {
    throw new Error(`Failed to preview import: ${error.message}`);
  }
}

/**
 * Import data to database
 */
async function importData(fileBuffer, filename, userId, options = {}) {
  const { skipDuplicates = true, updateExisting = false } = options;

  try {
    const parsedData = await parseFile(fileBuffer, filename);
    const supabase = getSupabase();

    const results = {
      clients: {
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: []
      },
      meetings: {
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: []
      },
      summary: {
        totalProcessed: 0,
        totalImported: 0,
        totalErrors: 0
      }
    };

    // Start transaction
    const clientEmailToIdMap = new Map();

    // Import clients first
    for (let i = 0; i < parsedData.clients.length; i++) {
      const clientRow = parsedData.clients[i];
      const validation = validateClientData(clientRow, i);

      if (validation.errors.length > 0) {
        results.clients.errors.push(...validation.errors);
        results.summary.totalErrors += validation.errors.length;
        continue;
      }

      try {
        // Check if client already exists
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id, email')
          .eq('advisor_id', userId)
          .eq('email', validation.data.email)
          .single();

        if (existingClient) {
          clientEmailToIdMap.set(validation.data.email, existingClient.id);

          if (updateExisting) {
            // Update existing client
            const updateData = {
              name: validation.data.name || existingClient.name,
              business_type: validation.data.business_type,
              likely_value: validation.data.likely_value,
              likely_close_month: validation.data.likely_close_month,
              pipeline_stage: validation.data.pipeline_stage || 'unscheduled',
              priority_level: validation.data.priority_level || 3,
              last_contact_date: validation.data.last_contact_date,
              next_follow_up_date: validation.data.next_follow_up_date,
              notes: validation.data.notes,
              tags: validation.data.tags,
              source: validation.data.source,
              updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('clients')
              .update(updateData)
              .eq('id', existingClient.id);

            if (updateError) {
              results.clients.errors.push(`Row ${i + 1}: Failed to update client - ${updateError.message}`);
              results.summary.totalErrors++;
            } else {
              results.clients.updated++;
              results.summary.totalImported++;
            }
          } else {
            results.clients.skipped++;
          }
        } else {
          // Insert new client
          const insertData = {
            advisor_id: userId,
            email: validation.data.email,
            name: validation.data.name,
            business_type: validation.data.business_type,
            likely_value: validation.data.likely_value,
            likely_close_month: validation.data.likely_close_month,
            pipeline_stage: validation.data.pipeline_stage || 'unscheduled',
            priority_level: validation.data.priority_level || 3,
            last_contact_date: validation.data.last_contact_date,
            next_follow_up_date: validation.data.next_follow_up_date,
            notes: validation.data.notes,
            tags: validation.data.tags,
            source: validation.data.source
          };

          const { data: newClient, error: insertError } = await supabase
            .from('clients')
            .insert(insertData)
            .select('id, email')
            .single();

          if (insertError) {
            results.clients.errors.push(`Row ${i + 1}: Failed to insert client - ${insertError.message}`);
            results.summary.totalErrors++;
          } else {
            clientEmailToIdMap.set(validation.data.email, newClient.id);
            results.clients.imported++;
            results.summary.totalImported++;
          }
        }

        results.summary.totalProcessed++;
      } catch (error) {
        results.clients.errors.push(`Row ${i + 1}: Unexpected error - ${error.message}`);
        results.summary.totalErrors++;
      }
    }

    // Import meetings
    for (let i = 0; i < parsedData.meetings.length; i++) {
      const meetingRow = parsedData.meetings[i];
      const validation = validateMeetingData(meetingRow, i, clientEmailToIdMap);

      if (validation.errors.length > 0) {
        results.meetings.errors.push(...validation.errors);
        results.summary.totalErrors += validation.errors.length;
        continue;
      }

      try {
        const clientId = clientEmailToIdMap.get(validation.data.client_email);

        // Generate unique googleeventid for imported meetings
        const googleEventId = `import_${Date.now()}_${i}_${uuidv4().substring(0, 8)}`;

        // Check if meeting already exists (by title, client, and start time)
        const { data: existingMeeting } = await supabase
          .from('meetings')
          .select('id')
          .eq('userid', userId)
          .eq('client_id', clientId)
          .eq('title', validation.data.title)
          .eq('starttime', validation.data.starttime)
          .single();

        if (existingMeeting) {
          if (updateExisting) {
            // Update existing meeting
            const updateData = {
              endtime: validation.data.endtime,
              summary: validation.data.summary,
              notes: validation.data.notes,
              location_type: validation.data.location_type,
              location_details: validation.data.location_details,
              attendees: JSON.stringify(validation.data.attendees || []),
              updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('meetings')
              .update(updateData)
              .eq('id', existingMeeting.id);

            if (updateError) {
              results.meetings.errors.push(`Row ${i + 1}: Failed to update meeting - ${updateError.message}`);
              results.summary.totalErrors++;
            } else {
              results.meetings.updated++;
              results.summary.totalImported++;
            }
          } else {
            results.meetings.skipped++;
          }
        } else {
          // Insert new meeting
          const insertData = {
            userid: userId,
            googleeventid: googleEventId,
            client_id: clientId,
            title: validation.data.title,
            starttime: validation.data.starttime,
            endtime: validation.data.endtime,
            summary: validation.data.summary,
            notes: validation.data.notes,
            attendees: JSON.stringify(validation.data.attendees || []),
            meeting_source: 'manual',
            location_type: validation.data.location_type,
            location_details: validation.data.location_details,
            is_manual: true,
            created_by: userId
          };

          const { error: insertError } = await supabase
            .from('meetings')
            .insert(insertData);

          if (insertError) {
            results.meetings.errors.push(`Row ${i + 1}: Failed to insert meeting - ${insertError.message}`);
            results.summary.totalErrors++;
          } else {
            results.meetings.imported++;
            results.summary.totalImported++;
          }
        }

        results.summary.totalProcessed++;
      } catch (error) {
        results.meetings.errors.push(`Row ${i + 1}: Unexpected error - ${error.message}`);
        results.summary.totalErrors++;
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to import data: ${error.message}`);
  }
}

module.exports = {
  upload,
  parseFile,
  previewImport,
  importData,
  validateClientData,
  validateMeetingData
};
