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
 * Expected spreadsheet format for MEETING IMPORT:
 * Matches the Create Meeting form fields exactly
 *
 * REQUIRED FIELDS:
 * - Meeting Held With (required, email of existing client or new client)
 * - Full Name (required, client's full name for reference/creation)
 * - Meeting Title (required, meeting title/subject)
 * - Start Time (required, meeting start date and time)
 *
 * OPTIONAL FIELDS:
 * - First Name (client's first name)
 * - Last Name (client's last name)
 * - Description (meeting description/agenda - maps to summary)
 * - End Time (meeting end date and time)
 * - Location Type (video, phone, in-person, other - defaults to video)
 * - Location Details (meeting link, address, or phone number)
 * - Attendees (client name or attendee list)
 * - Transcript (meeting transcript if available)
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
 * Parse CSV file - Focus on meetings only
 */
async function parseCSV(fileBuffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(fileBuffer.toString());

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // All rows are expected to be meeting data
        // Map the user's column headers to our internal field names (matching Create Meeting form)
        const meetings = results.map(row => ({
          client_email: row['Meeting Held With'] || row.client_email,
          full_name: row['Full Name'] || row.full_name,
          first_name: row['First Name'] || row.first_name,
          last_name: row['Last Name'] || row.last_name,
          title: row['Meeting Title'] || row.meeting_title || row.title,
          description: row['Description'] || row.description || row.summary,
          start_time: row['Start Time'] || row.start_time,
          end_time: row['End Time'] || row.end_time,
          location_type: row['Location Type'] || row.location_type,
          location_details: row['Location Details'] || row.location_details,
          attendees: row['Attendees'] || row.attendees,
          transcript: row['Transcript'] || row.transcript,
          // Legacy support for old format
          meeting_date: row['Meeting Date'] || row.meeting_date,
          meeting_time: row['Meeting Time'] || row.meeting_time
        })).filter(row =>
          row.client_email && row.title && (row.start_time || row.meeting_date)
        );

        resolve({
          meetings: meetings
        });
      })
      .on('error', reject);
  });
}

/**
 * Parse Excel file - Focus on meetings only
 */
function parseExcel(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const result = {
    meetings: []
  };

  // Look for sheet named 'Meetings' or use first sheet
  const sheetNames = workbook.SheetNames;

  // Try to find meetings sheet, otherwise use first sheet
  let meetingsSheetName = sheetNames.find(name =>
    name.toLowerCase().includes('meeting')
  ) || sheetNames[0];

  // Parse meetings sheet
  if (meetingsSheetName) {
    const meetingsSheet = workbook.Sheets[meetingsSheetName];
    const allRows = XLSX.utils.sheet_to_json(meetingsSheet);

    // Map the user's column headers to our internal field names (matching Create Meeting form)
    result.meetings = allRows.map(row => ({
      client_email: row['Meeting Held With'] || row.client_email,
      full_name: row['Full Name'] || row.full_name,
      first_name: row['First Name'] || row.first_name,
      last_name: row['Last Name'] || row.last_name,
      title: row['Meeting Title'] || row.meeting_title || row.title,
      description: row['Description'] || row.description || row.summary,
      start_time: row['Start Time'] || row.start_time,
      end_time: row['End Time'] || row.end_time,
      location_type: row['Location Type'] || row.location_type,
      location_details: row['Location Details'] || row.location_details,
      attendees: row['Attendees'] || row.attendees,
      transcript: row['Transcript'] || row.transcript,
      // Legacy support for old format
      meeting_date: row['Meeting Date'] || row.meeting_date,
      meeting_time: row['Meeting Time'] || row.meeting_time
    })).filter(row =>
      row.client_email && row.title && (row.start_time || row.meeting_date)
    );
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
  
  // This function is no longer used - focusing on meetings only
  return { errors, warnings, data: clientRow };
}

/**
 * Validate and normalize meeting data - Simplified for meetings-only import
 */
function validateMeetingData(meetingRow, rowIndex) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!meetingRow.client_email) {
    errors.push(`Row ${rowIndex + 1}: Meeting Held With (client email) is required`);
  }

  // Validate meeting title (support both new and legacy formats)
  if (!meetingRow.title && !meetingRow.meeting_title) {
    errors.push(`Row ${rowIndex + 1}: Meeting Title is required`);
  } else if (meetingRow.meeting_title && !meetingRow.title) {
    meetingRow.title = meetingRow.meeting_title; // Normalize legacy format
  }

  // Validate start time (support both new format and legacy format)
  if (!meetingRow.start_time && !meetingRow.meeting_date) {
    errors.push(`Row ${rowIndex + 1}: Start Time is required`);
  }

  // Normalize full name for client creation
  if (meetingRow.full_name) {
    meetingRow.full_name = meetingRow.full_name.trim();
  }

  // Validate email format
  if (meetingRow.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meetingRow.client_email)) {
    errors.push(`Row ${rowIndex + 1}: Invalid client email format`);
  }
  
  // Parse start and end times (support both new format and legacy format)
  let startDateTime, endDateTime;

  if (meetingRow.start_time) {
    // New format: Start Time (datetime-local format)
    startDateTime = new Date(meetingRow.start_time);
    if (isNaN(startDateTime.getTime())) {
      errors.push(`Row ${rowIndex + 1}: Invalid Start Time format`);
    } else {
      meetingRow.starttime = startDateTime.toISOString();

      if (meetingRow.end_time) {
        // Use provided end time
        endDateTime = new Date(meetingRow.end_time);
        if (isNaN(endDateTime.getTime())) {
          warnings.push(`Row ${rowIndex + 1}: Invalid End Time format, will calculate from start time`);
          endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour
        }
      } else {
        // Calculate end time (default 1 hour)
        endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      }
      meetingRow.endtime = endDateTime.toISOString();
    }
  } else if (meetingRow.meeting_date) {
    // Legacy format: Meeting Date + Meeting Time
    const meetingDate = parseDate(meetingRow.meeting_date);
    if (!meetingDate) {
      errors.push(`Row ${rowIndex + 1}: Invalid Meeting Date format`);
    } else {
      const startTime = meetingRow.meeting_time || '09:00';
      startDateTime = parseDateTime(meetingRow.meeting_date, startTime);

      if (!startDateTime) {
        errors.push(`Row ${rowIndex + 1}: Invalid Meeting Date/Time format`);
      } else {
        meetingRow.starttime = startDateTime.toISOString();

        // Calculate end time based on duration (default 60 minutes)
        const duration = parseInt(meetingRow.meeting_duration) || 60;
        endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));
        meetingRow.endtime = endDateTime.toISOString();
      }
    }
  }
  
  // Validate and normalize location type
  const validLocationTypes = ['video', 'phone', 'in-person', 'other'];
  if (meetingRow.location_type) {
    const normalizedType = meetingRow.location_type.toLowerCase();
    if (!validLocationTypes.includes(normalizedType)) {
      warnings.push(`Row ${rowIndex + 1}: Invalid location type '${meetingRow.location_type}', will default to 'video'`);
      meetingRow.location_type = 'video';
    } else {
      meetingRow.location_type = normalizedType;
    }
  } else {
    meetingRow.location_type = 'video'; // Default to video like Create Meeting form
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
      meetings: {
        total: parsedData.meetings.length,
        valid: 0,
        errors: [],
        warnings: [],
        sample: []
      }
    };

    // Validate meetings only
    parsedData.meetings.forEach((meeting, index) => {
      const validation = validateMeetingData(meeting, index);

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
      meetings: {
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: []
      },
      summary: {
        totalProcessed: parsedData.meetings.length,
        totalImported: 0,
        totalErrors: 0
      }
    };

    // Get existing clients to map emails to IDs
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id, email')
      .eq('advisor_id', userId);

    const clientEmailToIdMap = new Map();
    if (existingClients) {
      existingClients.forEach(client => {
        clientEmailToIdMap.set(client.email, client.id);
      });
    }

    // Import meetings only
    for (let i = 0; i < parsedData.meetings.length; i++) {
      const meetingRow = parsedData.meetings[i];
      const validation = validateMeetingData(meetingRow, i);

      if (validation.errors.length > 0) {
        results.meetings.errors.push(...validation.errors);
        results.summary.totalErrors += validation.errors.length;
        continue;
      }

      // Check if client exists, create if not
      let clientId = clientEmailToIdMap.get(validation.data.client_email);

      if (!clientId) {
        // Create new client from meeting data
        try {
          const newClientData = {
            user_id: userId,
            email: validation.data.client_email,
            name: validation.data.full_name || validation.data.client_email.split('@')[0],
            pipeline_stage: 'unscheduled',
            priority_level: 3,
            source: 'meeting_import',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert(newClientData)
            .select('id')
            .single();

          if (clientError) {
            results.meetings.errors.push(`Row ${i + 1}: Failed to create client '${validation.data.client_email}' - ${clientError.message}`);
            results.summary.totalErrors++;
            continue;
          }

          clientId = newClient.id;
          // Add to map for future meetings with same client
          clientEmailToIdMap.set(validation.data.client_email, clientId);

        } catch (clientCreationError) {
          results.meetings.errors.push(`Row ${i + 1}: Error creating client '${validation.data.client_email}' - ${clientCreationError.message}`);
          results.summary.totalErrors++;
          continue;
        }
      }

      try {

        // Generate unique external_id for imported meetings
        const externalId = `import_${Date.now()}_${i}_${uuidv4().substring(0, 8)}`;

        // Check if meeting already exists (by title, client, and start time)
        const { data: existingMeeting } = await supabase
          .from('meetings')
          .select('id')
          .eq('user_id', userId)
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
          // Insert new meeting (matching Create Meeting form structure)
          const insertData = {
            userid: userId,
            googleeventid: googleEventId,
            client_id: clientId,
            title: validation.data.title,
            starttime: validation.data.starttime,
            endtime: validation.data.endtime,
            summary: validation.data.description || validation.data.summary, // Use description field
            transcript: validation.data.transcript,
            attendees: validation.data.attendees ? JSON.stringify([{ displayName: validation.data.attendees }]) : null,
            manual_attendees: validation.data.attendees,
            meeting_source: 'manual',
            location_type: validation.data.location_type,
            location_details: validation.data.location_details,
            is_manual: true,
            created_by: userId,
            created_at: new Date().toISOString(),
            updatedat: new Date().toISOString()
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

            // Update client's last_contact_date with the meeting date
            try {
              const meetingDate = parseDate(validation.data.meeting_date);
              if (meetingDate) {
                await supabase
                  .from('clients')
                  .update({
                    last_contact_date: meetingDate.toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', clientId);
              }
            } catch (updateError) {
              // Don't fail the import if client update fails, just log it
              console.warn(`Failed to update client last_contact_date for client ${clientId}:`, updateError);
            }
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
  validateMeetingData
};
